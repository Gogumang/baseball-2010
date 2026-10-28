import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { ourAtBatFactsOf, type OurAtBatFacts } from '@/features/play-team-game/model/teamGameFlow/batting/ourAtBatFacts'
import { withOurAtBatSettlement } from '@/features/play-team-game/model/teamGameFlow/batting/ourAtBatSettlement'
import { resolveBurstFor, settlementBurstPlayOf } from '@/features/play-team-game/model/teamGameFlow/burst/resolveBurst'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 사람 타석 하나를 경기 상태에 먹이고 다음 사람 차례까지 민다 — 예전 `applyBatterOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * **실시간으로 이미 다 보여 준 플레이는 null** 이고, 홈런은 부르는 쪽이 비행 틱을 만들어 넘긴다.
 */
export function finishBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
  /**
   * 이 삼진과 **한 정산**인 도루 판(종류 5) — 정산 0xa8024 를 종류 5 로 한 번만 부른다(ae5a8). 판의 진루는 `applyTeamArrival` 가
   * 먼저 먹였다. 있으면 종류 4·5 가 건너뛰는 칸(범타·삼진 갈래 a8a04 의 결과 링 · ctx+0x162 지우기 · 시즌 코드 6, a8ac8 타석 칸 +0x14,
   * a8852 리그 타수 +0x20, 돌발 비트 0xa599c)을 안 센다. 상대 투수 줄의 아웃 · 탈삼진(a8cb0 · a8d14)은 그대로 센다.
   */
  stealPlay?: StealArrivalPlay,
): TeamGameProgress {
  // 판정 — 이 타석이 경기에 남기는 사실(점수 · 아웃 · 낫아웃 · 홈런 게이트)
  const facts = ourAtBatFactsOf(progress, outcome, defensePlay, stealPlay)
  // 적용 — 정산 0xa8024 의 칸들
  const settled = withOurAtBatSettlement(progress, facts, outcome, defensePlay, playback)
  // 돌발 결과 비트 0xa599c 는 종류 4·5 정산이면 안 켠다 — 0x12 끝 · 0x17 끝의 0x8f414 가 비트 0 으로 돌아 판정이 없다
  // (`finishDefensiveAtBat` 의 같은 자리 주석)
  const resolved = facts.runnerPlay ? settled : resolveBurstFor(settled, ourAtBatBurstPlayOf(facts, outcome, defensePlay))
  return advance(appendLog(resolved, ourAtBatLogOf(facts, outcome), true), random)
}

function ourAtBatBurstPlayOf(facts: OurAtBatFacts, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null) {
  const { before, game, runsBattedIn } = facts
  return settlementBurstPlayOf({
    outcome,
    runsBattedIn,
    outsBefore: before.outs,
    outsAdded: facts.outsAdded,
    droppedThirdStrike: facts.droppedThirdStrike,
    humanTeamWalkOff: game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore,
    defensePlay,
    homeRunCounted: facts.homeRunCounted,
  })
}

function ourAtBatLogOf(facts: OurAtBatFacts, outcome: AtBatOutcome): string {
  const { before, runsBattedIn } = facts
  const runsText = runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
  return `${before.inning}회${before.half} ${lineupSlotOf(facts.slot) + 1}번 — ${describeOutcome(outcome)}${runsText}`
}
