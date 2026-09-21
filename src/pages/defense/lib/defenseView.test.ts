import { describe, expect, it } from 'vitest'
import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  DEFENDER_FRAMES,
  FIELDER_ACTION,
  FIELDER_ACTION_TICKS,
  FIELDER_FRAME_OFFSET,
  RUNNER_ACTION,
  RUNNER_SLIDE_TICKS,
  TICKS_PER_ACTION_FRAME,
  type DefenseFielder,
  type DefenseViewState,
  ballFrameOf,
  cameraTargetOf,
  fielderActionFrameOf,
  fielderFrameOf,
  fielderSpriteOf,
  flashOffsetOf,
  runnerFrameOf,
} from '@/pages/defense/lib/defenseView'

/**
 * 야수 동작 → 프레임 (R3 2-1 표 = I-controls 1c).
 * `fielderActionFrameOf` 는 vt40 날값이고, 실제로 그리는 프레임은 **+17** 이다 (S12 4-2·8-1).
 */
describe('야수 동작 번호', () => {
  it('그리는 프레임은 vt40 날값 + 17 이다 (defender.pzx 017~086 이 야수 칸)', () => {
    expect(FIELDER_FRAME_OFFSET).toBe(17)
    expect(fielderActionFrameOf(FIELDER_ACTION.runUp, 0)).toBe(3)
    // 프레임 020 = 뒤보고 달리기 — 에셋으로도 맞춰 본 값
    expect(fielderFrameOf(FIELDER_ACTION.runUp, 0)).toBe(20)
  })

  it('0 서 있기는 프레임 17 이다 (날값 0)', () => {
    expect(fielderFrameOf(FIELDER_ACTION.stand, 0)).toBe(17)
    expect(fielderFrameOf(FIELDER_ACTION.stand, 7)).toBe(17)
  })

  it('달리기 1·2·3·4 는 17 / 20 / 23 / 26 에서 [0,1,0,2] 로 돈다', () => {
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runDown, t))).toEqual([17, 18, 17, 19])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runUp, t))).toEqual([20, 21, 20, 22])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runLeft, t))).toEqual([23, 24, 23, 25])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runRight, t))).toEqual([26, 27, 26, 28])
  })

  it('5 송구는 29,30,31,29 다', () => {
    expect([0, 1, 2, 3, 4].map((t) => fielderFrameOf(FIELDER_ACTION.throw, t))).toEqual([29, 30, 31, 29, 29])
  })

  it('포구 6·7 은 한 번만 돌고 마지막 칸에 멈춘다', () => {
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.catchLow, t))).toEqual([35, 32, 17, 17])
    expect([0, 1, 2, 3, 4, 5, 6].map((t) => fielderFrameOf(FIELDER_ACTION.catchChest, t))).toEqual([
      32, 33, 34, 35, 32, 17, 17,
    ])
  })

  it('몸 날리기 8·9·a·b 는 방향별 한 장이다 — 42 / 45 / 39 / 36', () => {
    expect(fielderFrameOf(FIELDER_ACTION.diveDown, 3)).toBe(42)
    expect(fielderFrameOf(FIELDER_ACTION.diveUp, 3)).toBe(45)
    expect(fielderFrameOf(FIELDER_ACTION.diveLeft, 3)).toBe(39)
    expect(fielderFrameOf(FIELDER_ACTION.diveRight, 3)).toBe(36)
  })

  it('c 제자리 포구 35 · d 펌블 48~54 · e 점프 55~66', () => {
    expect(fielderFrameOf(FIELDER_ACTION.catchStill, 5)).toBe(35)
    expect(fielderFrameOf(FIELDER_ACTION.fumble, 0)).toBe(48)
    expect(fielderFrameOf(FIELDER_ACTION.fumble, 99)).toBe(54)
    expect(fielderFrameOf(FIELDER_ACTION.jumpCatch, 0)).toBe(55)
    expect(fielderFrameOf(FIELDER_ACTION.jumpCatch, 99)).toBe(66)
  })

  it('슬라이딩 캐치 f·10·11·12 는 77/82/72/67 + 0..4 다', () => {
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchDown, 2)).toBe(79)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchUp, 2)).toBe(84)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchLeft, 2)).toBe(74)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchRight, 99)).toBe(71)
  })

  it('거는 곳을 못 찾은 동작 0x78 은 날값 14 로 남겨 둔다', () => {
    expect(fielderActionFrameOf(FIELDER_ACTION.unknown0x78, 0)).toBe(14)
  })
})

/** 동작 프레임의 칸당 지속 틱과 한 번짜리 동작 길이 (S12 5절 확정) */
describe('동작 지속 틱', () => {
  it('한 칸 = 1틱이다 (주자 +0xb4 · 야수 +0xac 가 틱마다 +1)', () => {
    expect(TICKS_PER_ACTION_FRAME).toBe(1)
  })

  it('한 번짜리 동작 길이 — 송구 3 · 포구 3/6 · 몸날림 6 · 점프 16 · 슬라이딩 13 · 주자 슬라이딩 5', () => {
    expect(FIELDER_ACTION_TICKS).toEqual({
      throw: 3, catchLow: 3, catchChest: 6, dive: 6, jumpCatch: 16, slideCatch: 13,
    })
    expect(RUNNER_SLIDE_TICKS).toBe(5)
  })
})

/** 주자 동작 → 프레임 (R3 8-1 주자 vt40 = 0xa0070) */
describe('주자 동작 번호', () => {
  it('1 은 [0,1] 두 칸, 2~5 는 1/4/7/10 + [0,1,0,2] 다', () => {
    expect([0, 1, 2].map((t) => runnerFrameOf(RUNNER_ACTION.run, t, 0, true))).toEqual([0, 1, 0])
    expect([0, 1, 2, 3].map((t) => runnerFrameOf(RUNNER_ACTION.run2, t, 0, true))).toEqual([1, 2, 1, 3])
    expect([0, 1, 2, 3].map((t) => runnerFrameOf(RUNNER_ACTION.run3, t, 0, true))).toEqual([4, 5, 4, 6])
    expect([0, 1, 2, 3].map((t) => runnerFrameOf(RUNNER_ACTION.run4, t, 0, true))).toEqual([7, 8, 7, 9])
    expect([0, 1, 2, 3].map((t) => runnerFrameOf(RUNNER_ACTION.run5, t, 0, true))).toEqual([10, 11, 10, 12])
  })

  it('6 슬라이딩은 13 + 루 표다 — 진루 [2,3,0,1] · 귀루 [3,0,1,2]', () => {
    expect([0, 1, 2, 3].map((b) => runnerFrameOf(RUNNER_ACTION.slide, 0, b, true))).toEqual([15, 16, 13, 14])
    expect([0, 1, 2, 3].map((b) => runnerFrameOf(RUNNER_ACTION.slide, 0, b, false))).toEqual([16, 13, 14, 15])
  })
})

/** 마선수 수비 그림 (R3 7-1·7-3 · S12 8-2) */
describe('수비수 그림판 고르기', () => {
  const fielder = (overrides: Partial<DefenseFielder>): DefenseFielder => ({
    slot: 3,
    x: 0,
    z: 0,
    action: FIELDER_ACTION.stand,
    actionTick: 0,
    ...overrides,
  })

  it('마선수가 아니면 보통 defender 를 +17 한 프레임으로 쓴다', () => {
    expect(fielderSpriteOf(fielder({ aceIndex: null }))).toEqual({ folder: DEFENDER_FRAMES, frame: 17 })
  })

  it('타자 마선수(투수 칸이 아닌 곳)도 125장이라 +17 을 그대로 쓴다', () => {
    expect(fielderSpriteOf(fielder({ slot: 5, aceIndex: 4 }))).toEqual({
      folder: ACE_BATTER_DEFENDER_FRAMES[4],
      frame: 17,
    })
  })

  it('투수 마선수 그림(38장)만 +17 을 더하지 않는다 — 되돌리기 땜질이 필요 없다', () => {
    expect(fielderSpriteOf(fielder({ slot: 0, aceIndex: 1 }))).toEqual({
      folder: ACE_PITCHER_DEFENDER_FRAMES[1],
      frame: 0,
    })
    // 투수가 실제로 하는 동작은 펌블(날값 31~37)까지라 38장에 꼭 맞는다
    // — 점프·슬라이딩 캐치는 투수·포수 칸에서 굴리지 않는다(0x50faa, laserThrow.ts).
    const 펌블 = fielderSpriteOf(
      fielder({ slot: 0, aceIndex: 0, action: FIELDER_ACTION.fumble, actionTick: 99 }),
    )
    expect(펌블.folder).toBe(ACE_PITCHER_DEFENDER_FRAMES[0])
    expect(펌블.frame).toBe(37)
  })
})

/** 카메라 대상 (0x3f060) */
describe('카메라가 볼 점', () => {
  const base: DefenseViewState = {
    ball: { x: 20000, z: 24500, height: 3000, isFlying: true },
    fielders: [],
    runners: [{ index: 0, x: 25946, z: 24500, action: 1, actionTick: 0, base: 1, isAdvancing: true }],
  }

  it('공이 날아가는 중이면 (공 x, 공 z − 높이) 다', () => {
    expect(cameraTargetOf(base)).toEqual({ x: 20000, z: 21500 })
  })

  it('공이 멈추면 타자주자(주자 0)를 본다', () => {
    expect(cameraTargetOf({ ...base, ball: { ...base.ball, isFlying: false } })).toEqual({ x: 25946, z: 24500 })
  })

  it('따로 정한 대상이 있으면 그것이 먼저다 (경기 끝 직전 투수판)', () => {
    expect(cameraTargetOf({ ...base, cameraTarget: { x: 20000, z: 22500 } })).toEqual({ x: 20000, z: 22500 })
  })
})

/** 번쩍임 (R2 2절) */
describe('deadly_effect 자리', () => {
  it('B 는 공 위 50, C 는 방향별 ±10 이다', () => {
    expect(flashOffsetOf({ kind: 'b', step: 0 })).toEqual({ x: 0, y: -50 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0xf })).toEqual({ x: 0, y: 10 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0x10 })).toEqual({ x: 0, y: -10 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0x11 })).toEqual({ x: -10, y: 0 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0x12 })).toEqual({ x: 10, y: 0 })
    expect(flashOffsetOf({ kind: 'c', step: 0, direction: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('공 그림', () => {
  it('높이가 오르면 굵어지고 10 에서 멈춘다', () => {
    expect(ballFrameOf(0)).toBe(0)
    expect(ballFrameOf(1200)).toBe(2)
    expect(ballFrameOf(99999)).toBe(10)
    // 11칸을 넘지 않는다 — 011~022 는 불꽃 공, 023~033 은 날개 공(둘 다 마구 그림)이라
    // 보통 공에 섞여 나오면 안 된다
    expect(ballFrameOf(99999)).toBeLessThan(11)
  })
})
