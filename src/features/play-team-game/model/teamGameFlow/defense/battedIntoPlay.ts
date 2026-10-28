import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { isBattedBallInPlay } from '@/features/defense-play/model/runDefensePlay'

/**
 * 이 타석 결과가 **수비 판을 도는 맞은 공**인가 — 쏜 패턴이 따라온 결과는 판정 11(2스트라이크 번트 파울 아웃)도 파울 각 공 판이
 * 내므로 맞은 공이면 모두 판을 돈다(`isBattedBallKind`). 패턴이 없는 결과(시험 · 옛 호출)는 인플레이 결과만(`isBattedBallInPlay`)
 */
export function isBattedIntoPlay(outcome: AtBatOutcome, pattern: BattedBallPattern | undefined): boolean {
  return pattern !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome)
}
