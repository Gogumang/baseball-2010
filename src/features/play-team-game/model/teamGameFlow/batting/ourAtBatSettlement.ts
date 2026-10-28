import { type AtBatOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import type { OurAtBatFacts } from '@/features/play-team-game/model/teamGameFlow/batting/ourAtBatFacts'
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import { withOurAtBatRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withHitBases, withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { offenseRecordOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import {
  addRunsToCounters,
  chargeMoundLine,
  chargeRunsToResponsible,
  opponentAceStrikeoutsAfter,
  scoredFromBasesOfAtBat,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import { isPinchHitAtBat } from '@/features/play-team-game/model/teamGameFlow/substitution/pinchHit'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **사람 타석 정산 0xa8024 를 진행에 먹인다** — 경기 · 득점 처리 · 상대 마운드 투수 줄 · 우리 타선 기록 · 타석 칸 비우기.
 * `playback` 은 화면에 재생시킬 것 — 실시간으로 이미 다 보여 준 플레이는 null 이다.
 */
export function withOurAtBatSettlement(
  progress: TeamGameProgress,
  facts: OurAtBatFacts,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const { before, game } = facts
  // 기록달성 (0xa8024 → 0xa77f0) — 사람 공격이라 공격 계열이 게이트를 지난다. 5 대타 홈런은 ctx+0x160 을 본다.
  // 종류 5 정산은 타석 결과 목록(0xa908d)도 백투백 카운터 지우기(a8ab2)도 안 지난다
  const recorded = facts.runnerPlay
    ? progress
    : withOurAtBatRecords(progress, facts.slot, outcome, facts.runsBattedIn, isPinchHitAtBat(progress), facts.homeRunCounted)
  return {
    ...recorded,
    game,
    // 득점 처리 0xa5c34 — 한 점씩 승·패·세 칸을 고친다
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    opponentAceStrikeouts: opponentAceStrikeoutsAfter(progress, outcome.kind === '삼진'),
    ...opponentMoundChargesOf(progress, facts, outcome, defensePlay),
    ...ourBattingRecordsOf(progress, facts, outcome),
    lastDefensePlay: playback,
    defenseScene: defensePlay?.scene ?? progress.defenseScene,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 다음 타석 시작 0x48d50 → 0xa5bcc 가 ctx+0x160 을 지운다
    pinchHitHomeRunHalf: null,
    // 우리 타석의 득점은 **상대 투수**의 A·B 로 들어간다 (0xa5c34 는 수비 팀 칸을 올린다)
    opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, facts.runsBattedIn, 0, !isSameHalfInning(before, game)),
  }
}

/**
 * 정산 0xa8024 — 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·실점·탈삼진.
 * 실점은 들어온 주자의 책임 투수(주자+0x30)에게 (a8ee4)
 */
function opponentMoundChargesOf(
  progress: TeamGameProgress,
  facts: OurAtBatFacts,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
): Pick<TeamGameProgress, 'pitcherLines' | 'runnerPitchers'> {
  const { before, game } = facts
  const moundLine = chargeMoundLine(progress, false, {
    outs: outsAddedBetween(before, game) + (facts.droppedThirdStrike ? 1 : 0),
    strikeouts: outcome.kind === '삼진' ? 1 : 0,
    // a8b04~a8bee — 볼넷(사람 판정 3e1ae 가 볼을 넷째로 센다) · 사구면 지금 마운드 투수 +0x2a
    walks: isFreePass(outcome) ? 1 : 0,
  })
  const runnersAfter = isSameHalfInning(game, before) ? runnersOfGame(game) : EMPTY_BASE_RUNNERS
  const scoredFromBases = scoredFromBasesOfAtBat(
    before,
    runnersOfGame(before),
    runnersAfter,
    outcome,
    defensePlay,
    false,
    facts.outsAdded,
    facts.runsBattedIn,
  )
  return chargeRunsToResponsible(progress, moundLine, game, false, lineupSlotOf(before.battingOrderIndex), scoredFromBases)
}

/** 우리 타선 쪽 기록 — 시즌 평판 · 루타 목록 · 안타 수 · 타순 칸 · 리그 기록표 */
function ourBattingRecordsOf(
  progress: TeamGameProgress,
  facts: OurAtBatFacts,
  outcome: AtBatOutcome,
): Pick<TeamGameProgress, 'gameRecord' | 'ourHitBases' | 'ourHits' | 'ourEntryRecords' | 'leaguePlateAppearances'> {
  const { slot, runnerPlay, runsBattedIn } = facts
  const hitBasesBefore = progress.ourHitBases[slot] ?? []
  // 시즌 평판 16칸 — 우리 공격이라 **수비측(상대)이 CPU** 인 코드(≥ 6)만 선다. 종류 5 정산은 삼진 코드 6(a8a46)을 안 지난다
  const offense = runnerPlay ? { codes: [], hitBases: hitBasesBefore } : offenseRecordOf(outcome, runsBattedIn, hitBasesBefore, facts.homeRunCounted)
  return {
    gameRecord: withSeasonRecord(progress, '공격', offense.codes),
    ourHitBases: withHitBases(progress.ourHitBases, slot, offense.hitBases),
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, runnerPlay ? null : outcome, false, facts.homeRunCounted),
    leaguePlateAppearances: runnerPlay
      ? progress.leaguePlateAppearances
      : withLeaguePlateAppearance(progress.leaguePlateAppearances, progress.options.ourTeamId, progress.ourEntry, slot, outcome, runsBattedIn),
  }
}
