import { describe, expect, it } from 'vitest'
import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import {
  BASE_POSITIONS,
  runnerSpeedOf,
  SLIDING_PROGRESS_RANGE,
} from '@/entities/fielding/model/fieldGeometry'
import { createFielders, createRunner, NONE } from '@/entities/fielding/model/fieldingState'
import { viewStateOf, type ActionMemory } from '@/features/defense-play/model/defensePlayView'
import {
  cameraTargetOf,
  fielderFrameOf,
  FIELDER_ACTION,
  RUNNER_ACTION,
} from '@/pages/defense/lib/defenseView'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
const 주력 = runnerSpeedOf(500)

const 기본 = (memory: ActionMemory = new Map()) => ({
  tick: 0,
  ball: { x: 20_000, y: 1_000, z: 30_000 },
  ballIsFlying: true,
  fielders: 야수들,
  runners: [createRunner(0, 0, 주력, { targetBase: 1 })],
  catchKind: null,
  chaserSlot: 8,
  throwingSlot: NONE,
  throwBase: NONE,
  previousActions: memory,
})

describe('화면 스냅샷 만들기', () => {
  it('움직이지 않는 야수는 제자리 동작이다', () => {
    const view = viewStateOf(기본())

    expect(view.fielders.every((fielder) => fielder.action === FIELDER_ACTION.stand)).toBe(true)
    expect(view.fielders[8]).toMatchObject({ slot: 8, x: 20_000, z: 8_000 })
  })

  it('목표점 쪽으로 달리는 방향이 동작 번호가 된다 (R3 2-1)', () => {
    const 홈쪽 = { ...야수들[8], target: { x: 20_000, y: 0, z: 30_000 } }
    const 외야쪽 = { ...야수들[8], target: { x: 20_000, y: 0, z: 0 } }
    const 오른쪽 = { ...야수들[8], target: { x: 39_000, y: 0, z: 8_000 } }
    const 왼쪽 = { ...야수들[8], target: { x: 1_000, y: 0, z: 8_000 } }

    const 동작 = (fielder: typeof 홈쪽) =>
      viewStateOf({ ...기본(), fielders: [fielder] }).fielders[0].action

    expect(동작(홈쪽)).toBe(FIELDER_ACTION.runDown)
    expect(동작(외야쪽)).toBe(FIELDER_ACTION.runUp)
    expect(동작(오른쪽)).toBe(FIELDER_ACTION.runRight)
    expect(동작(왼쪽)).toBe(FIELDER_ACTION.runLeft)
  })

  it('포구 종류가 포구 동작으로 이어진다', () => {
    const 포구 = (kind: number) =>
      viewStateOf({ ...기본(), catchKind: kind, chaserSlot: 0 }).fielders[0].action

    expect(포구(CATCH_KIND.LOW)).toBe(FIELDER_ACTION.catchLow)
    expect(포구(CATCH_KIND.GROUNDER)).toBe(FIELDER_ACTION.catchLow)
    expect(포구(CATCH_KIND.CHEST)).toBe(FIELDER_ACTION.catchChest)
    expect(포구(CATCH_KIND.JUMP)).toBe(FIELDER_ACTION.jumpCatch)
  })

  it('송구 중인 야수는 송구 동작이다', () => {
    const view = viewStateOf({ ...기본(), throwingSlot: 5 })

    expect(view.fielders[5].action).toBe(FIELDER_ACTION.throw)
    // 화면 쪽 프레임 표와도 이어진다 (R3 2-1 = I 1c)
    expect(fielderFrameOf(FIELDER_ACTION.throw, 0)).toBe(12)
  })

  it('루에 서 있는 주자는 제자리, 뛰는 주자는 달리기다', () => {
    const 선주자 = createRunner(1, 1, 주력, { targetBase: 1 })
    const 뛰는주자 = createRunner(1, 1, 주력, { targetBase: 2 })

    expect(viewStateOf({ ...기본(), runners: [선주자] }).runners[0].action).toBe(RUNNER_ACTION.stand)
    expect(viewStateOf({ ...기본(), runners: [뛰는주자] }).runners[0].action).toBe(RUNNER_ACTION.run)
  })

  it('송구가 오는 루로 막판에 들어가면 슬라이딩한다 (진행률 71~94)', () => {
    const 일루 = BASE_POSITIONS[1]
    const 이루 = BASE_POSITIONS[2]
    const 진행률80 = {
      x: 일루.x + Math.trunc(((이루.x - 일루.x) * 80) / 100),
      y: 0,
      z: 일루.z + Math.trunc(((이루.z - 일루.z) * 80) / 100),
    }
    const 주자 = createRunner(1, 1, 주력, { targetBase: 2, legStart: 일루, position: 진행률80 })

    expect(SLIDING_PROGRESS_RANGE).toEqual({ minimum: 71, maximum: 94 })
    // 그 루로 송구가 오고 있을 때만 슬라이딩한다
    expect(viewStateOf({ ...기본(), runners: [주자], throwBase: 2 }).runners[0].action).toBe(
      RUNNER_ACTION.slide,
    )
    expect(viewStateOf({ ...기본(), runners: [주자], throwBase: NONE }).runners[0].action).toBe(
      RUNNER_ACTION.run,
    )
  })

  it('같은 동작이 이어지는 동안 actionTick 이 올라간다', () => {
    const memory: ActionMemory = new Map()
    const 틱들 = [0, 1, 2].map(
      (tick) => viewStateOf({ ...기본(memory), tick }).fielders[8].actionTick,
    )

    expect(틱들).toEqual([0, 1, 2])
  })

  it('화면 쪽 카메라 규칙이 이 스냅샷을 그대로 읽는다', () => {
    const view = viewStateOf(기본())

    expect(cameraTargetOf(view)).toEqual({ x: 20_000, z: 30_000 - 1_000 })
  })
})
