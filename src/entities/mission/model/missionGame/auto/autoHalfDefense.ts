import { isFightingSpiritSituationOf, sideFightingSpiritStateOf } from '@/shared/lib/liveGameState/liveGameState'
import { missionPitchingDefenseOf, type MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { battingRecordAt, isMissionGameOver } from '@/entities/mission/model/missionGame/board/board'
import { simulateHalfInningTicks, type QuickLineup } from '@/entities/mission/model/missionGame/otherSlices'
import {
  MISSION_NARI_RECORD,
  type MissionAutoDefenseOptions,
  type MissionGame,
  type MissionTeamBatting,
} from '@/entities/mission/model/missionGame/types'

type HalfInningHooks = NonNullable<Parameters<typeof simulateHalfInningTicks>[6]>

/** 지금 점수에 이 반 이닝 득점을 공격 측에 더한 점수 */
function scoresWithRuns(game: MissionGame, runs: number): [number, number] {
  const scores: [number, number] = [game.scores[0], game.scores[1]]
  scores[game.offenseSide] += runs
  return scores
}

/**
 * 자동진행 반 이닝의 **수비 재료** (`missionPitchingDefenseOf`) — 리드는 수비 − 공격 점수.
 * 0xb570c 스킬 14 갈래의 경기 상태 — 미션 장면도 전역 상태 [0x1552d0c] 자체를 굴린다: +0x6b = st[0x6b] 이닝, +0x28 = 0xaa57c aa72a 의
 * 0xb6bd4 가 적은 두 팀, +0x7e = 지금 점수 + 이 반 이닝 득점(간이 엔진 득점 0xb6a9d) (A-23)
 */
export function missionAutoHalfDefenseOf(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  defenseOptions: MissionAutoDefenseOptions,
): ReturnType<typeof missionPitchingDefenseOf> {
  const offenseSide = game.offenseSide
  const defenseSide = offenseSide === 0 ? 1 : 0
  const sideTeams: [number, number] = [0, 0]
  sideTeams[defenseSide] = pitching.teamId
  sideTeams[offenseSide] = batting.teamId
  const fightingSpiritAt = (runs: number) =>
    isFightingSpiritSituationOf(sideFightingSpiritStateOf(game.inning, sideTeams, scoresWithRuns(game, runs)), pitching.teamId)
  return missionPitchingDefenseOf(pitching, game.scores[defenseSide] - game.scores[offenseSide], {
    ...defenseOptions,
    fightingSpiritAt,
  })
}

/**
 * 간이 엔진 고리의 멈춤 — 타석마다 c21d6 경기 끝을 보고, 타자 미션은 0xc1e04 가 미션 타자 차례에서 사람에게 넘긴다(`stopBeforeNari`).
 */
export function missionAutoHalfHooksOf(game: MissionGame, batting: MissionTeamBatting, stopBeforeNari: boolean): HalfInningHooks {
  return {
    endsGame: ({ runs, outs }) => isMissionGameOver(game, outs, scoresWithRuns(game, runs)),
    ...(stopBeforeNari
      ? {
          stopsBefore: ({ battingOrderIndex, lineup }: { readonly battingOrderIndex: number; readonly lineup?: QuickLineup }) =>
            battingRecordAt({ ...batting, lineup: lineup ?? batting.lineup }, battingOrderIndex) === MISSION_NARI_RECORD,
        }
      : {}),
  }
}
