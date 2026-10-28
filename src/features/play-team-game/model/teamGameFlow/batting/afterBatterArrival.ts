import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import type { TeamPitchArrival } from '@/features/play-team-game/model/teamGameFlow/types/pitchArrival'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **사람 타석의 공 도착 뒤** — `batterPitch` 와, 화면이 실시간으로 돌린 주자 판이 끝난 뒤(`resolveRunnerPlay` 의 사람 공격 갈래)가 잇는다.
 * - 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18).
 * - 판정 A(0xae24c)의 "그 밖 → 0xf" — 같은 타석 다음 공. 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 묻는다.
 * - 타석이 끝났다 — 타석 결과(`applyOutcome`)로. 이 공이 연 판을 함께 넘긴다.
 */
export function continueOurAtBatAfterArrival(
  arrival: TeamPitchArrival,
  outcome: AtBatOutcome | null,
  random: RandomPort,
  options: BatterOutcomeOptions,
  applyOutcome: (progress: TeamGameProgress, outcome: AtBatOutcome, random: RandomPort, options: BatterOutcomeOptions) => TeamGameProgress,
): TeamGameProgress {
  if (arrival.interrupted) return advance(arrival.progress, random)
  if (outcome === null) return enterPitchSelection(arrival.progress, random)
  return applyOutcome(arrival.progress, outcome, random, { ...options, arrivalPlay: arrival.play })
}
