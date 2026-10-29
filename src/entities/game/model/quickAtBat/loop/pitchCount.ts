import type { AtBatOutcome } from '@/entities/game/model/quickAtBat/otherSlices'
import type { QuickAtBatPlay } from '@/entities/game/model/quickAtBat/types'

/** 타석 중 볼카운트 st[4]·st[5] 와 파울 표지 */
export interface PitchCount {
  readonly strikes: number
  readonly balls: number
  readonly fouled: boolean
}

export const START_COUNT: PitchCount = { strikes: 0, balls: 0, fouled: false }

/** 타석을 끝낸 공의 결과 — 헛스윙 세 번째 겨루기에서 타자가 이긴 아웃이면 표지가 붙는다 */
export interface AtBatEnding {
  readonly outcome: AtBatOutcome
  readonly swingingStrikeOutLost?: true
}

/** 공 하나를 던진 뒤 — 볼카운트(타석이 끝났으면 끝난 때의 카운트)와 끝났으면 그 결과 */
export interface PitchStep {
  readonly count: PitchCount
  readonly ending?: AtBatEnding
}

export const nextPitch = (count: PitchCount): PitchStep => ({ count })
export const endAtBat = (count: PitchCount, ending: AtBatEnding): PitchStep => ({ count, ending })

/** 끝난 타석의 기록 — 던진 공 수 · 끝난 때의 카운트 · 파울 표지 */
export function quickAtBatPlayOf(ending: AtBatEnding, pitches: number, count: PitchCount): QuickAtBatPlay {
  const play: QuickAtBatPlay = {
    outcome: ending.outcome,
    pitches,
    balls: count.balls,
    strikes: count.strikes,
    ...(count.fouled ? { fouled: true as const } : {}),
  }
  return ending.swingingStrikeOutLost === true ? { ...play, swingingStrikeOutLost: true } : play
}
