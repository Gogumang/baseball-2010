import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  flipMissionHalf,
  simulateMissionAutoHalfTicks,
  withMissionScore,
  type MissionAutoHalf,
  type MissionGame,
  type MissionTeamBatting,
} from '@/entities/mission/model/missionGame'
import type { MissionAcePitcher, MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'

type AutoTicks<T> = Generator<MissionAutoRelayStep, T, void>

/** 자동진행 반 이닝 둘의 처음 재료 — 경기 칸이 비면(옛 판) 이 값으로 선다 */
export interface MissionAutoStart {
  readonly cpuBatting: MissionTeamBatting
  readonly humanPitching: MissionCpuPitching
}

/** 1. CPU 가 치는 반 이닝 통째 — 공격 CPU 타선(`cpuAutoBatting`) · 수비 사람 칸 팀 투수진(`humanPitching`) */
export function* cpuOffenseHalfTicks(
  before: MissionGame,
  start: MissionAutoStart,
  random: RandomPort,
  blocked: boolean,
): AutoTicks<{ readonly game: MissionGame; readonly gameEnded: boolean }> {
  const game = flipMissionHalf(before)
  const half: MissionAutoHalf = yield* simulateMissionAutoHalfTicks(
    game,
    game.cpuAutoBatting ?? start.cpuBatting,
    game.humanPitching ?? start.humanPitching,
    random,
    false,
    { pitcherChangeBlocked: blocked },
  )
  return {
    game: {
      ...withMissionScore(game, game.offenseSide, half.runs),
      cpuAutoBatting: half.batting,
      // 이닝 교대 0xa5b00 이 A 를 0 으로
      humanPitching: { ...half.pitching, inningRunsAllowed: 0 },
    },
    gameEnded: half.gameEnded,
  }
}

/** 2. 사람 칸 팀 반 이닝 — 미션 타자 차례(`MISSION_NARI_RECORD`)가 오기 전까지 자동(수비 = CPU 팀 `cpu.pitching`) */
export function* humanOffenseHalfTicks(
  before: MissionGame,
  cpuPitching: MissionCpuPitching,
  random: RandomPort,
  ace: MissionAcePitcher | undefined,
  blocked: boolean,
): AutoTicks<{ readonly game: MissionGame; readonly half: MissionAutoHalf; readonly cpuPitching: MissionCpuPitching }> {
  const game = flipMissionHalf(before)
  const half: MissionAutoHalf = yield* simulateMissionAutoHalfTicks(game, game.humanBatting, { ...cpuPitching, inningRunsAllowed: 0 }, random, true, {
    ...(ace === undefined ? {} : { ace }),
    pitcherChangeBlocked: blocked,
  })
  return {
    game: { ...withMissionScore(game, game.offenseSide, half.runs), humanBatting: half.batting },
    half,
    cpuPitching: {
      ...half.pitching,
      // 리드(수비 − 공격)의 우리 쪽 — 사람 칸 팀 득점
      ourRuns: half.pitching.ourRuns + half.runs,
      inningRunsAllowed: half.stoppedBeforeNari ? half.pitching.inningRunsAllowed : 0,
    },
  }
}
