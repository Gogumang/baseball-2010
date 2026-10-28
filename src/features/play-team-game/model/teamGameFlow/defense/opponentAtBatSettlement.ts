import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { baserunnerAllowedOfFates, baserunnerAllowedOfPlay } from '@/features/defense-play/model/runnerFates'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import type { OpponentAtBatFacts } from '@/features/play-team-game/model/teamGameFlow/defense/opponentAtBatFacts'
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withQuickSteals } from '@/features/play-team-game/model/teamGameFlow/records/leagueStolenBases'
import { withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { defenseRecordCodesOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import {
  addRunsToCounters,
  chargeMoundLine,
  chargeRunsToResponsible,
  scoredFromBasesOfAtBat,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'
import type { TeamPitchingLine } from '@/features/play-team-game/model/teamGameFlow/types/records'

/**
 * **상대 타석 정산 0xa8024 를 진행에 먹인다** — 경기 · 득점 처리 · 우리 마운드 투수 줄 · 팀 투구 줄 · 상대 타선 기록.
 * `playback` 이 null 이면 재생할 것이 없다는 뜻이라 `lastDefensePlay` 는 그대로 둔다.
 */
export function withOpponentAtBatSettlement(
  progress: TeamGameProgress,
  facts: OpponentAtBatFacts,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const { before, applied } = facts
  return {
    ...progress,
    game: applied.game,
    decisions: decisionsAfterPlay(progress.decisions, before, applied.game, moundsOf(progress)),
    ...ourMoundChargesOf(progress, facts, outcome, defensePlay),
    opponentOrderIndex: applied.opponentOrderIndex,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    defenseScene: defensePlay?.scene ?? progress.defenseScene,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 득점 처리 0xa5c34 가 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ourPitcherCounters: addRunsToCounters(progress.ourPitcherCounters, applied.runsScored, 0, !isSameHalfInning(applied.game, before)),
    pitching: pitchingAfterOpponentAtBat(progress, facts, outcome, mine, defensePlay),
    ...opponentBattingRecordsOf(progress, facts, outcome),
    ...withQuickSteals(progress, false, facts.quick?.stolenRunners ?? []),
  }
}

/**
 * 정산 0xa8024 — 우리 마운드 투수 레코드에 아웃·실점·탈삼진 (a8cb0 +0x20 · a8d14 +0x26 은 종류를 안 거른다).
 * 실점은 들어온 주자의 책임 투수(주자+0x30)에게 (a8ee4) — 승계 주자면 앞 투수 몫이다
 */
function ourMoundChargesOf(
  progress: TeamGameProgress,
  facts: OpponentAtBatFacts,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
): Pick<TeamGameProgress, 'pitcherLines' | 'runnerPitchers'> {
  const { before, applied, quick } = facts
  const moundLine = chargeMoundLine(progress, true, {
    // 낫아웃은 a8cb0 이 삼진 사건까지 더하고 보정(−1)은 R+0x13c · R[3] 에만 건다 — +0x20 이 하나 많다(원본 그대로)
    outs: applied.outsAdded + (facts.droppedThirdStrike ? 1 : 0),
    strikeouts: outcome.kind === '삼진' ? 1 : 0,
    // a8b04~a8bee — 사람 수비 타석의 볼넷 · 사구도 지금 마운드(우리) 투수 +0x2a. 간이 타석(`quick`)의 포볼 c1918 은 볼을
    // 3 에서 안 올려(판정 0x9d57c · c18d4) `state[5] > 3` 이 서지 않는다 — 안 센다
    walks: facts.walk && quick === undefined ? 1 : 0,
  })
  const runnersAfter = isSameHalfInning(applied.game, before) ? runnersOfGame(applied.game, applied.opponentOrderIndex) : EMPTY_BASE_RUNNERS
  const scoredFromBases = scoredFromBasesOfAtBat(
    before,
    runnersOfGame(before, progress.opponentOrderIndex),
    runnersAfter,
    outcome,
    defensePlay,
    quick !== undefined,
    applied.outsAdded,
    applied.runsScored,
  )
  return chargeRunsToResponsible(progress, moundLine, applied.game, true, lineupSlotOf(progress.opponentOrderIndex), scoredFromBases)
}

/** 팀 투구 줄 state[0x88..0x8a] — 아웃 · 피안타 · 볼넷 · 실점 · 출루 허용 */
function pitchingAfterOpponentAtBat(
  progress: TeamGameProgress,
  facts: OpponentAtBatFacts,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
): TeamPitchingLine {
  const { before, applied, runnerListPlay } = facts
  const pitching = progress.pitching
  return {
    outsRecorded: pitching.outsRecorded + applied.outsAdded,
    hitsAllowed: pitching.hitsAllowed + (facts.hit ? 1 : 0),
    walksAllowed: pitching.walksAllowed + (facts.walk ? 1 : 0),
    runsAllowed: pitching.runsAllowed + applied.runsScored,
    // 종류 5 · 9 정산의 주자 목록은 그 판의 것이다 — 도루 판엔 타자가 없고, 삼진 그대로인 폭투 판도 state[0x1a] 가 0 이라
    // 0x46418 이 타자주자를 안 끼운다 (a8c5c)
    allowedBaserunner:
      pitching.allowedBaserunner ||
      (runnerListPlay !== undefined
        ? baserunnerAllowedOfFates(runnerListPlay.runnerFates)
        : baserunnerAllowedOfPlay(before.bases, outcome, mine, defensePlay, facts.quick?.advance)),
  }
}

/** 상대 타선 쪽 기록 — 시즌 평판 · 타순 칸 · 리그 기록표 */
function opponentBattingRecordsOf(
  progress: TeamGameProgress,
  facts: OpponentAtBatFacts,
  outcome: AtBatOutcome,
): Pick<TeamGameProgress, 'gameRecord' | 'opponentEntryRecords' | 'leaguePlateAppearances'> {
  const { applied, slot, stealPlay } = facts
  const runnerPlay = stealPlay !== undefined
  const outsInPlay =
    applied.outsAdded + (facts.stealPlayOuts ?? 0) + (facts.wildPitchPlay?.result.advance.outsAdded ?? 0) + (facts.droppedThirdStrike ? 1 : 0)
  return {
    // 시즌 평판 16칸 — 우리 수비라 **공격측(상대)이 CPU** 인 코드(≤ 5)만 선다
    gameRecord: withSeasonRecord(progress, '수비', defenseRecordCodesOf(outcome, outsInPlay, runnerPlay, facts.droppedThirdStrike)),
    // 종류 5 정산은 타석 칸(+0x14 · a8ac8)도 결과 링(a8a04)도 안 올린다 — 견제 판과 같은 게이트
    opponentEntryRecords: withPlateAppearance(
      progress.opponentEntryRecords,
      slot,
      runnerPlay ? null : outcome,
      facts.quick !== undefined,
      !runnerPlay && facts.homeRunCounted,
    ),
    // 리그 타수 +0x20 (a8866~a8894)도 종류 4·5 를 건너뛴다(a8852) — 삼진이 리그 줄에 쌓는 칸은 타수뿐이다
    leaguePlateAppearances: runnerPlay
      ? progress.leaguePlateAppearances
      : withLeaguePlateAppearance(progress.leaguePlateAppearances, progress.options.opponentTeamId, progress.opponentEntry, slot, outcome, applied.runsScored),
  }
}
