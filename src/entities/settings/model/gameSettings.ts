import {
  DEFAULT_SPEED_LEVEL,
  MILLISECONDS_PER_FRAME_BY_SPEED,
} from '@/shared/config/frameRate'

/**
 * 원작 환경설정 (StrMAINMENU[32]~[42], [63]~[81], StrHOWTO[30]).
 * 필드·기본값 근거: K-bursts-special.md K-5·5-2 · P6-screens.md 5절.
 *
 * 웹판에서 실제로 배선된 항목:
 *   속도 — 원본 속도 표 다섯 단계
 *   투구 — 기본(게이지 OFF) / 게이지(ON). "게이지를 사용하면 기본 투구보다 더욱 강한 공"
 *   사운드 — soundLevel × 25 를 SoundPort.setVolume 에 넘긴다
 * 그 밖(진동·주루·송구·전광판)은 웹판에 해당 플레이·배선이 아직 없어 **값만** 들고 있다 —
 * 원본 환경설정 화면에는 줄이 있으므로 칸은 그대로 둔다.
 */
export type PitchControl = '기본' | '게이지'

export const PITCH_CONTROLS: readonly PitchControl[] = ['기본', '게이지']

/** 주루·송구 공용 라벨 — 원본 값 0 = 수동, 1 = 자동 (K-bursts-special.md 5-2) */
export type ManualAutoMode = '수동' | '자동'

export const MANUAL_AUTO_MODES: readonly ManualAutoMode[] = ['수동', '자동']

export const SPEED_LEVEL_COUNT = MILLISECONDS_PER_FRAME_BY_SPEED.length

export interface GameSettings {
  /** 0~4. 원본 속도 표 인덱스 (옵션 +0x2f) */
  readonly speedLevel: number
  /** 투구 기본/게이지 (옵션 +0x2d, 원본 기본 0 = 기본) */
  readonly pitchControl: PitchControl
  /**
   * 소리 크기 0~4 (옵션 +0x2e, 기본 2 → ×25 = 50). soundLevel × 25 → SoundPort.setVolume 로 이미 배선됐다.
   */
  readonly soundLevel: number
  /** 진동 (옵션 +0x3b, 기본 켬). 웹에는 아직 진동 배선이 없어 값만 들고 있다 */
  readonly isVibrationOn: boolean
  /**
   * 주루 수동/자동 (옵션 +0xbd, 기본 자동). **양쪽 다 옮겼다.**
   *
   * 값을 읽어 갈림을 만드는 곳은 매 틱 도는 경기 장면 슬롯 2 = `0x524c0` 안이다 (직접 뜬 것):
   * ```
   * 5261c: 설정 = 0x1f1d8([0x1400054])
   * 52628: r1 = 설정+0xbd
   * 5262e: bl 0xae690([장면+0x214], r1)
   *        ae692: r2 = [x+0x174] = 경기 ; 공격측 = 경기[9](부호 있는 바이트)
   *        ae6a6: 반환 = (경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)
   * 52638: 그 값이 0 이면 — 플레이+0x111(끝남) · 플레이+0x129 · 종류 7(홈런더비)만 예외로 통과
   * 52660: 0xaf8c0(제어기 = 장면+0x210, 0) = 제어기.vt8 = 0xaf918 자동 추가 진루
   * ```
   * 곧 **"사람이 공격하면서 설정이 수동이면 자동 진루 제어기를 아예 안 돌린다"**.
   * 바로 아래 0x5269c 가 같은 꼴로 `설정+0xf4`(송구) → `0xae6c8`(수비측) → `0xaf8e0`
   * (= vt0xc = 0xafa60 CPU 송구) 를 가른다.
   *
   * ⚠️ **`경기+0x24` 는 이 갈림과 상관없다** — 예전 주석(과 I 3b)이 "수동이면 경기+0x24 = 0 이라
   *    CPU 가 주자를 안 굴린다" 고 적었지만, `.text` 에서 `경기+0x24` 바이트를 만지는 24곳을
   *    전부 떠 보면 **읽는 곳이 `0x3e0e6` 과 `0x521fa` 둘뿐**이고 둘 다 자동 진루와 무관하다:
   *    `0x3e0e6` 은 투구가 도착한 뒤(상태 0x12 진입) **플레이 종류 5(주자 움직임만)로 수비 화면을
   *    열지 말지**를 가르고(S8 5-3 의 state[0x24] "도루 중"이 같은 칸), `0x521fa` 는 도루 메시지
   *    처리에서 `경기[0x14+루]`·`경기[0x90+루]` 를 세울지 가른다.
   *    게다가 `0x5209e`(진루 키)·`0x5222a`(귀루 키)가 `경기+0x24 = 0` 으로 지운 직후
   *    `0xa9b04` 가 주자를 실제로 옮기면 `0xa9b86`/`0xa9ba8` 이 곧바로 **1 로 되돌린다** —
   *    "그 플레이만 수동으로 굳는" 빗장이 아니다.
   *
   * 배선: `DefensePlayInput.runningMode`(+ `offenseIsCpu`) 로 넘긴다. 안 넘기면 자동이다.
   */
  readonly runningMode: ManualAutoMode
  /** 송구 수동/자동 (옵션 +0xf4, 기본 수동). 웹에는 아직 송구 조작이 없어 값만 들고 있다 */
  readonly throwMode: ManualAutoMode
  /** 전광판 표시 여부 (옵션 +0x3a, 기본 켬). 웹에는 아직 전광판이 없어 값만 들고 있다 */
  readonly isScoreboardOn: boolean
}

/**
 * 원본 "터치"(StrMAINMENU[73], 좌/우 라벨) 는 옮기지 않는다 —
 * P7-leftovers.md K2(확정): 상세 설정 그리기 루프는 4줄뿐이고 다섯째 값(옵션 +0x14c)은
 * 읽기만 하고 그리지 않는다. **이 빌드에서 화면에 없는 문구다.**
 * 옵션 +0x2c 도 "손잡이 방향"이 아니라 **CPU 투구 패턴 난이도**(easy/normal/hard, 기본 2 = hard) —
 * 이 값을 바꾸는 화면도 원본 환경설정에 없다(K2). 둘 다 환경설정 칸으로 넣지 않는다.
 */

/** 소리 크기 칸 수 — 막대 그림 98~101 이 네 장이다 */
export const SOUND_LEVEL_COUNT = 5

/** 투구 기본값은 원본 상세 설정 기본(칸 0, 게이지 OFF) 이다 — 문서 등급 유력 (K-bursts-special.md K-5 5-2). */
export const DEFAULT_SETTINGS: GameSettings = {
  speedLevel: DEFAULT_SPEED_LEVEL,
  pitchControl: '기본',
  // 원본 생성자 값 — 소리 크기 +0x2e = 2, 진동 +0x3b = 1 (F-9)
  soundLevel: 2,
  isVibrationOn: true,
  // 원본 기본값 — 주루 +0xbd = 1(자동), 송구 +0xf4 = 0(수동), 전광판 +0x3a = 1(켬) (K-bursts-special.md 5-2)
  runningMode: '자동',
  throwMode: '수동',
  isScoreboardOn: true,
}

/** 저장소에서 읽은 값은 믿지 않는다. 항목별로 검사하고 틀리면 기본값을 쓴다. */
export function normalizeSettings(raw: unknown): GameSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const candidate = raw as Partial<Record<keyof GameSettings, unknown>>

  const speedLevel =
    typeof candidate.speedLevel === 'number' &&
    Number.isInteger(candidate.speedLevel) &&
    candidate.speedLevel >= 0 &&
    candidate.speedLevel < SPEED_LEVEL_COUNT
      ? candidate.speedLevel
      : DEFAULT_SETTINGS.speedLevel
  const pitchControl = PITCH_CONTROLS.find((control) => control === candidate.pitchControl)
  const soundLevel =
    typeof candidate.soundLevel === 'number' &&
    Number.isInteger(candidate.soundLevel) &&
    candidate.soundLevel >= 0 &&
    candidate.soundLevel < SOUND_LEVEL_COUNT
      ? candidate.soundLevel
      : DEFAULT_SETTINGS.soundLevel
  const runningMode = MANUAL_AUTO_MODES.find((mode) => mode === candidate.runningMode)
  const throwMode = MANUAL_AUTO_MODES.find((mode) => mode === candidate.throwMode)

  return {
    speedLevel,
    pitchControl: pitchControl ?? DEFAULT_SETTINGS.pitchControl,
    soundLevel,
    isVibrationOn:
      typeof candidate.isVibrationOn === 'boolean' ? candidate.isVibrationOn : DEFAULT_SETTINGS.isVibrationOn,
    runningMode: runningMode ?? DEFAULT_SETTINGS.runningMode,
    throwMode: throwMode ?? DEFAULT_SETTINGS.throwMode,
    isScoreboardOn:
      typeof candidate.isScoreboardOn === 'boolean' ? candidate.isScoreboardOn : DEFAULT_SETTINGS.isScoreboardOn,
  }
}
