import { type GameState, lineScoreSlotsOf } from '@/entities/game/model/gameState'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { type MoundBySide, decisionsAfterRuns, type PitcherOfRecordNames, pitcherOfRecordNamesOf } from '@/features/play-game/model/gameDecisions'
import type { HalfInningPitcherChange } from '@/entities/game/model/simulateHalfInning'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import { ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { teamAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 경기 끝 판 0x4fe9c 503d8 의 이닝별 점수판 값 (합은 판이 점수에서 읽는다) */
export function endLineScoreOf(game: GameState): NonNullable<GameSummary['lineScore']> {
  const slots = lineScoreSlotsOf(game)
  return { inning: slots.inning, offenseSide: slots.offenseSide, inningRuns: slots.inningRuns }
}

/** 측별 지금 마운드 투수 칸 — 승·패·세 칸이 "그 순간 마운드에 선 투수" 로 적는다 */
export function moundsOf(progress: GameProgress): MoundBySide {
  return { our: progress.ourMound.pitcherSlot, opponent: progress.opponentMound.pitcherSlot }
}

/**
 * 상대 공격 반 이닝(간이 엔진)의 승·패·세 칸 — 교체 자리를 경계로 점수를 나눠 한 점씩 먹인다.
 * 교체 전 점수는 이전 투수, 교체 뒤 점수는 새 투수가 마운드에 있을 때 난 것이다.
 * 교체 자리의 세이브 후보 `0xa60c0` 은 **안 잡는다**: 간이 엔진 c268e~c26b2 는 수비 팀 +0x296 과 `engine[1]` 이 둘 다 서야 부르는데
 * 타자편 경기 장면(3fa06)·자동진행(3c93a)은 0xc0dac 에 engine[1] = 0 을 넘긴다(c0e18 — 1 은 CPU 끼리 경기 0xc2760 c2858 뿐).
 */
export function opponentHalfDecisionsOf(progress: GameProgress, runs: number, changes: readonly HalfInningPitcherChange[]): DecisionState {
  let decisions = progress.decisions
  let ourSlot = progress.ourMound.pitcherSlot
  let counted = 0
  const scoredGame = (scored: number): GameState => ({
    ...progress.game,
    opponentScore: progress.game.opponentScore + scored,
  })
  for (const change of changes) {
    decisions = decisionsAfterRuns(decisions, scoredGame(counted), change.runsBefore - counted, {
      our: ourSlot,
      opponent: progress.opponentMound.pitcherSlot,
    })
    counted = change.runsBefore
    ourSlot = change.pitcherSlot
  }
  return decisionsAfterRuns(decisions, scoredGame(counted), runs - counted, {
    our: ourSlot,
    opponent: progress.opponentMound.pitcherSlot,
  })
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다. 측 2(없음)면 그 줄은 빈다.
 */
export function pitchersOfRecordOf(progress: GameProgress): PitcherOfRecordNames {
  return pitcherOfRecordNamesOf(progress.decisions, progress.game.playerSide, (isOurTeam, slot) =>
    slot === ACE_PITCHER_SLOT && teamAcePitcherOf(progress, isOurTeam) !== undefined
      ? teamAcePitcherOf(progress, isOurTeam)?.player.name
      : teamPitchers(isOurTeam ? progress.ourTeamId : progress.opponentTeamId)[slot]?.name,
  )
}
