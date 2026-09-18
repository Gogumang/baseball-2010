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
  /** 0~4. 원본 속도 표 인덱스 */
  readonly speedLevel: number
  readonly pitchControl: PitchControl
}

/** 투구 기본값은 원본에서 못 찾았다 — 이전 웹판 동작(게이지)을 유지한다 (추정). */
export const DEFAULT_SETTINGS: GameSettings = {
  speedLevel: DEFAULT_SPEED_LEVEL,
  pitchControl: '게이지',
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

  return { speedLevel, pitchControl: pitchControl ?? DEFAULT_SETTINGS.pitchControl }
}
