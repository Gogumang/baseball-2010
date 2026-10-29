import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { drainMissionAutoTicks, missionAutoRelayStepOfTick, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { scoreMissionRuns, type MissionScoreboard } from '@/entities/mission/model/missionScoreboard'
import { missionAutoHalfDefenseOf, missionAutoHalfHooksOf } from '@/entities/mission/model/missionGame/auto/autoHalfDefense'
import { missionAutoHalfOf } from '@/entities/mission/model/missionGame/auto/autoHalfResult'
import { missionRelayNamersOf } from '@/entities/mission/model/missionGame/auto/relayCards'
import {
  quickBatterOf,
  rosterSlotAt,
  simulateHalfInningTicks,
  teamBatters,
  type HalfInningResult,
  type HalfInningTick,
} from '@/entities/mission/model/missionGame/otherSlices'
import type { MissionAutoDefenseOptions, MissionAutoHalf, MissionGame, MissionTeamBatting } from '@/entities/mission/model/missionGame/types'

/**
 * **자동진행 반 이닝** — 0x21 의 간이 타석 0xc262c 고리 (공격 `batting` · 수비 `pitching`, 투수 교체 0xac428 · 대타 0xac228 은
 * 간이 엔진 0xc1ba4 그대로). 타석마다 c21d6 경기 끝을 보고, 타자 미션은 0xc1e04 가 미션 타자 차례에서 사람에게 넘긴다(`stopBeforeNari`).
 * `start` 는 이어서 도는 반 이닝의 루 · 아웃 · 득점(새 반 이닝이면 빈 루 · 0) — 간이 엔진은 반 이닝 첫머리부터만 돌므로 이어 돌 일은 없다.
 * 끝까지 한꺼번에 굴린다 — 틱마다 굴리는 꼴은 `simulateMissionAutoHalfTicks`.
 */
export function simulateMissionAutoHalf(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  random: RandomPort,
  stopBeforeNari: boolean,
  /** 수비 재료 갈래 — 마투수 칸의 레코드 · 0x66864 교체 막음 (`missionPitchingDefenseOf`) */
  defenseOptions: MissionAutoDefenseOptions = {},
): MissionAutoHalf {
  return drainMissionAutoTicks(simulateMissionAutoHalfTicks(game, batting, pitching, random, stopBeforeNari, defenseOptions)).result
}

/**
 * `simulateMissionAutoHalf` 의 **틱 단위** 꼴 — 0x48480 갱신 한 번(= 0xc262c 한 번)마다 그 틱의 중계 칸을 내고 멈춘다
 * (`simulateHalfInningTicks`). 다음 틱을 안 부르면 남은 타석은 굴리지 않는다 — 중계 도중 제한 시간이 다 되면 원본도 그 틱에서 끊긴다.
 */
export function* simulateMissionAutoHalfTicks(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  random: RandomPort,
  stopBeforeNari: boolean,
  defenseOptions: MissionAutoDefenseOptions = {},
): Generator<MissionAutoRelayStep, MissionAutoHalf, void> {
  const rows = teamBatters(batting.teamId)
  // 미션 타자 표지는 멈춤 갈래가 먼저 걸러 여기 안 온다
  const batterOf = (record: number) => {
    const row = batting.records[record] ?? record
    return quickBatterOf(rows[Math.max(0, row) % rows.length])
  }
  const defense = missionAutoHalfDefenseOf(game, batting, pitching, defenseOptions)
  const ticks = simulateHalfInningTicks(
    batting.order,
    (cursor) => batterOf(rosterSlotAt(batting.lineup, cursor)),
    defense.pitcherAt(pitching.mound.pitcherSlot),
    game.inning + 1,
    random,
    undefined,
    missionAutoHalfHooksOf(game, batting, stopBeforeNari),
    defense,
    { lineup: batting.lineup, batterOf, pinchHitUsed: false },
  )
  const namers = missionRelayNamersOf(game, batting, pitching, defenseOptions.ace, rows)
  const result = yield* relayedTicks(ticks, game, namers)
  return missionAutoHalfOf(result, game, batting, pitching)
}

/** 틱마다 중계 칸을 낸다 — 그 틱 뒤 점수판: 간이 엔진 득점(0xc100a · 0xc109e → 0xb6a9c)은 지금 이닝 칸과 합을 함께 올린다 */
function* relayedTicks(
  ticks: Generator<HalfInningTick, HalfInningResult, void>,
  game: MissionGame,
  namers: ReturnType<typeof missionRelayNamersOf>,
): Generator<MissionAutoRelayStep, HalfInningResult, void> {
  const offenseSide = game.offenseSide
  let relayBoard: MissionScoreboard = { scores: game.scores, inningRuns: game.inningRuns }
  let next = ticks.next()
  while (next.done !== true) {
    const tick = next.value
    const step = missionAutoRelayStepOfTick({ inning: game.inning, offenseSide }, relayBoard.scores, tick, namers.nameOf, namers.cardsOf)
    relayBoard = scoreMissionRuns(relayBoard, game.inning, offenseSide, tick.kind === 'plateAppearance' ? tick.appearance.runsBattedIn : 0)
    yield { ...step, scores: relayBoard.scores, inningRuns: relayBoard.inningRuns }
    next = ticks.next()
  }
  return next.value
}
