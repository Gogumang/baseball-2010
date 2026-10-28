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
  pitcherRecordAfterPlay,
  playedRecordOf,
  playRecordIdsOf,
  teamBaserunnerAllowedAfterPlayOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayRecords'
import { withLeaguePlateAppearance } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { decisionAfterRunsOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { pitcherLinesChargedOf, runnerSettlementOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerSettlement'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

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
 * 내가 마운드에 없는 타석은 간이 엔진(0x21)이라 판정이 없다 (`triggerBurstAtPrep` 머리말)
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
  return resolveBurstFor(settled, outcome, applied.runsScored, before.outs, facts.settledOuts, sources.defensePlay, facts.homeRunCounted, facts.droppedThirdStrike)
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

/**
 * 내 투수 칸 — R(0xa57f8) · 레코드 +0x20 ~ +0x2a · 0xb8cec 의 마운드 투수 R[0](삼진)·R[1](연속 삼진) · 기록달성 번호.
 * R[0]·R[1] 은 삼진 아닌 결과로 끝난 타석마다 콤보가 끊긴다 (R8 5-5).
 */
function myPitcherAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  play: { readonly balls: number; readonly sources: DefensivePlaySources; readonly runnerSettlement: RunnerPitcherSettlement },
) {
  const countsMine = facts.mine && facts.counts
  const chargedToMe = facts.counts ? play.runnerSettlement.charged.filter((pitcher: number) => pitcher === MY_PITCHER_SLOT).length : 0
  const playedRecord = playedRecordOf(progress, facts, outcome)
  const strikeouts = moundStrikeoutsAfterPlayOf(progress, facts)
  // 36 필살송구 아웃 — 정산 0xa8024(a80f8~a8116)은 모드를 안 가리고, 게이트 0xa77f0 은 수비 팀이 사람이면 36 을 들인다.
  // 표시 state[0x8b] 는 수비 화면 결과 판 0x46844 가 레이저 연출 뒤 코드 13 결과 판에서 세운다(`DefensePlayResult.laserOutFlag`)
  const laserPlay = play.sources.defensePlay ?? play.sources.settledRunnerPlay
  const newRecordIds = playRecordIdsOf(progress, facts, { balls: play.balls, ...strikeouts, laserPlay })
  return {
    moundStrikeouts: strikeouts.moundStrikeouts,
    moundStrikeoutCombo: strikeouts.moundStrikeoutCombo,
    recordIds: recordsAllowed(progress) ? [...progress.recordIds, ...newRecordIds] : progress.recordIds,
    record: chargedToMe > 0 ? { ...playedRecord, runsAllowedField: playedRecord.runsAllowedField + chargedToMe } : playedRecord,
    // 종류 5 정산은 a8d98 이 R+0x138(타자 수)을 건너뛴다 — 사구는 종류 5 와 겹치지 않는다(밀어내기 종류 2 로 덮인다)
    pitcherRecord: countsMine && !facts.stealPlaySettlement ? pitcherRecordAfterPlay(progress.pitcherRecord, facts.hitByPitch) : progress.pitcherRecord,
    // 시즌 탈삼진 +0x26 — 판 종류를 안 보는 a8d00 몫 (`stealPlayStrikeouts`)
    ...(facts.stealPlaySettlement && facts.strikeout && countsMine ? { stealPlayStrikeouts: (progress.stealPlayStrikeouts ?? 0) + 1 } : {}),
    runsAllowedByMe: progress.runsAllowedByMe + chargedToMe,
    // 낫아웃 — a8cb0 +0x20 += [sp+0x30](삼진 사건 포함), 보정 −1 은 R+0x13c · R[3] 에만 (`seasonOutsExtra`)
    ...(facts.droppedThirdStrike && countsMine ? { seasonOutsExtra: (progress.seasonOutsExtra ?? 0) + 1 } : {}),
    // 레코드 +0x2a — 게이트 없이 마운드의 내 투수에게 (a8b58 · a8bd2)
    freePassesByMe: progress.freePassesByMe + (facts.mine && facts.freePass ? 1 : 0),
  }
}

/** 0xb8cec R[0]·R[1] — 삼진 콜 0xa7c4c 가 올린 R[1] 을 정산 끝 a8fb2~a8ff8 이 낫아웃이면 끊는다(종류 4·5 는 건너뜀) */
function moundStrikeoutsAfterPlayOf(progress: PitcherGameProgress, facts: DefensivePlayFacts) {
  const strikeoutComboAtCall = facts.strikeout ? progress.moundStrikeoutCombo + 1 : 0
  return {
    moundStrikeouts: progress.moundStrikeouts + (facts.strikeout ? 1 : 0),
    strikeoutComboAtCall,
    moundStrikeoutCombo: facts.droppedThirdStrike ? 0 : strikeoutComboAtCall,
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
