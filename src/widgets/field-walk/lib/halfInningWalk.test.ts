import { describe, expect, it } from 'vitest'
import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import { cameraBoundsOf, centerOn } from '@/pages/defense/lib/defenseCamera'
import { FIELDER_ACTION } from '@/pages/defense/lib/defenseView'
import {
  DUGOUT_POSITIONS,
  HALF_INNING_TOUR_SLOTS,
  halfInningNameTagSlotOf,
  halfInningWalkAt,
  startHalfInningWalk,
  stepHalfInningWalk,
} from '@/widgets/field-walk/lib/halfInningWalk'
import { nameTagBoxOf, nameTagPiecesOf } from '@/widgets/field-walk/lib/nameTag'

const BOUNDS = cameraBoundsOf(240, 320)
const rolls = Array.from({ length: 9 }, (_unused, i) => ({
  offenseSpeed: 300 + i, scatterX: 10 * i, scatterZ: 100 + i, fielderSpeed: 200 + i,
}))

describe('공수 교대 판 0x3fac4 — 18명 세우기', () => {
  it('경기 첫 판(자리 0): 카메라를 수비 측 더그아웃에 곧바로, 앞 수비는 (0, 0) 에 선다', () => {
    const state = startHalfInningWalk({ rolls, offenseSide: 0, previousFielders: null })
    // 초(공격 측 0)면 수비는 측 1 — 더그아웃 (29799, 30550)
    expect(state.camera).toEqual(centerOn(BOUNDS, DUGOUT_POSITIONS[1]))
    expect(state.offense.every((walker) => walker.x === 0 && walker.z === 0)).toBe(true)
    expect(state.offense.every((walker) => walker.targetX === 0 && walker.targetZ === 0)).toBe(true)
    // 공격 걸음은 굴림 그대로 (0xa21bc 를 안 탔다)
    expect(state.offense[3].speed).toBe(303)
  })

  it('새 수비 칸 i 는 더그아웃에서 (scatter + 100)·(8 − i) 만큼 안쪽에서 제자리 0xcfa8c[i] 로 — 걸음은 굴림', () => {
    const state = startHalfInningWalk({ rolls, offenseSide: 0, previousFielders: null })
    const dugout = DUGOUT_POSITIONS[1]
    expect([state.fielders[8].x, state.fielders[8].z]).toEqual([dugout.x, dugout.z])
    expect([state.fielders[0].x, state.fielders[0].z]).toEqual([dugout.x - (0 + 100) * 8, dugout.z - (100 + 100) * 8])
    expect([state.fielders[0].targetX, state.fielders[0].targetZ]).toEqual([FIELDER_START_POSITIONS[0].x, FIELDER_START_POSITIONS[0].z])
    expect(state.fielders[0].speed).toBe(200)
    // 투수 (28999, 28950) → (20000, 24500): |dx| 8999 > |dz| 4450, dx < 0 → 왼쪽 달리기(3)
    expect(state.fielders[0].action).toBe(FIELDER_ACTION.runLeft)
    // 카메라 목표 = 투수판 (20000, 24500 − 2000)
    expect(state.cameraTarget).toEqual(centerOn(BOUNDS, { x: 20000, z: 22500 }))
  })

  it('앞 판 자리가 있으면 앞 수비가 그 자리에서 공격 측 더그아웃으로 — 0xa21bc 뒤 굴림 걸음', () => {
    const state = startHalfInningWalk({ rolls, offenseSide: 1, previousFielders: FIELDER_START_POSITIONS })
    expect([state.offense[6].x, state.offense[6].z]).toEqual([30700, 12300])
    expect([state.offense[6].targetX, state.offense[6].targetZ]).toEqual([DUGOUT_POSITIONS[1].x, DUGOUT_POSITIONS[1].z])
    expect(state.offense[6].action).toBe(FIELDER_ACTION.runDown)
    expect(state.offense[6].speed).toBe(306)
  })
})

describe('공수 교대 판 0x4f7ac — 매 틱', () => {
  it('틱 ≤ 9 는 카메라가 안 움직이고 따라가기 % = 틱, 틱 10 부터 9% 로 다가간다', () => {
    const input = { rolls, offenseSide: 0 as const, previousFielders: null }
    const at9 = halfInningWalkAt(input, 9)
    expect(at9.camera).toEqual(startHalfInningWalk(input).camera)
    expect(at9.followPercent).toBe(9)
    const at10 = stepHalfInningWalk(at9, 10)
    expect(at10.camera).not.toEqual(at9.camera)
    expect(at10.camera.x - at9.camera.x).toBe(Math.trunc(((at9.cameraTarget.x - at9.camera.x) * 9) / 100))
  })

  it('걷는 틱마다 칸 +1 · 닿으면 서서 동작 0', () => {
    const input = { rolls, offenseSide: 0 as const, previousFielders: null }
    const start = startHalfInningWalk(input)
    const one = stepHalfInningWalk(start, 0)
    expect(one.fielders[0].actionTick).toBe(start.fielders[0].actionTick + 1)
    const late = halfInningWalkAt(input, 300)
    expect(late.fielders.every((walker, i) =>
      walker.x === FIELDER_START_POSITIONS[i].x && walker.z === FIELDER_START_POSITIONS[i].z && walker.action === 0)).toBe(true)
  })

  it('틱 100 뒤 카메라가 멈춘 틱마다 다음 야수를 비춘다 — 표 0xd044c, 이름표는 그 칸', () => {
    const input = { rolls, offenseSide: 0 as const, previousFielders: null }
    expect(halfInningNameTagSlotOf(halfInningWalkAt(input, 100), 100)).toBeNull()
    let state = halfInningWalkAt(input, 100)
    const seen: number[] = []
    for (let t = 101; t < 1500; t += 1) {
      state = stepHalfInningWalk(state, t)
      const slot = halfInningNameTagSlotOf(state, t)
      if (slot !== null && seen[seen.length - 1] !== state.tour) seen.push(state.tour)
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(HALF_INNING_TOUR_SLOTS[state.tour]).toBe(0)
  })
})

describe('운동장 전경 이름표 (4fbf6~4fe26)', () => {
  it('상자 = 자리 x − 26 · y + 5 · 53×15, 칠 셋 (밝은 띠는 높이 6)', () => {
    const box = nameTagBoxOf({ x: 120, y: 190 })
    expect(box).toEqual({ x: 94, y: 195, width: 53, height: 15 })
    const pieces = nameTagPiecesOf(box)
    expect(pieces[0]).toEqual({ x: 95, y: 196, width: 52, height: 14, color: 'rgb(24, 36, 90)' })
    expect(pieces.filter((piece) => piece.color === 'rgb(41, 60, 140)')[0]).toEqual({
      x: 97, y: 198, width: 48, height: 5, color: 'rgb(41, 60, 140)',
    })
  })
})
