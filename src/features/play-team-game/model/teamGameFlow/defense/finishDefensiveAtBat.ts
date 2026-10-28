import { type AtBatOutcome, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { resolveBurstFor, settlementBurstPlayOf } from '@/features/play-team-game/model/teamGameFlow/burst/resolveBurst'
import { type OpponentAtBatFacts, type QuickAtBatPlay, opponentAtBatFactsOf } from '@/features/play-team-game/model/teamGameFlow/defense/opponentAtBatFacts'
import { withOpponentAtBatSettlement } from '@/features/play-team-game/model/teamGameFlow/defense/opponentAtBatSettlement'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { halfInningPitchesOf } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withOurDefenseRecords } from '@/features/play-team-game/model/teamGameFlow/records/defenseRecords'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 상대 타석 하나를 경기 상태에 먹인다 — 예전 `applyDefensiveAtBat` 의 몸통이다.
 * `playback` 이 null 이면 재생할 것이 없다는 뜻이라 `lastDefensePlay` 는 그대로 둔다
 * (실시간으로 이미 다 보여 준 플레이가 여기로 온다 — 넣으면 같은 장면을 한 번 더 튼다).
 */
export function finishDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
  /**
   * 자동으로 넘긴 간이 타석(`playQuickPlateAppearance`)이 먹인 주자와 도루 — 볼넷 모든 주자 +1(c1918) · 도루(c1982) · 땅볼 진루
   * (0xc15b8)까지. 있으면 결과 링 아웃이 5 이고, 도루 주자마다 리그 기록 +0x2c 를 쌓는다.
   */
  quick?: QuickAtBatPlay,
  /**
   * 이 삼진과 **한 정산**인 도루 판(종류 5) — 판정 B 0xae3e8 이 정산 0xa8024 를 종류 5 로 한 번만 부른다(ae5a8).
   * 판의 진루는 `applyTeamArrival` 가 먼저 먹였다. 있으면 `stealSettlementOf` 의 거르기를 따른다.
   */
  stealPlay?: StealArrivalPlay,
  /**
   * 이 삼진과 **한 정산**인 폭투·포일 판(종류 9, 삼진 그대로 — `strikeoutStands`). 판정 B 가 state[0xc] == 5 라 정산을 종류 9 로
   * 부른다(ae596 → ae5a6) — 종류 9 는 거르기가 없고, 주자 목록 · 사건 목록은 그 판의 것이다. 판의 진루는 `applyTeamArrival` 가
   * 먼저 먹였다.
   */
  wildPitchPlay?: PitchArrivalPlay,
): TeamGameProgress {
  // 판정 — 이 타석이 경기에 남기는 사실
  const facts = opponentAtBatFactsOf(progress, outcome, defensePlay, quick, stealPlay, wildPitchPlay)
  // 적용 — 정산 0xa8024 의 칸들 · 기록달성(0xa7c4c · 0xa7998 · 0xa7d0c · 0xa8024 → 0xa77f0, 사람 수비라 수비 계열이 게이트를 지난다)
  const settled = withOpponentAtBatSettlement(progress, facts, outcome, mine, defensePlay, playback)
  const recorded = withOurDefenseRecords(settled, ourDefenseRecordPlayOf(progress, facts, outcome, defensePlay))
  // 돌발 판정 0x8f414(돌발, 0xa7749 = ctx+0x188) — 삼진 + 도루 판은 판정 A(0xae24c)가 state[0xb] 3·4 라 정산 없이 0x17 로 보내
  // 0x12 끝(4e7ca)의 판정이 비트 0 으로 돌고, 0x17 끝(52a8e)의 판정도 종류 5 정산이 비트를 안 켜(0xa599c a59a8) 0 으로 돈다.
  // ctx+0x188 을 지우는 곳은 타석 초기화 0xa5bcc(a5be0) 하나뿐이라 그 사이 다른 비트가 없다 → 8f41e 에서 그냥 돌아간다(판정 없음,
  // 돌발은 남는다). 웹도 판정을 건너뛰어 같은 결과다 — 남은 돌발은 다음 사람 타석 끝에 그 타석의 비트로 판정된다
  // (0x21 진입 · 0x18 뒤집힘이 먼저면 0x8f628 이 내린다)
  const resolved = mine && stealPlay === undefined ? resolveBurstFor(recorded, opponentAtBatBurstPlayOf(facts, outcome, defensePlay)) : recorded
  return appendLog(resolved, opponentAtBatLogOf(facts, outcome), mine)
}

function ourDefenseRecordPlayOf(
  progress: TeamGameProgress,
  facts: OpponentAtBatFacts,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
): Parameters<typeof withOurDefenseRecords>[1] {
  const { before, applied, stealPlayOuts, wildPitchPlay } = facts
  return {
    outcome,
    outsBefore: before.outs,
    outsAdded: applied.outsAdded,
    atBatPitches: progress.recordTally.atBatPitches,
    balls: progress.atBat.balls,
    halfInningPitches: halfInningPitchesOf(progress.recordTally, before),
    // state[0x8b] — 판의 결과 판이 세운 표시. 삼진과 한 정산인 도루 · 폭투 판이면 그 판의 것 (a80f8)
    laserOutFlag: (defensePlay ?? facts.runnerListPlay)?.laserOutFlag ?? false,
    ...(stealPlayOuts === undefined ? {} : { stealPlayOuts }),
    ...(wildPitchPlay === undefined ? {} : { wildPitchPlayOuts: wildPitchPlay.result.advance.outsAdded }),
    ...(facts.droppedThirdStrike ? { droppedThirdStrike: true } : {}),
  }
}

function opponentAtBatBurstPlayOf(facts: OpponentAtBatFacts, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null) {
  const { before, applied } = facts
  return settlementBurstPlayOf({
    outcome,
    runsBattedIn: applied.runsScored,
    outsBefore: before.outs,
    outsAdded: applied.outsAdded,
    droppedThirdStrike: facts.droppedThirdStrike,
    // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
    humanTeamWalkOff: applied.game.isFinished && applied.game.ourScore > applied.game.opponentScore,
    defensePlay,
    homeRunCounted: facts.homeRunCounted,
  })
}

function opponentAtBatLogOf(facts: OpponentAtBatFacts, outcome: AtBatOutcome): string {
  const { before, applied } = facts
  const runsText = applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
  return `${before.inning}회${before.half} 상대 ${facts.slot + 1}번 — ${describeOutcome(outcome)}${runsText}`
}
