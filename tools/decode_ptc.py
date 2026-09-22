#!/usr/bin/env python3
"""
게임빌 파티클 설정 `.ptc` 26개를 JSON 하나로 뽑는다.

    python3 tools/decode_ptc.py [--jar base/work/jar] [-o public/sprites/ptcimg/particles.json]
    python3 tools/decode_ptc.py --check          # 파일만 검산하고 아무것도 쓰지 않는다

해독한 포맷 (근거: R5-font-particles.md 7~9절 · L-sound-effects.md 5-A · CORRECTIONS.md 2절)

  ptc/%03d.ptc — **51바이트 고정**. 발생 함수 0xbbc84 가 `sprintf("ptc/%03d.ptc", id+1)` 로 골라
  0x6d2b4 가 파일 51바이트를 이미터 +0x24.. 에 **그대로 memcpy** 한다. 즉 파일 배치 = 이미터 배치.

      오프셋  형    이름     뜻 (읽는 코드: 만들기 0x6d56c · 갱신 0x6d878 · 틱 0x6dad0 · 그리기 0x6dc4c)
      0x00    s16   ang      방향(도). 0=오른쪽 90=아래 180=왼쪽 270=위 (화면 y 는 아래로)
      0x02    u16   spread   방향 폭: ang + rand(spread+1) − spread/2 (360 = 사방)
      0x04    u32   spd      속력 (16.16)
      0x08    u32   spdR     속력 흔들림 ±spdR/2
      0x0c    u16   emit     틱마다 새로 만들 입자 수
      0x0e    u16   emitR    그 흔들림 ±emitR/2
      0x10    u16   life     수명(틱)
      0x12    u16   lifeR    수명 흔들림 ±lifeR/2
      0x14    u32   a0       시작 값 A (16.16)
      0x18    u32   a0R      흔들림 ±a0R/2
      0x1c    u32   a1       끝 값 A (±a1R/2). 틱마다 A += (a1 − a0)/life
      0x20    u32   a1R
      0x24    s32   ax       틱마다 vx += ax (가로 가속)
      0x28    s32   ay       틱마다 vy += ay (세로 가속, + 면 아래 = 중력)
      0x2c    u16   w        발생 범위: 처음 위치 x += (rand(w+1) − w/2)/4 px
      0x2e    u16   h        y 도 같게
      0x30    u16   total    이 이미터가 평생 만들 입자 총수 (호출 인자 total ≠ −1 이면 덮어씀)
      0x32    u8    mode     그리기 가상함수(+0x14) 의 4번째 인자 그대로

  ⚠️ **배치는 확정, 뜻이 다 확정은 아니다.**
     `a0/a0R/a1/a1R` 은 갱신식·그리기 인자(A>>8, 0~256)까지 확정이지만 **그 값이 무엇인지**는
     "불투명도 또는 세기" 로 유력일 뿐이다 (그리는 쪽 이미지 클래스 +0x14 구현을 못 찾았다).
     `mode` 도 "0 = 그냥 그리기 / 2 = A 를 쓰는 섞기" 가 유력이다.
     그래서 JSON 에는 **뜻 이름을 붙이지 않고 문서의 글자 이름(a0·mode)** 만 쓰고,
     아직 이름을 못 붙인 칸까지 남김없이 남기려고 `raw` 에 **51바이트 그대로**를 함께 적는다
     (generate_game_data.py 의 `D_LEVEL` + `D_LEVEL_RAW` 와 같은 방식).

  파트 그림은 이 파일에 없다. 입자 그림은 호출 인자 `img` = ptc/ptcimg.pzx 의 **프레임 번호**이고,
  그리기 0x6dc4c 가 그 프레임의 **파트[ life % 파트수 ]** 를 쓴다. 그래서 웹에서 쓸 그림은
  `public/sprites/ptcimg/000~050.png`(파트 51장)이고, `ptcimg/frames/*.png` 는 파트를 **겹쳐
  합성한** 그림이라 파티클용으로는 못 쓴다.
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

PTC_LAYOUT = '<hHIIHHHHIIIIiiHHHB'
PTC_SIZE = struct.calcsize(PTC_LAYOUT)  # = 51
PTC_COUNT = 26

# 위 표의 순서 그대로. 이름은 R5-font-particles.md 8절의 이름을 그대로 쓴다.
PTC_FIELDS = (
    'ang', 'spread', 'spd', 'spdR', 'emit', 'emitR', 'life', 'lifeR',
    'a0', 'a0R', 'a1', 'a1R', 'ax', 'ay', 'w', 'h', 'total', 'mode',
)

# 발생 함수 0xbbc84 는 `cmp r2,#0x18 ; bls` 로 **id ≤ 0x18(24) 만** 받는다.
# id → 파일은 id+1 이므로 026.ptc(= id 25)는 코드에서 부를 수 없는 에셋이다 (L-sound-effects.md 5-A).
CALLABLE_ID_MAX = 0x18

FIXED_POINT_FIELDS = ('spd', 'spdR', 'a0', 'a0R', 'a1', 'a1R', 'ax', 'ay')


def read_emitter(path: Path) -> dict:
    """`.ptc` 하나를 읽는다. 51바이트가 아니면 터뜨린다 — 배치가 어긋나면 값이 조용히 밀린다."""
    raw = path.read_bytes()
    if len(raw) != PTC_SIZE:
        raise ValueError(f'{path.name}: 크기가 {PTC_SIZE} 가 아닙니다: {len(raw)}')

    values = dict(zip(PTC_FIELDS, struct.unpack(PTC_LAYOUT, raw)))
    call_id = int(path.stem) - 1  # 0xbbc84 가 sprintf("ptc/%03d.ptc", id+1) 로 고른다

    emitter = {
        'file': path.stem,
        'callId': call_id,
        # 코드가 이 id 를 부를 수 있는지. 값이 아니라 **호출 관문**이다 (0xbbca4).
        'callable': call_id <= CALLABLE_ID_MAX,
    }
    emitter.update(values)
    emitter['raw'] = list(raw)
    return emitter


def read_all(jar_root: Path) -> list[dict]:
    """ptc/001~026.ptc 를 전부 읽는다. 개수가 26이 아니면 터뜨린다."""
    directory = jar_root / 'ptc'
    paths = sorted(directory.glob('*.ptc'))
    if len(paths) != PTC_COUNT:
        raise ValueError(f'{directory}: .ptc 개수가 {PTC_COUNT} 가 아닙니다: {len(paths)}')

    expected = [f'{index + 1:03d}' for index in range(PTC_COUNT)]
    found = [path.stem for path in paths]
    if found != expected:
        raise ValueError(f'{directory}: 파일 이름이 001~{PTC_COUNT:03d} 가 아닙니다: {found}')

    return [read_emitter(path) for path in paths]


def build(jar_root: Path, emitters: list[dict]) -> dict:
    """JSON 몸통. `_meta` 에 근거·단위·**무엇이 유력인지**를 같이 남긴다."""
    return {
        '_meta': {
            'source': f'{jar_root.as_posix()}/ptc/001~{PTC_COUNT:03d}.ptc (각 {PTC_SIZE}바이트)',
            'tool': 'tools/decode_ptc.py',
            'size': PTC_SIZE,
            'layout': PTC_LAYOUT,
            'evidence': (
                'R5-font-particles.md 7~9절 · L-sound-effects.md 5-A · CORRECTIONS.md 2절 — '
                '배치는 확정 (만들기 0x6d56c · 갱신 0x6d878 · 이미터 틱 0x6dad0 · 그리기 0x6dc4c). '
                '파일 51바이트는 0x6d2b4 가 이미터 +0x24.. 에 그대로 memcpy 한다.'
            ),
            # 이름과 뜻이 코드로 확인된 칸
            'confirmedFields': [
                'ang', 'spread', 'spd', 'spdR', 'emit', 'emitR', 'life', 'lifeR',
                'ax', 'ay', 'w', 'h', 'total',
            ],
            # 배치·쓰이는 식은 확정이지만 **뜻**은 유력인 칸. 뜻 이름을 붙이지 않았다.
            'likelyOnlyFields': {
                'a0/a0R/a1/a1R': (
                    '갱신식 확정: A 는 a0±a0R/2 에서 시작해 틱마다 (a1−a0)/life 만큼 움직이고 '
                    '그리기에 A>>8 (0~256) 로 넘어간다. **그 값이 무엇인지는 유력** — '
                    '불투명도 또는 세기로 보인다 (그리는 쪽 +0x14 구현 미확인). alpha 로 이름 붙이지 않았다.'
                ),
                'mode': (
                    '그리기 가상함수(+0x14) 의 4번째 인자 그대로. 001 만 0, 나머지 25개는 2. '
                    '"0 = 그냥 그리기 / 2 = A 를 쓰는 섞기" 는 **유력** — 숫자만 남긴다.'
                ),
            },
            'units': {
                'ang/spread': '도(°). 화면 y 는 아래로 (0=오른쪽 90=아래 180=왼쪽 270=위)',
                'spd/spdR/ax/ay': '16.16 고정소수 → 값/65536. px/틱 = 값/512 (엔진 내부 1/512 px)',
                'a0/a0R/a1/a1R': '16.16 고정소수 → 값/65536. 그리기에는 (값>>8) = 0~256 으로 넘어간다',
                'life/lifeR': '틱. 입자는 life=L 로 한 번 그려진 뒤 L−1..0 까지 **L+1 번** 보인다',
                'w/h': '발생 범위. 처음 위치가 ±(rand(값+1) − 값/2)/4 px 만큼 흩어진다',
            },
            'callableIdMax': CALLABLE_ID_MAX,
            'imageNote': (
                '입자 그림은 이 파일에 없다 — 호출 인자 img(= ptcimg.pzx 프레임 번호)의 '
                '파트[ life % 파트수 ]를 쓴다. 파트 그림은 public/sprites/ptcimg/000~050.png 51장이고, '
                'ptcimg/frames/*.png 는 파트를 겹쳐 합성한 그림이라 파티클용으로 못 쓴다.'
            ),
            'rawNote': (
                f'raw 는 파일 {PTC_SIZE}바이트 그대로다 — 이름 붙인 칸을 다시 확인하거나 '
                '뜻이 뒤집혔을 때 다시 읽으려고 남긴다.'
            ),
        },
        'emitters': emitters,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='파티클 설정 .ptc 26개를 JSON 으로 뽑는다')
    parser.add_argument('--jar', type=Path, default=Path('base/work/jar'))
    parser.add_argument('-o', '--output', type=Path,
                        default=Path('public/sprites/ptcimg/particles.json'))
    parser.add_argument('--check', action='store_true', help='검산만 하고 쓰지 않는다')
    arguments = parser.parse_args()

    emitters = read_all(arguments.jar)
    print(f'.ptc {len(emitters)}개 × {PTC_SIZE}바이트 검산 통과')

    modes = sorted({emitter['mode'] for emitter in emitters})
    blocked = [emitter['file'] for emitter in emitters if not emitter['callable']]
    print(f'  mode 값 {modes} · 코드에서 못 부르는 파일 {blocked or "없음"}')

    if arguments.check:
        return 0

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(build(arguments.jar, emitters), ensure_ascii=False, indent=1)
    arguments.output.write_text(body + '\n', encoding='utf-8')
    print(f'→ {arguments.output}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
