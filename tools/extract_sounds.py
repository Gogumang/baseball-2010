#!/usr/bin/env python3
"""
원본 jar 안의 소리 52개(`sound/NNN.mmf`)를 브라우저가 틀 수 있는 파일로 바꾼다.

    python3 tools/extract_sounds.py --info      # 형식만 훑어 본다 (청크 구조·종류별 개수)
    python3 tools/extract_sounds.py             # public/sounds/NNN.mp3 52개를 만든다
    python3 tools/extract_sounds.py --format wav --keep-wav

`base/게임빌2010프로야구/0002C663.jar` (원본 jar) 가 있어야 한다. 없는 사람은 이 스크립트를
돌릴 수 없다 — 대신 아래 설명만 읽어도 무엇이 들어 있는지는 알 수 있다.

## .mmf 안에 무엇이 들어 있나 (직접 청크를 파싱해 확인했다)

52개 전부 야마하 **SMAF**(Synthetic music Mobile Application Format)다. `MMMD` 매직으로
시작하고 그 뒤에 `4바이트 청크이름 + u32 크기(big endian) + 내용` 이 이어진다.

    MMMD <전체크기>
      CNTI  ...            목차 (제목·저작권 같은 것)
      OPDA  { Dch }        선택 정보
      MTRn  <포맷 1B><시퀀스 1B><Duration 1B><GateTime 1B><채널상태 2B 또는 16B>
        MspI ...           시작·정지 틱
        Mtsu ...           음색 세팅 (야마하 FM voice exclusive `F0 43 ..`)
        Mtsq ...           악보 (음 이벤트)
        Mtsp { Mwan }      스트림 파형 — 여기 PCM 이 들어 있다
      ATRn  <포맷 1B><시퀀스 1B><WaveType 2B><Duration 1B><GateTime 1B>
        AspI / Atsq / Awan 오디오 트랙 (000.mmf 하나뿐)
    <u32 CRC>

    포맷 바이트 0x00 = Handy Phone Standard(MA-1/MA-2, 채널상태 2B)
              0x02 = Mobile Standard 무압축(MA-3/MA-5, 채널상태 16B)

종류별로 세면 (이 스크립트 `--info` 가 그대로 찍는다):

    * **FM 악보형 26개** — `Mtsu` 에 커스텀 FM 음색이 실린 악보. 파형이 아예 없다.
      MIDI 로 뽑아 봐야 프로그램 번호가 그 커스텀 음색 번호라 GM 신스로는 다른 악기가 난다.
    * **스트림 ADPCM 샘플형 25개** — `Mtsp/Mwan` 안에 **야마하 4비트 ADPCM**.
      `Mwa` 머리 3바이트가 `<타입 1B><샘플레이트 u16 BE>` 이고 실제 값은 `20 2b 11`
      (0x20 = ADPCM 4bit 모노, 0x2b11 = 11025Hz) 또는 `20 1f 40` (8000Hz)다.
      악보는 이 파형을 한 번 트리거할 뿐이다. 심판 콜·함성 같은 음성·효과음.
    * **ATR 형 1개(000)** — MA-2 악보 + `Awa` ADPCM(3.5KB). 로고 "GAMEVIL" 음성.
    * 011 은 FM 악보 + 스트림 ADPCM 둘 다 들어 있다 (위 셈에서는 스트림형으로 친다).

## 어떻게 뽑나 — 두 갈래

1. **WildMIDI (권장, 52개 전부)**
   `ffmpeg` 은 MMF 를 거부한다 ("MIDI like format found, unsupported"). 대신
   **WildMIDI master 에 SMAF 지원이 들어 있다** (`src/f_smaf.c`, `src/mafm.c` — 야마하 MA
   FM 합성 + ADPCM). 안정판 0.5.0 에는 없고 개발판을 `-DWANT_MAFM=ON` 으로 직접 빌드해야 한다.

       curl -L -o wm.tar.gz https://codeload.github.com/Mindwerks/wildmidi/tar.gz/58b66625a072f017313f83c9a1a1c050188ec069
       tar xzf wm.tar.gz && cd wildmidi-58b6662* && mkdir build && cd build
       cmake .. -DWANT_MAFM=ON -DCMAKE_BUILD_TYPE=Release && make -j8
       # 결과: build/wildmidi (맥에서는 build/wildmidi.app/Contents/MacOS/wildmidi)

       python3 tools/extract_sounds.py --wildmidi <그 경로>

   `-O` 는 GM 폴백을 OPL3 로 돌려 음색 패치 파일(cfg) 없이도 소리가 나게 한다.
   FM 음색 재현이 원본과 똑같은지는 귀로 대조하지 못했다 — WildMIDI 문서도 "M5 fidelity
   work remains" 라고 적는다. 그래서 **FM 악보형 26개의 음색은 근사다**.

2. **내장 야마하 ADPCM 디코더 (WildMIDI 가 없을 때, 25+1개만)**
   `Mwa`/`Awa` 안의 4비트 ADPCM 만 순수 파이썬으로 풀어 wav 로 낸다 (`decode_yamaha_adpcm`).
   이건 코덱을 그대로 되돌리는 것이라 **근사가 아니라 원본 그대로**다.
   FM 악보형 26개는 이 갈래로는 **못 뽑는다** — 억지로 다른 악기로 지어내지 않는다.

마지막에 `ffmpeg` 로 mp3(기본) 나 ogg(opus) 로 줄인다. `ffmpeg` 이 없으면 wav 로 두고 알린다.
"""
from __future__ import annotations

import argparse
import shutil
import struct
import subprocess
import sys
import wave
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_JAR = REPO / 'base' / '게임빌2010프로야구' / '0002C663.jar'
DEFAULT_OUT = REPO / 'public' / 'sounds'
DEFAULT_WORK = REPO / 'base' / 'work' / 'sound'

# ── 야마하 4비트 ADPCM ────────────────────────────────────────────────────────
# ffmpeg 의 `adpcm_yamaha` 와 같은 표다. SMAF MA 의 파형이 바로 이 코덱을 쓴다.
# 한 바이트에 니블 두 개가 들어가고 **아래 니블이 먼저**다 (두 순서를 다 풀어 보고
# 아래 니블 먼저일 때만 DC 치우침이 0 근처로 떨어지는 것을 확인했다).
_DIFF = (1, 3, 5, 7, 9, 11, 13, 15, -1, -3, -5, -7, -9, -11, -13, -15)
_SCALE = (230, 230, 230, 230, 307, 409, 512, 614) * 2


def decode_yamaha_adpcm(data: bytes) -> bytes:
    """4비트 야마하 ADPCM → 16비트 리틀엔디언 PCM."""
    predictor = 0
    step = 127
    out = bytearray()
    for byte in data:
        for nibble in (byte & 0x0F, byte >> 4):
            predictor += int(step * _DIFF[nibble] / 8)  # C 의 정수 나눗셈(0 쪽으로 자름)
            predictor = max(-32768, min(32767, predictor))
            step = max(127, min(24576, (step * _SCALE[nibble]) >> 8))
            out += struct.pack('<h', predictor)
    return bytes(out)


# ── SMAF 청크 파서 ───────────────────────────────────────────────────────────
CONTAINERS = {b'MMMD', b'OPDA', b'Mtsp', b'Atsp'}

# ATR 쪽 `Awa` 는 샘플레이트를 Hz 가 아니라 등급 번호로 적는다.
ATR_RATE_CLASS = {0: 4000, 1: 8000, 2: 11025, 3: 22050, 4: 44100}


class Wave:
    """파일 안에서 찾아낸 파형 하나."""

    def __init__(self, kind: str, sample_rate: int, data: bytes) -> None:
        self.kind = kind
        self.sample_rate = sample_rate
        self.data = data


class Smaf:
    def __init__(self, name: str, blob: bytes) -> None:
        self.name = name
        self.blob = blob
        self.lines: list[str] = []
        self.waves: list[Wave] = []
        self.has_score = False       # FM 악보(Mtsq 가 있고 파형이 없는 트랙)
        self._atr_wave_type = 0
        if blob[:4] != b'MMMD':
            raise ValueError(f'{name}: MMMD 가 아니다')
        declared = struct.unpack('>I', blob[4:8])[0]
        self._walk(8, min(8 + declared, len(blob)), 0)

    def _note(self, depth: int, text: str) -> None:
        self.lines.append('  ' * depth + text)

    def _walk(self, offset: int, end: int, depth: int) -> None:
        while offset + 8 <= end:
            cid = self.blob[offset:offset + 8][:4]
            size = struct.unpack('>I', self.blob[offset + 4:offset + 8])[0]
            body, body_end = offset + 8, min(offset + 8 + size, end)
            head = cid[:3]

            if head == b'MTR':
                fmt = self.blob[body]
                # 포맷 0 = Handy Phone Standard(채널상태 2B), 그 밖 = Mobile Standard(16B)
                channel_status = 2 if fmt == 0x00 else 16
                self._note(depth, f'MTR{cid[3]} 포맷={fmt:#04x} 크기={size}')
                self._walk(body + 4 + channel_status, body_end, depth + 1)
            elif head == b'ATR':
                self._atr_wave_type = struct.unpack('>H', self.blob[body + 2:body + 4])[0]
                self._note(depth, f'ATR{cid[3]} 포맷={self.blob[body]:#04x} '
                                  f'WaveType={self._atr_wave_type:#06x} 크기={size}')
                self._walk(body + 6, body_end, depth + 1)
            elif head == b'Mwa':
                wave_type = self.blob[body]
                rate = struct.unpack('>H', self.blob[body + 1:body + 3])[0]
                self._note(depth, f'Mwa{cid[3]} 타입={wave_type:#04x} {rate}Hz '
                                  f'파형={size - 3}B')
                self.waves.append(Wave('Mwa', rate, self.blob[body + 3:body_end]))
            elif head == b'Awa':
                # Awa 몸통은 `<포맷 1B><레이트등급 1B><ADPCM ...>` 이다. Mwa 처럼 Hz 를 그대로
                # 적지 않고 아래 니블에 등급 번호만 적는다 (WildMIDI src/mafm.c mafm_add_wave).
                rate = ATR_RATE_CLASS.get(self.blob[body + 1] & 0x0F, 8000)
                self._note(depth, f'Awa{cid[3]} 등급={self.blob[body + 1]:#04x} → {rate}Hz '
                                  f'파형={size - 2}B')
                self.waves.append(Wave('Awa', rate, self.blob[body + 2:body_end]))
            else:
                self._note(depth, f'{cid.decode("latin1")!r} 크기={size}')
                if cid == b'Mtsq':
                    self.has_score = True
                if cid in CONTAINERS:
                    self._walk(body, body_end, depth + 1)

            offset = body + size

    @property
    def kind(self) -> str:
        if self.waves:
            return 'ATR ADPCM' if self.waves[0].kind == 'Awa' else '스트림 ADPCM'
        return 'FM 악보'


# ── 뽑기 ─────────────────────────────────────────────────────────────────────
def read_mmf_from_jar(jar: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(jar) as zf:
        names = sorted(n for n in zf.namelist() if n.startswith('sound/') and n.endswith('.mmf'))
        return {Path(n).stem: zf.read(n) for n in names}


def write_wav(path: Path, pcm: bytes, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)


def find_wildmidi(explicit: str | None) -> str | None:
    if explicit:
        return explicit if Path(explicit).exists() else None
    return shutil.which('wildmidi')


def render_with_wildmidi(binary: str, mmf: Path, out_wav: Path) -> bool:
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run([binary, '-O', '-o', str(out_wav), str(mmf)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return result.returncode == 0 and out_wav.exists() and out_wav.stat().st_size > 44


def encode(ffmpeg: str, src_wav: Path, dst: Path, fmt: str) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    # 원본이 8000~11025Hz 모노라 22050Hz 모노면 충분하다.
    common = [ffmpeg, '-y', '-loglevel', 'error', '-i', str(src_wav), '-ac', '1', '-ar', '22050']
    if fmt == 'mp3':
        codec = ['-c:a', 'libmp3lame', '-b:a', '48k']
    elif fmt == 'ogg':
        codec = ['-c:a', 'libopus', '-b:a', '32k']
    else:
        raise ValueError(fmt)
    return subprocess.run(common + codec + [str(dst)]).returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description='원본 jar 의 SMAF 소리 52개를 뽑는다')
    parser.add_argument('--jar', type=Path, default=DEFAULT_JAR)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--work', type=Path, default=DEFAULT_WORK)
    parser.add_argument('--wildmidi', default=None, help='WildMIDI(-DWANT_MAFM=ON) 실행 파일')
    parser.add_argument('--format', choices=('mp3', 'ogg', 'wav'), default='mp3')
    parser.add_argument('--keep-wav', action='store_true', help='중간 wav 를 지우지 않는다')
    parser.add_argument('--info', action='store_true', help='청크 구조만 찍고 끝낸다')
    args = parser.parse_args()

    if not args.jar.exists():
        print(f'원본 jar 이 없다: {args.jar}', file=sys.stderr)
        return 1

    files = read_mmf_from_jar(args.jar)
    parsed = {name: Smaf(name, blob) for name, blob in files.items()}

    if args.info:
        counts: dict[str, int] = {}
        for name, smaf in parsed.items():
            print(f'=== {name}.mmf ({len(smaf.blob)}B) — {smaf.kind}')
            print('\n'.join('  ' + line for line in smaf.lines))
            counts[smaf.kind] = counts.get(smaf.kind, 0) + 1
        print('\n종류별 개수:', ', '.join(f'{k} {v}개' for k, v in sorted(counts.items())))
        print('원본 합계:', sum(len(b) for b in files.values()), 'B')
        return 0

    mmf_dir = args.work / 'mmf'
    wav_dir = args.work / 'wav'
    mmf_dir.mkdir(parents=True, exist_ok=True)
    for name, blob in files.items():
        (mmf_dir / f'{name}.mmf').write_bytes(blob)

    wildmidi = find_wildmidi(args.wildmidi)
    if wildmidi is None:
        print('WildMIDI 를 못 찾았다 — 스트림 ADPCM 만 뽑는다 (FM 악보형은 건너뛴다).')
        print('전부 뽑으려면 이 파일 머리의 빌드 설명을 보고 --wildmidi 로 경로를 준다.')

    rendered: list[str] = []
    skipped: list[str] = []
    for name in sorted(parsed):
        smaf = parsed[name]
        out_wav = wav_dir / f'{name}.wav'
        if wildmidi and render_with_wildmidi(wildmidi, mmf_dir / f'{name}.mmf', out_wav):
            rendered.append(name)
            continue
        if smaf.waves:
            head = smaf.waves[0]
            write_wav(out_wav, decode_yamaha_adpcm(head.data), head.sample_rate)
            rendered.append(name)
        else:
            skipped.append(name)

    if skipped:
        print(f'못 뽑은 {len(skipped)}개 (FM 악보뿐이라 파형이 없다): {", ".join(skipped)}')

    ffmpeg = shutil.which('ffmpeg')
    args.out.mkdir(parents=True, exist_ok=True)
    if args.format == 'wav' or ffmpeg is None:
        if ffmpeg is None and args.format != 'wav':
            print('ffmpeg 이 없다 — wav 로 둔다.')
        for name in rendered:
            shutil.copyfile(wav_dir / f'{name}.wav', args.out / f'{name}.wav')
    else:
        for name in rendered:
            if not encode(ffmpeg, wav_dir / f'{name}.wav', args.out / f'{name}.{args.format}',
                          args.format):
                print(f'인코딩 실패: {name}', file=sys.stderr)

    if not args.keep_wav and wav_dir.exists():
        shutil.rmtree(wav_dir)

    total = sum(p.stat().st_size for p in args.out.iterdir() if p.is_file())
    print(f'{len(rendered)}개를 {args.out} 에 넣었다 — 합계 {total / 1024:.0f}KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
