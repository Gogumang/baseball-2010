import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  applyBatterOutcome,
  closeBurstWindow,
  isBatterTurn,
  runAutoProgress,
  startTeamGame,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import { BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { BURST_GOAL } from '@/entities/burst-mission/model/burstMissionJudge'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

const 시즌옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

type BurstRow = NonNullable<NonNullable<TeamGameProgress['burst']>['current']>
/** 목표 5 — 결과비트가 무엇이든 판정하지 않고 살려 둔다 (judgeBurstGoal) */
const 안내려가는돌발 = { id: 1, goal: 5 } as unknown as BurstRow

/** 돌발이 이미 뜬 채(발동 1회 사용) 첫 사람 타석에 선 시즌 경기 */
function 돌발뜬판(seed = 20100901): { progress: TeamGameProgress; random: ReturnType<typeof createSeededRandom> } {
  const random = createSeededRandom(seed)
  const progress = startTeamGame(시즌옵션, random)
  return {
    progress: { ...progress, burst: { ...progress.burst!, current: 안내려가는돌발, triggeredCount: 1, judgement: null } },
    random,
  }
}

describe('남은 돌발을 판정 없이 내린다 (0x8f628) — 팀 경기(시즌)', () => {
  it('자동진행(상태 0x21 진입 0x3abf0)에 들어서면 내려간다 — 발동 횟수는 그대로', () => {
    const { progress, random } = 돌발뜬판()
    const 뒤 = runAutoProgress(progress, random)
    expect(뒤.burst?.current).toBeNull()
    expect(뒤.burst?.judgement).toBeNull()
    expect(뒤.burst?.triggeredCount).toBe(1)
    expect(뒤.lastBurstResolution).toBeNull()
  })

  it('같은 반 이닝의 다음 사람 타석에서는 남아 있다', () => {
    const { progress, random } = 돌발뜬판()
    expect(isBatterTurn(progress)).toBe(true)
    const 뒤 = applyBatterOutcome(progress, { kind: '아웃', detail: '뜬공아웃' }, random)
    expect(뒤.game.half).toBe(progress.game.half)
    expect(뒤.burst?.current).toBe(안내려가는돌발)
  })

  it('반 이닝이 뒤집히면(0x18 진입 0x3ac90) 다음 사람 타석 준비 앞에서 내려간다', () => {
    const { progress, random } = 돌발뜬판()
    let current = progress
    for (let out = 0; out < 3; out += 1) {
      current = applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
    }
    expect(current.game.half).not.toBe(progress.game.half)
    expect(current.burst?.current).toBeNull()
    expect(current.burst?.triggeredCount).toBe(1)
  })

  it('내리기는 난수를 쓰지 않는다 — 돌발이 없던 판(발동은 이미 씀)과 같은 차례로 흐른다', () => {
    const { progress } = 돌발뜬판(7)
    const 없음 = { ...progress, burst: { ...progress.burst!, current: null } }
    const 세아웃 = (start: TeamGameProgress) => {
      const random = createSeededRandom(99)
      let current = start
      for (let out = 0; out < 3; out += 1) current = applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
      return { current, next: random.next() }
    }
    const 가 = 세아웃(progress)
    const 나 = 세아웃(없음)
    expect(가.current.game).toEqual(나.current.game)
    expect(가.current.burst).toEqual(나.current.burst)
    expect(가.next).toBe(나.next)
  })
})

describe('요약의 돌발 보상 burstRewardDeltas — resolveBurst 의 deltas 를 판정 차례대로 (0x8e34c 모드 2)', () => {
  it('판정이 나면 그 deltas 가 요약에 실리고, 판정이 없으면 빈 목록이다', () => {
    const { progress, random } = 돌발뜬판()
    expect(summaryOf(progress).burstRewardDeltas).toEqual([])
    // 시즌 타자형 행 중 목표가 안타(0)인 첫 행 — 2루타는 성공이다
    const row = BURST_TABLES.SEASON.slice(0, 31).find((candidate) => candidate.goal === BURST_GOAL.안타)!
    const 뜬판 = { ...progress, burst: { ...progress.burst!, current: row } }
    const 뒤 = applyBatterOutcome(뜬판, { kind: '안타', bases: 2 }, random)
    expect(뒤.lastBurstResolution?.judgement).toBe('성공')
    expect(뒤.lastBurstResolution?.deltas.length).toBeGreaterThan(0)
    expect(summaryOf(뒤).burstRewardDeltas).toEqual(뒤.lastBurstResolution?.deltas)
    // 창을 닫아도 요약 몫은 남는다
    expect(summaryOf(closeBurstWindow(뒤)).burstRewardDeltas).toEqual(뒤.lastBurstResolution?.deltas)
  })
})
