import {
  DEFAULT_SPEED_LEVEL,
  MILLISECONDS_PER_FRAME_BY_SPEED,
} from '@/shared/config/frameRate'

/**
 * 원작 환경설정 (StrMAINMENU[32]~[42], [63]~[81], StrHOWTO[30]).
 *
 * 웹판에서 효과가 있는 항목만 둔다:
 *   속도 — 원본 속도 표 다섯 단계
 *   투구 — 기본(게이지 OFF) / 게이지(ON). "게이지를 사용하면 기본 투구보다 더욱 강한 공"
 * 사운드·진동은 웹판에 소리·진동이 없어 뺐고, 주루·송구·전광판은 해당 플레이가 생기면 붙인다.
 */
export type PitchControl = '기본' | '게이지'

export const PITCH_CONTROLS: readonly PitchControl[] = ['기본', '게이지']

export const SPEED_LEVEL_COUNT = MILLISECONDS_PER_FRAME_BY_SPEED.length

export interface GameSettings {
  /** 0~4. 원본 속도 표 인덱스 (옵션 +0x2f) */
  readonly speedLevel: number
  readonly pitchControl: PitchControl
  /**
   * 소리 크기 0~4 (옵션 +0x2e, 기본 2 → ×25 = 50). 웹에는 아직 소리가 없어 값만 들고 있다 —
   * 원본 환경설정 화면에 줄이 있으므로 화면도 그대로 보여 준다 (F-8·P6 5절).
   */
  readonly soundLevel: number
  /** 진동 (옵션 +0x3b, 기본 켬). 웹에는 진동이 없어 값만 들고 있다 */
  readonly isVibrationOn: boolean
}

/** 소리 크기 칸 수 — 막대 그림 98~101 이 네 장이다 */
export const SOUND_LEVEL_COUNT = 5

/** 투구 기본값은 원본에서 못 찾았다 — 이전 웹판 동작(게이지)을 유지한다 (추정). */
export const DEFAULT_SETTINGS: GameSettings = {
  speedLevel: DEFAULT_SPEED_LEVEL,
  pitchControl: '게이지',
  // 원본 생성자 값 — 소리 크기 +0x2e = 2, 진동 +0x3b = 1 (F-9)
  soundLevel: 2,
  isVibrationOn: true,
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

  return {
    speedLevel,
    pitchControl: pitchControl ?? DEFAULT_SETTINGS.pitchControl,
    soundLevel,
    isVibrationOn:
      typeof candidate.isVibrationOn === 'boolean' ? candidate.isVibrationOn : DEFAULT_SETTINGS.isVibrationOn,
  }
}
