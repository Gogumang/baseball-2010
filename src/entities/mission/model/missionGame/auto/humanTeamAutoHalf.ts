import type { RandomPort } from '@/shared/api/random/randomPort'
import { drainMissionAutoTicks, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { simulateMissionAutoHalfTicks } from '@/entities/mission/model/missionGame/auto/autoHalf'
import { withMissionScore } from '@/entities/mission/model/missionGame/board/board'
import type { MissionGame } from '@/entities/mission/model/missionGame/types'

/**
 * **사람 칸 팀이 치는 자동진행 반 이닝** (투수 미션) — 공격 = 사람 칸 마스터 타선(`humanBatting`), 수비 = CPU 팀(`cpuAutoPitching`).
 * 사람 칸 팀 마스터 타자는 육성·명예 선수가 아니라(0xb6389 · 0xb6349 거짓) 0xc1e04 모드 5 가 반 이닝 내내 자동이다.
 * 틱마다 중계 칸을 내고 멈춘다(`simulateMissionAutoHalfTicks`).
 */
export function* simulateHumanTeamAutoHalfTicks(
  game: MissionGame,
  random: RandomPort,
): Generator<MissionAutoRelayStep, { readonly game: MissionGame; readonly gameEnded: boolean }, void> {
  const pitching = game.cpuAutoPitching
  if (pitching === null) return { game, gameEnded: false }
  const half = yield* simulateMissionAutoHalfTicks(game, game.humanBatting, pitching, random, false)
  return {
    game: {
      ...withMissionScore(game, game.offenseSide, half.runs),
      humanBatting: half.batting,
      // 이닝 교대 0xa5b00 이 A 를 0 으로 — 다음 자동진행 반 이닝은 0 에서 선다
      cpuAutoPitching: { ...half.pitching, inningRunsAllowed: 0 },
    },
    gameEnded: half.gameEnded,
  }
}

/** `simulateHumanTeamAutoHalfTicks` 를 끝까지 — 중계 칸들(`relay`)과 함께 */
export function simulateHumanTeamAutoHalf(
  game: MissionGame,
  random: RandomPort,
): { readonly game: MissionGame; readonly gameEnded: boolean; readonly relay: readonly MissionAutoRelayStep[] } {
  const { steps, result } = drainMissionAutoTicks(simulateHumanTeamAutoHalfTicks(game, random))
  return { ...result, relay: steps }
}
