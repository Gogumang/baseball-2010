import type { GameState } from '@/entities/game/model/gameState'
import { lineupSlotOf, recordLineupPlay, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { recordBatterAtBat, EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { chargeOpponentRunsOf } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { MAXIMUM_PITCHER_COUNTER } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 0xc1a42~0xc1a98 — 도루에 성공한 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c. 내가 루에 있었으면 내 기록(124 타자 열 0x40)으로,
 * 동료는 리그 기록표로(마타자 칸은 summary 가 뺀다). 포스트시즌 거르기는 커리어에 먹이는 쪽이 한다
 */
function teammateStealFieldsOf(progress: GameProgress, stolenSlots: readonly number[]): Partial<GameProgress> {
  const myStolenBases = stolenSlots.filter((stolenSlot) => stolenSlot === progress.game.playerOrderIndex).length
  const teammateSteals = stolenSlots
    .filter((stolenSlot) => stolenSlot !== progress.game.playerOrderIndex)
    .map((stolenSlot) => ({ teamId: progress.ourTeamId, battingOrderIndex: rosterSlotAt(progress.ourLineup, stolenSlot) }))
  return {
    ...(myStolenBases > 0 ? { myStats: { ...progress.myStats, stolenBases: (progress.myStats.stolenBases ?? 0) + myStolenBases } } : {}),
    ...(teammateSteals.length > 0 ? { leagueStolenBases: [...(progress.leagueStolenBases ?? []), ...teammateSteals] } : {}),
  }
}

/** 동료 타석이 끝난 진행 — 점수 · 기록 · 실점 책임 · 상대 마운드(공마다 깎은 체력 `staminaAfter`) */
export function teammateAppearanceProgressOf(
  progress: GameProgress,
  appearance: QuickPlateAppearance,
  game: GameState,
  staminaAfter: () => number,
): GameProgress {
  const play = appearance.play
  const outcome = play.outcome
  const mound = progress.opponentMound
  const order = progress.game.battingOrderIndex
  const slot = order
  const runsBattedIn = game.ourScore - progress.game.ourScore
  const recorded = recordBatterAtBat(progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG, outcome, runsBattedIn)
  // 간이 엔진 타석도 0xa8024 를 지난다 — 동료 홈런도 같은 팀 카운터로 이어 센다 (0xa794c)
  const backToBack = backToBackRecordOf({
    streak: progress.homeRunStreak,
    humanOffense: true,
    isHomeRun: outcome.kind === '홈런',
  })
  return {
    ...progress,
    game,
    // 간이 타석의 공마다 c1446 · c1852 가 상대(수비) 레코드 +2 를 덮는다 (`GameProgress.opponentRecordMorale`)
    opponentRecordMorale: progress.teamMorale ?? teamRecordMoraleOf(progress.opponentTeamId),
    // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
    decisions: decisionsAfterPlay(progress.decisions, progress.game, game, moundsOf(progress)),
    teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
    ourLineup: recordLineupPlay(progress.ourLineup, slot, outcome, { quickEngine: true }),
    // 실점은 들어온 주자의 책임 투수에게 (0xa8ee4) — 간이 엔진 주자는 죽지 않아 빠진 앞선 주자가 들어온 주자다
    ...chargeOpponentRunsOf(
      progress,
      chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, mound.pitcherSlot, {
        outs: outsAddedBetween(progress.game, game),
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
      }),
      game,
      lineupSlotOf(order),
      scoredFromBasesOf(runnersOfGame(progress.game), appearance.runners, runsBattedIn),
    ),
    opponentMound: {
      ...mound,
      // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
      stamina: staminaAfter(),
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runsBattedIn),
      pitches: mound.pitches + play.pitches,
      // 투구마다 state[0xd] 가 내려간다 (0xa5e72)
      justChanged: false,
    },
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
    pinchHitUsed: false,
    opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runsBattedIn),
    recordIds: [...progress.recordIds, ...recorded.recordIds, ...backToBack.recordIds],
    homeRunStreak: backToBack.streak,
    ...teammateStealFieldsOf(progress, appearance.stolenRunners),
    // 동료 타석도 우리 팀 선수 레코드에 쌓인다 — 타순 칸이 곧 로스터 칸이다 (`batterAt` 과 같은 자리)
    leaguePlateAppearances: [
      ...progress.leaguePlateAppearances,
      {
        teamId: progress.ourTeamId,
        battingOrderIndex: rosterSlotAt(progress.ourLineup, slot),
        outcome,
        runsBattedIn,
      },
    ],
  }
}
