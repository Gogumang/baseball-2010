import { describe, expect, it } from 'vitest'
import { BASE_POSITIONS, FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'
import {
  BENCH_CLEARING_EXIT_TICK,
  benchClearingIrisOf,
  startBenchClearingWalk,
  stepBenchClearingWalk,
} from '@/widgets/field-walk/lib/benchClearingWalk'
import { DUGOUT_POSITIONS } from '@/widgets/field-walk/lib/halfInningWalk'

const entryRolls = Array.from({ length: 9 }, (_unused, i) => ({
  scatterX: 10 * i,
  scatterZ: 100 + i,
  speed: 300 + i,
  targetX: 50 * i,
  targetZ: 100 * i,
}))
const input = { entryRolls, offenseSide: 0 as const, isLeftBatter: false, occupiedBases: [false, true, false] as const }

describe('벤치 클리어링 진입 0x3a5f0', () => {
  it('수비 9명은 제자리에 선다', () => {
    const state = startBenchClearingWalk(input)
    state.fielders.forEach((walker, i) => {
      expect([walker.x, walker.z, walker.targetX, walker.targetZ]).toEqual([
        FIELDER_START_POSITIONS[i].x,
        FIELDER_START_POSITIONS[i].z,
        FIELDER_START_POSITIONS[i].x,
        FIELDER_START_POSITIONS[i].z,
      ])
      expect(walker.action).toBe(FIELDER_ACTION.stand)
    })
  })

  it('공격 칸 i 는 더그아웃 안쪽에서 3루수 칸 둘레(측 0)로 — 굴린 걸음은 0xa21bc 가 220 으로 덮는다', () => {
    const state = startBenchClearingWalk(input)
    const dugout = DUGOUT_POSITIONS[0]
    const third = FIELDER_START_POSITIONS[4]
    expect([state.offense[0].x, state.offense[0].z]).toEqual([dugout.x - 100 * 8, dugout.z - 200 * 8])
    expect([state.offense[0].targetX, state.offense[0].targetZ]).toEqual([third.x, third.z])
    expect([state.offense[4].targetX, state.offense[4].targetZ]).toEqual([third.x + 200, third.z + 400])
    expect(state.offense[4].speed).toBe(220)
  })

  it('타자(칸 8)는 홈에서 우타면 x − 1400 에 서서 마운드로, 2루 주자(칸 6)는 2루에 선다', () => {
    const state = startBenchClearingWalk(input)
    expect([state.offense[8].x, state.offense[8].z]).toEqual([BASE_POSITIONS[0].x - 1400, BASE_POSITIONS[0].z])
    expect([state.offense[8].targetX, state.offense[8].targetZ]).toEqual([20000, 24500])
    expect([state.offense[6].x, state.offense[6].z]).toEqual([BASE_POSITIONS[2].x, BASE_POSITIONS[2].z])
    expect([state.offense[6].targetX, state.offense[6].targetZ]).toEqual([BASE_POSITIONS[2].x, BASE_POSITIONS[2].z])
    expect(state.offense[6].action).toBe(FIELDER_ACTION.stand)
    // 1루 · 3루가 비면 칸 7 · 5 는 그대로 몰려 나온다
    expect(state.offense[7].x).not.toBe(BASE_POSITIONS[1].x)
  })
})

describe('벤치 클리어링 갱신 0x405b0 → 0x401d4', () => {
  it('틱 10 에 수비 목표를 투수판 둘레로 — 굴림 차례대로', () => {
    let state = startBenchClearingWalk(input)
    for (let t = 0; t < 10; t += 1) state = stepBenchClearingWalk(state, t, input, null)
    state = stepBenchClearingWalk(state, 10, input, [1500, 2500, 1200, 2700, 1300, 2600, 100, 200])
    expect([state.fielders[8].targetX, state.fielders[8].targetZ, state.fielders[8].speed]).toEqual([18500, 22000, 400])
    expect([state.fielders[7].targetX, state.fielders[7].targetZ]).toEqual([19700, 23500])
    expect([state.fielders[6].targetX, state.fielders[6].targetZ]).toEqual([22500, 23500])
    expect([state.fielders[5].targetX, state.fielders[5].targetZ, state.fielders[5].speed]).toEqual([18800, 24500, 250])
    expect([state.fielders[4].targetX, state.fielders[4].targetZ]).toEqual([20000, 24500])
    expect([state.fielders[3].targetX, state.fielders[3].targetZ]).toEqual([20500, 27200])
    expect([state.fielders[2].targetX, state.fielders[2].targetZ]).toEqual([20000, 25800])
    expect([state.fielders[1].targetX, state.fielders[1].targetZ]).toEqual([22600, 25000])
    expect([state.fielders[0].targetX, state.fielders[0].targetZ, state.fielders[0].speed]).toEqual([22030, 19410, 220])
  })

  it('틱 30 수비 동작 · 틱 60 공격 퇴장 · 타자 고개 70 · 80', () => {
    let state = startBenchClearingWalk(input)
    for (let t = 0; t <= 30; t += 1) state = stepBenchClearingWalk(state, t, input, null)
    expect(state.fielders.map((walker) => walker.action)).toEqual([0, 0, 2, 3, 4, 4, 1, 1, 1])
    for (let t = 31; t <= 60; t += 1) state = stepBenchClearingWalk(state, t, input, null)
    expect([state.offense[0].targetX, state.offense[0].targetZ]).toEqual([DUGOUT_POSITIONS[0].x, DUGOUT_POSITIONS[0].z])
    expect(state.offense[8].action).toBe(3)
    for (let t = 61; t <= 70; t += 1) state = stepBenchClearingWalk(state, t, input, null)
    expect(state.offense[8].action).toBe(4)
    for (let t = 71; t <= 80; t += 1) state = stepBenchClearingWalk(state, t, input, null)
    expect(state.offense[8].action).toBe(3)
  })

  it('원 닫기 — 틱 101 지름 240 → 틱 132 지름 7, 틱 133 에 나간다', () => {
    expect(benchClearingIrisOf(100)).toBeNull()
    expect(benchClearingIrisOf(101)).toEqual({ x: 0, y: 45, size: 240 })
    expect(benchClearingIrisOf(132)).toEqual({ x: 117, y: 162, size: 7 })
    expect(benchClearingIrisOf(133)).toBeNull()
    expect(BENCH_CLEARING_EXIT_TICK).toBe(133)
  })
})
