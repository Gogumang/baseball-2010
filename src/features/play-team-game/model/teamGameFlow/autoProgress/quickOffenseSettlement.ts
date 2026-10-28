import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { type GameState, runnersOfGame, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { isHit, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withOurAtBatRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withQuickSteals } from '@/features/play-team-game/model/teamGameFlow/records/leagueStolenBases'
import { withHitBases, withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { offenseRecordOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import {
  addRunsToCounters,
  chargeMoundLine,
  chargeRunsToResponsible,
  opponentAceStrikeoutsAfter,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **간이 엔진 우리 타석의 정산** — 원본도 사람 장면과 같은 0xa8024 → 0xa77f0 을 지난다(기록달성 · 평판 16칸이 똑같이 쌓인다).
 * `opponentStamina` 는 공마다 이미 깎은 값이다(`quickPitcherDrainOf` 의 `beforePitch`).
 */
export function withQuickOffenseSettlement(progress: TeamGameProgress, appearance: QuickPlateAppearance, opponentStamina: number): TeamGameProgress {
  const { play } = appearance
  const { outcome } = play
  const before = progress.game
  const slot = before.battingOrderIndex
  // 간이 엔진 타석 — 희생플라이가 없다 (E-2 확정). 볼넷 모든 주자 +1 · 도루 · 땅볼 진루는 `playQuickPlateAppearance` 가 먹였다
  const game = applyAtBatOutcome(before, outcome, appearance.advance, { runners: appearance.runners })
  const runsBattedIn = game.ourScore - before.ourScore
  // 간이 엔진 타석도 같은 0xa8024 → 0xa77f0 을 지난다 — 기록달성도 똑같이 쌓인다 (대타 홈런 5 는 c26b6 이 지워 없다)
  const recorded = withOurAtBatRecords(progress, slot, outcome, runsBattedIn, false)
  const settled: TeamGameProgress = {
    ...recorded,
    game,
    // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    opponentAceStrikeouts: opponentAceStrikeoutsAfter(progress, outcome.kind === '삼진'),
    atBat: createAtBat(),
    atBatPrepared: false,
    // 투구마다 state[0xd]·state[0xe] 가 내려간다 (0xa5e14 의 a5e72·a5e7c, c26ca)
    pitcherJustChanged: false,
    cpuPinchHitUsed: false,
    opponentStamina,
    ...quickOpponentMoundChargesOf(progress, appearance, game, runsBattedIn),
    opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, runsBattedIn, play.pitches, !isSameHalfInning(game, before)),
    ...quickOurBattingRecordsOf(progress, appearance, runsBattedIn),
  }
  const runsText = runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
  return appendLog(settled, `${before.inning}회${before.half} ${lineupSlotOf(slot) + 1}번 — ${describeOutcome(outcome)}${runsText}`, false)
}

/** 실점은 들어온 주자의 책임 투수(주자+0x30)에게 — 간이 엔진 주자는 죽지 않아 루에서 빠진 앞선 주자가 들어온 주자다 */
function quickOpponentMoundChargesOf(
  progress: TeamGameProgress,
  appearance: QuickPlateAppearance,
  game: GameState,
  runsBattedIn: number,
): Pick<TeamGameProgress, 'pitcherLines' | 'runnerPitchers'> {
  const before = progress.game
  const { play } = appearance
  const moundLine = chargeMoundLine(progress, false, {
    outs: outsAddedBetween(before, game),
    strikeouts: play.outcome.kind === '삼진' ? 1 : 0,
    pitches: play.pitches,
  })
  const runnersAfter = isSameHalfInning(game, before) ? appearance.runners : EMPTY_BASE_RUNNERS
  const scoredFromBases = scoredFromBasesOf(runnersOfGame(before), runnersAfter, runsBattedIn)
  return chargeRunsToResponsible(progress, moundLine, game, false, lineupSlotOf(before.battingOrderIndex), scoredFromBases)
}

/** 우리 타선 쪽 기록 — 안타 수 · 타순 칸(간이 엔진 링) · 도루 · 평판 16칸 · 루타 목록 · 리그 기록표 */
function quickOurBattingRecordsOf(progress: TeamGameProgress, appearance: QuickPlateAppearance, runsBattedIn: number) {
  const { outcome } = appearance.play
  const slot = progress.game.battingOrderIndex
  const offense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])
  return {
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome, true),
    // 0xc1a42~0xc1a98 — 도루 주자마다 +0x2c
    ...withQuickSteals(progress, true, appearance.stolenRunners),
    // 자동으로 넘긴 타석도 원본은 같은 0xa8024 를 지난다 — 평판 16칸도 똑같이 오른다
    gameRecord: withSeasonRecord(progress, '공격', offense.codes),
    ourHitBases: withHitBases(progress.ourHitBases, slot, offense.hitBases),
    leaguePlateAppearances: withLeaguePlateAppearance(
      progress.leaguePlateAppearances,
      progress.options.ourTeamId,
      progress.ourEntry,
      slot,
      outcome,
      runsBattedIn,
    ),
  }
}
