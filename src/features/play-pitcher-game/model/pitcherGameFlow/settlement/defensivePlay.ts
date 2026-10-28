import { createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RunnerPitcherSettlement } from '@/entities/game/model/runnerPitchers'
import { addInningRuns } from '@/features/play-pitcher-game/model/pitcherGameState'
import { resolveBurstFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstResult'
import { closeDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/closeDefensivePlay'
import {
  type DefensivePlayFacts,
  type DefensivePlaySources,
  defensivePlayFactsOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayFacts'
import {
  opponentLineupAfterPlayOf,
  teamBaserunnerAllowedAfterPlayOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayRecords'
import { myPitcherAfterPlayOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/myPitcherAfterPlay'
import { withLeaguePlateAppearance } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { decisionAfterRunsOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { pitcherLinesChargedOf, runnerSettlementOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerSettlement'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/* ── 수비 타석 하나 ───────────────────────────────────────────────────────────── */

/**
 * 상대 타석 하나를 경기에 반영한다.
 * `mine` 이 참이면 내가 던진 타석이라 투수 기록·돌발 판정까지 함께 한다.
 *
 * `balls` 는 타석이 끝났을 때의 볼 카운트 (풀카운트 삼진 17 판정).
 * `progress.atBatPitches`·`progress.halfInningPitches` 는 부르는 쪽이 이미 올려 두었다.
 *
 * ⚠️ 난수를 받지 않는다 — 수비 시뮬레이션 굴림은 부르는 쪽이 이미 다 돌린 뒤라 여기서는
 * 그 결과를 먹이기만 한다.
 */
export function applyDefensivePlay(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  balls: number,
  sources: DefensivePlaySources,
): PitcherGameProgress {
  // 판정 — 이 타석이 경기에 남기는 사실
  const facts = defensivePlayFactsOf(progress, outcome, mine, sources)
  // 적용 — 정산 0xa8024 의 칸들
  const settled = withDefensivePlaySettlement(progress, facts, outcome, balls, sources)
  const resolved = isBurstJudgedAfter(facts) ? resolveDefensivePlayBurst(settled, facts, outcome, sources) : settled
  return closeDefensivePlay(resolved, facts, outcome)
}

/**
 * 0x8f414 는 사람 장면의 타석 끝(0x12 갱신 0x4e6d4 · 0x17 끝 0x528b0)에서만 돈다 — 내가 던진 타석만.
 * 내가 마운드에 없는 타석은 간이 엔진(0x21)이라 판정이 없다 (`rollBurstAtPrep` 머리말)
 * 삼진 + 도루 판은 판정 A(0xae24c)가 state[0xb] 3·4 라 정산 없이 0x17 로 보내고, 0x17 끝 정산은 종류 5 라 결과비트를 안 켠다
 * (0xa599c a59a8) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 0x8f414 가 비트 0 으로 돌아 판정이 없고 돌발은 남는다(8f41e)
 */
function isBurstJudgedAfter(facts: DefensivePlayFacts): boolean {
  return facts.mine && !facts.stealPlaySettlement
}

function resolveDefensivePlayBurst(
  settled: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  sources: DefensivePlaySources,
): PitcherGameProgress {
  const { applied, before } = facts
  // 결과비트 B8 · B10 · B5 가 보는 [sp+0x30] — 낫아웃은 삼진 사건이 하나 더 든다
  return resolveBurstFor(
    settled,
    outcome,
    applied.runsScored,
    before.outs,
    facts.settledOuts,
    sources.defensePlay,
    facts.homeRunCounted,
    facts.droppedThirdStrike,
  )
}

function withDefensivePlaySettlement(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  balls: number,
  sources: DefensivePlaySources,
): PitcherGameProgress {
  const runnerSettlement = runnerSettlementOf(progress, facts, outcome, sources.defensePlay)
  return {
    ...progress,
    ...scoreboardAfterPlayOf(progress, facts, sources),
    ...myPitcherAfterPlayOf(progress, facts, outcome, { balls, sources, runnerSettlement }),
    ...teamDefenseAfterPlayOf(progress, facts, outcome, { sources, runnerSettlement }),
    ...opponentLineupAfterPlayOf(progress, facts, outcome, sources.quick !== undefined),
    atBat: createAtBat(),
    atBatPrepared: false,
    // 정산 0xa8024 — 0xa56dc(ctx, 지금 타자, 0) 이면 상대 타자 레코드 +0x20~+0x2a (마타자 칸은 거짓)
    // 종류 5 정산은 a8856 이 상대 타자 리그 기록(+0x20 타수 …)을 건너뛴다
    ...(facts.stealPlaySettlement ? {} : withLeaguePlateAppearance(progress, false, facts.slot, outcome, facts.applied.runsScored)),
  }
}

/** 점수판 · 타순 · 승패 칸 · 재생 칸 */
function scoreboardAfterPlayOf(progress: PitcherGameProgress, facts: DefensivePlayFacts, sources: DefensivePlaySources) {
  const { before, applied } = facts
  return {
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    decision: decisionAfterRunsOf(progress, applied.runsScored, facts.mine),
    lastDefensePlay: sources.playback ?? progress.lastDefensePlay,
    defenseScene: sources.defensePlay?.scene ?? progress.defenseScene,
    atBatPitches: 0,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    endedInningIndex: applied.game.inning - 1,
  }
}

/** 우리 팀 수비 칸 — 루별 책임 투수 · 동료 투수 실점 줄 · state[0x88]~[0x8a] · 삼자범퇴 표시 R+0x184 */
function teamDefenseAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  play: { readonly sources: DefensivePlaySources; readonly runnerSettlement: RunnerPitcherSettlement },
) {
  return {
    runnerPitchers: play.runnerSettlement.tags,
    // 동료 투수가 내보낸 주자의 실점은 그 동료 줄(+0x22)에 — 내 줄(`MY_PITCHER_SLOT`)은 커리어가 센다
    pitcherLines: pitcherLinesChargedOf(progress, play.runnerSettlement.charged),
    teamHitsAllowed: progress.teamHitsAllowed + (facts.hit ? 1 : 0),
    teamBaserunnerAllowed: teamBaserunnerAllowedAfterPlayOf(progress, facts, outcome, play.sources),
    teamRunsAllowed: progress.teamRunsAllowed + facts.applied.runsScored,
    perfectInningFlag: facts.perfectInningFlag,
  }
}
