import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 선수 +0x1f0 u16[0..3] — 완투 계열 횟수 (통산, 새 시즌에도 지우지 않는다) */
export interface CompleteGameCounts {
  readonly perfect: number
  readonly noHitter: number
  readonly shutout: number
  readonly completeGame: number
}

export const EMPTY_COMPLETE_GAME_COUNTS: CompleteGameCounts = { perfect: 0, noHitter: 0, shutout: 0, completeGame: 0 }

const COMPLETE_GAME_COUNT_KEY = {
  퍼펙트: 'perfect',
  노히트: 'noHitter',
  완봉: 'shutout',
  완투: 'completeGame',
} as const

/** 완투 계열 한 번을 센다 (0xa6b54~0xa6c1a, u16 — 65535 를 넘으면 원본은 0 으로 돈다) */
export function countCompleteGame(career: PitcherCareer, kind: keyof typeof COMPLETE_GAME_COUNT_KEY | '없음'): PitcherCareer {
  if (kind === '없음') return career
  const key = COMPLETE_GAME_COUNT_KEY[kind]
  return {
    ...career,
    completeGameCounts: { ...career.completeGameCounts, [key]: (career.completeGameCounts[key] + 1) & 0xffff },
  }
}
