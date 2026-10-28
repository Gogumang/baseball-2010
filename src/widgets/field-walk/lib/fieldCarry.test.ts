import { describe, expect, it } from 'vitest'
import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import { cameraBoundsOf, centerOn, stepCamera } from '@/pages/defense/lib/defenseCamera'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import {
  NEW_FIELD_CARRY,
  fieldCarryAfterBenchClearing,
  fieldCarryAfterHalfInning,
  fieldCarryAfterPlay,
  fieldCarryAfterRelay,
  isFieldCarryFresh,
} from '@/widgets/field-walk/lib/fieldCarry'
import { DUGOUT_POSITIONS, halfInningWalkAt, startHalfInningWalk } from '@/widgets/field-walk/lib/halfInningWalk'
import { halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { startBenchClearingWalk } from '@/widgets/field-walk/lib/benchClearingWalk'

const BOUNDS = cameraBoundsOf(240, 320)
const rolls = Array.from({ length: 9 }, (_unused, i) => ({
  offenseSpeed: 300 + i,
  scatterX: 10 * i,
  scatterZ: 100 + i,
  fielderSpeed: 200 + i,
}))

function viewAt(ball: { x: number; z: number; height?: number }, fielderX: number, extra: Partial<DefenseViewState> = {}) {
  return {
    ball: { x: ball.x, z: ball.z, height: ball.height ?? 0 },
    fielders: FIELDER_START_POSITIONS.map((home, slot) => ({ slot, x: home.x + fielderX, z: home.z, action: 0, actionTick: 0 })),
    runners: [],
    ...extra,
  } as unknown as DefenseViewState
}

describe('경기 장면이 들고 다니는 수비 줄 자리 · 카메라 (fieldCarry)', () => {
  it('경기 장면을 막 세웠으면 9명 모두 자리 0 — 0x3fac4 의 첫 판 갈래', () => {
    expect(isFieldCarryFresh(NEW_FIELD_CARRY)).toBe(true)
    expect(NEW_FIELD_CARRY.camera).toBeNull()
  })

  it('수비 화면 0x17 이 끝난 판 — 마지막 그림의 자리, 카메라는 진입 곧바로 + 그림마다 20% 따라가기(닫힌 그림은 선다)', () => {
    const ticks = [
      viewAt({ x: 20000, z: 29000 }, 0),
      viewAt({ x: 22000, z: 20000, height: 1000 }, 50),
      viewAt({ x: 24000, z: 15000 }, 100),
      viewAt({ x: 30000, z: 10000 }, 150, { cameraFrozen: true }),
    ]
    const carry = fieldCarryAfterPlay(ticks, NEW_FIELD_CARRY)
    expect(carry.fielders[3]).toEqual({ x: FIELDER_START_POSITIONS[3].x + 150, y: 0, z: FIELDER_START_POSITIONS[3].z })
    let camera = centerOn(BOUNDS, { x: 20000, z: 29000 })
    camera = stepCamera(BOUNDS, camera, { x: 22000, z: 19000 })
    camera = stepCamera(BOUNDS, camera, { x: 24000, z: 15000 })
    expect(carry.camera).toEqual(camera)
    expect(isFieldCarryFresh(carry)).toBe(false)
  })

  it('앞 판이 남긴 자리로 다음 판이 선다 — 앞 수비는 그 자리에서 공격 더그아웃으로, 카메라는 앞 카메라에서', () => {
    const carry = fieldCarryAfterPlay([viewAt({ x: 20000, z: 29000 }, 0)], NEW_FIELD_CARRY)
    const field = halfInningFieldOf({
      rolls,
      half: '말',
      carry,
      playerSide: 0,
      ourTeamId: 1,
      opponentTeamId: 2,
    })
    expect(field).toBeDefined()
    const state = startHalfInningWalk(field!.input)
    // 말(공격 측 1) — 앞 수비(측 0)는 제자리에서 측 1 더그아웃으로 들어간다
    expect([state.offense[2].x, state.offense[2].z]).toEqual([FIELDER_START_POSITIONS[2].x, FIELDER_START_POSITIONS[2].z])
    expect([state.offense[2].targetX, state.offense[2].targetZ]).toEqual([DUGOUT_POSITIONS[1].x, DUGOUT_POSITIONS[1].z])
    expect(state.camera).toEqual(carry.camera)
  })

  it('교대 판이 닫힌 틱의 새 수비 줄 · 카메라가 다음 판으로 — 삼진만 난 반 이닝도 그 자리에서 출발한다', () => {
    const input = { rolls, offenseSide: 0 as const, previousFielders: null }
    const walked = halfInningWalkAt(input, 40)
    const carry = fieldCarryAfterHalfInning(walked)
    expect(carry.fielders[0]).toEqual({ x: walked.fielders[0].x, y: 0, z: walked.fielders[0].z })
    expect(carry.camera).toEqual(walked.camera)
    const next = startHalfInningWalk({ rolls, offenseSide: 1, previousFielders: carry.fielders, previousCamera: carry.camera })
    expect([next.offense[0].x, next.offense[0].z]).toEqual([walked.fielders[0].x, walked.fielders[0].z])
    expect(next.camera).toEqual(walked.camera)
  })

  it('벤치 클리어링 뒤 — 수비 줄 자리, 카메라는 투수판에 곧바로 · 중계는 카메라만 투수판', () => {
    const entryRolls = Array.from({ length: 9 }, () => ({ scatterX: 0, scatterZ: 0, speed: 200, targetX: 0, targetZ: 0 }))
    const bench = startBenchClearingWalk({ entryRolls, offenseSide: 0, isLeftBatter: false, occupiedBases: [false, false, false] })
    const carry = fieldCarryAfterBenchClearing(bench)
    expect(carry.fielders[8]).toEqual({ x: FIELDER_START_POSITIONS[8].x, y: 0, z: FIELDER_START_POSITIONS[8].z })
    const plate = centerOn(BOUNDS, FIELDER_START_POSITIONS[0])
    expect(carry.camera).toEqual(plate)
    const relay = fieldCarryAfterRelay(NEW_FIELD_CARRY)
    expect(relay.camera).toEqual(plate)
    expect(relay.fielders).toBe(NEW_FIELD_CARRY.fielders)
  })
})
