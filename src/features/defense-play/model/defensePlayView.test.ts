import { describe, expect, it } from 'vitest'
import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import {
  BASE_POSITIONS,
  runnerSpeedOf,
  SLIDING_PROGRESS_RANGE,
} from '@/entities/fielding/model/fieldGeometry'
import { createFielders, createRunner, NONE } from '@/entities/fielding/model/fieldingState'
import {
  aceIndexesWithOriginalBug,
  viewStateOf,
  type ActionMemory,
} from '@/features/defense-play/model/defensePlayView'
import {
  ACE_PITCHER_DEFENDER_FRAMES,
  cameraTargetOf,
  DEFENDER_FRAMES,
  fielderFrameOf,
  fielderSpriteOf,
  FIELDER_ACTION,
  flashOffsetOf,
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
    // 화면 쪽 프레임 표와도 이어진다 (R3 2-1 = I 1c, 그리는 프레임은 날값 12 + 17)
    expect(fielderFrameOf(FIELDER_ACTION.throw, 0)).toBe(29)
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

describe('마선수 그림 (R3 7-1 · C-16)', () => {
  it('마선수 번호를 주면 야수 칸마다 실어 준다', () => {
    const view = viewStateOf({ ...기본(), aceIndexes: [3, null, undefined, 0] })

    expect(view.fielders[0].aceIndex).toBe(3)
    expect(view.fielders[3].aceIndex).toBe(0)
    expect(view.fielders[1].aceIndex).toBeNull()
    expect(view.fielders[2].aceIndex).toBeNull()
    // 표에 아예 없는 칸도 보통 수비수다
    expect(view.fielders[8].aceIndex).toBeNull()
  })

  it('마선수는 제 그림판을 쓰고, 안 주면 보통 defender 다', () => {
    const 마선수 = viewStateOf({ ...기본(), aceIndexes: [1] })
    const 보통 = viewStateOf(기본())

    // 투수 칸(0) 마선수는 투수 그림판 · 날값 그대로, 보통 수비수는 defender · 날값 +17 (S12 8-2)
    expect(fielderSpriteOf(마선수.fielders[0])).toEqual({
      folder: ACE_PITCHER_DEFENDER_FRAMES[1],
      frame: 0,
    })
    expect(fielderSpriteOf(보통.fielders[0]).folder).toBe(DEFENDER_FRAMES)
  })

  it('0~4 를 벗어난 번호는 무시한다', () => {
    const view = viewStateOf({ ...기본(), aceIndexes: [-1, 5, 1.5] })

    expect(view.fielders.slice(0, 3).map((fielder) => fielder.aceIndex)).toEqual([null, null, null])
  })

  it('진행기는 표를 그대로 넘긴다 — 팀당 하나로 뭉개 주지 않는다 (R3 7-3)', () => {
    const view = viewStateOf({ ...기본(), aceIndexes: [null, null, 1, null, null, null, 3] })

    expect(view.fielders[2].aceIndex).toBe(1)
    expect(view.fielders[6].aceIndex).toBe(3)
  })

  it('뭉개기는 부르는 쪽이 한다 — 타자 마선수 칸이 모두 첫째 번호가 된다 (원본 버그)', () => {
    // 칸 0 은 투수 마선수(표 0xd4008)라 따로 적재된다 — 뭉개기에서 빠진다
    const 뭉갠표 = aceIndexesWithOriginalBug([2, null, 1, null, null, null, 3, undefined, 4])

    expect(뭉갠표).toEqual([2, null, 1, null, null, null, 1, undefined, 1])

    const view = viewStateOf({ ...기본(), aceIndexes: 뭉갠표 })
    expect(view.fielders.map((fielder) => fielder.aceIndex)).toEqual([2, null, 1, null, null, null, 1, null, 1])
  })

  it('타자 마선수가 없거나 표를 안 주면 뭉갤 것도 없다', () => {
    expect(aceIndexesWithOriginalBug(undefined)).toBeUndefined()
    expect(aceIndexesWithOriginalBug([3, null, null])).toEqual([3, null, null])
    // 0~4 밖은 마선수가 아니므로 첫째로 세지 않는다
    expect(aceIndexesWithOriginalBug([null, 9, null, 2, null, 0])).toEqual([null, 9, null, 2, null, 2])
  })
})

describe('레이저 송구 반짝임 칸 (경기+0x19ad — 0x43406~0x4342c)', () => {
  it('진행기가 준 칸이 화면 스냅샷까지 내려간다', () => {
    expect(viewStateOf({ ...기본(), laserShiningSlot: 6 }).laserShiningSlot).toBe(6)
  })

  it('안 주거나 −1 이면 아무도 안 반짝인다', () => {
    expect(viewStateOf(기본()).laserShiningSlot).toBeNull()
    expect(viewStateOf({ ...기본(), laserShiningSlot: NONE }).laserShiningSlot).toBeNull()
    expect(viewStateOf({ ...기본(), laserShiningSlot: 9 }).laserShiningSlot).toBeNull()
  })

  it('deadly_effect 번쩍임과는 다른 칸이다 — 반짝여도 flash 는 안 뜬다', () => {
    const view = viewStateOf({ ...기본(), laserShiningSlot: 8 })

    expect(view.flash).toBeNull()
  })
})

describe('팀 번호 (C-1 — 그림 색 갈아 끼우기)', () => {
  it('수비·공격 팀 번호를 야수와 주자에 따로 실어 준다', () => {
    const view = viewStateOf({ ...기본(), defenseTeamIndex: 4, offenseTeamIndex: 11 })

    expect(view.fielders[0].teamIndex).toBe(4)
    expect(view.runners[0].teamIndex).toBe(11)
  })

  it('안 주면 null 이라 구운 색 그대로다', () => {
    const view = viewStateOf(기본())

    expect(view.fielders[0].teamIndex).toBeNull()
    expect(view.runners[0].teamIndex).toBeNull()
  })
})

describe('공 자리 번쩍임 (R2 2절 — deadly_effect)', () => {
  it('스냅샷은 번쩍임을 고르지 않는다 — 필살 포구 동작 중이어도 null, 연출 단계 기계(`defenseScene`)가 그린 그림에만 실린다', () => {
    for (const catchKind of [CATCH_KIND.LOW, CATCH_KIND.CHEST, CATCH_KIND.GROUNDER, CATCH_KIND.JUMP, CATCH_KIND.SLIDE]) {
      expect(viewStateOf({ ...기본(), chaserSlot: 0, catchKind }).flash).toBeNull()
    }
    expect(flashOffsetOf({ kind: 'b', step: 0 })).toEqual({ x: 0, y: -50 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0xf })).toEqual({ x: 0, y: 10 })
  })
})
