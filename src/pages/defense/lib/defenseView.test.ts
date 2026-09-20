import { describe, expect, it } from 'vitest'
import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  DEFENDER_FRAMES,
  FIELDER_ACTION,
  RUNNER_ACTION,
  type DefenseFielder,
  type DefenseViewState,
  ballFrameOf,
  ballShadowFrameOf,
  cameraTargetOf,
  fielderFrameOf,
  fielderFramesOf,
  flashOffsetOf,
  runnerFrameOf,
} from '@/pages/defense/lib/defenseView'

/** 야수 동작 → 프레임 (R3 2-1 표 = I-controls 1c) */
describe('야수 동작 번호', () => {
  it('0 서 있기는 프레임 0 이다', () => {
    expect(fielderFrameOf(FIELDER_ACTION.stand, 0)).toBe(0)
    expect(fielderFrameOf(FIELDER_ACTION.stand, 7)).toBe(0)
  })

  it('달리기 1·2·3·4 는 0 / 3 / 6 / 9 에서 [0,1,0,2] 로 돈다', () => {
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runDown, t))).toEqual([0, 1, 0, 2])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runUp, t))).toEqual([3, 4, 3, 5])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runLeft, t))).toEqual([6, 7, 6, 8])
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.runRight, t))).toEqual([9, 10, 9, 11])
  })

  it('5 송구는 12,13,14,12 다', () => {
    expect([0, 1, 2, 3, 4].map((t) => fielderFrameOf(FIELDER_ACTION.throw, t))).toEqual([12, 13, 14, 12, 12])
  })

  it('포구 6·7 은 한 번만 돌고 마지막 칸에 멈춘다', () => {
    expect([0, 1, 2, 3].map((t) => fielderFrameOf(FIELDER_ACTION.catchLow, t))).toEqual([18, 15, 0, 0])
    expect([0, 1, 2, 3, 4, 5, 6].map((t) => fielderFrameOf(FIELDER_ACTION.catchChest, t))).toEqual([
      15, 16, 17, 18, 15, 0, 0,
    ])
  })

  it('몸 날리기 8·9·a·b 는 방향별 한 장이다 — 25 / 28 / 22 / 19', () => {
    expect(fielderFrameOf(FIELDER_ACTION.diveDown, 3)).toBe(25)
    expect(fielderFrameOf(FIELDER_ACTION.diveUp, 3)).toBe(28)
    expect(fielderFrameOf(FIELDER_ACTION.diveLeft, 3)).toBe(22)
    expect(fielderFrameOf(FIELDER_ACTION.diveRight, 3)).toBe(19)
  })

  it('c 제자리 포구 18 · d 펌블 31~37 · e 점프 38~49', () => {
    expect(fielderFrameOf(FIELDER_ACTION.catchStill, 5)).toBe(18)
    expect(fielderFrameOf(FIELDER_ACTION.fumble, 0)).toBe(31)
    expect(fielderFrameOf(FIELDER_ACTION.fumble, 99)).toBe(37)
    expect(fielderFrameOf(FIELDER_ACTION.jumpCatch, 0)).toBe(38)
    expect(fielderFrameOf(FIELDER_ACTION.jumpCatch, 99)).toBe(49)
  })

  it('슬라이딩 캐치 f·10·11·12 는 60/65/55/50 + 0..4 다', () => {
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchDown, 2)).toBe(62)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchUp, 2)).toBe(67)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchLeft, 2)).toBe(57)
    expect(fielderFrameOf(FIELDER_ACTION.slideCatchRight, 99)).toBe(54)
  })

  it('거는 곳을 못 찾은 동작 0x78 은 프레임 14 로 남겨 둔다', () => {
    expect(fielderFrameOf(FIELDER_ACTION.unknown0x78, 0)).toBe(14)
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

/** 마선수 수비 그림 (R3 7-1·7-3) */
describe('수비수 그림판 고르기', () => {
  const fielder = (overrides: Partial<DefenseFielder>): DefenseFielder => ({
    slot: 3,
    x: 0,
    z: 0,
    action: 0,
    actionTick: 0,
    ...overrides,
  })

  it('마선수가 아니면 보통 defender 다', () => {
    expect(fielderFramesOf(fielder({ aceIndex: null }), 0)).toBe(DEFENDER_FRAMES)
  })

  it('투수 칸은 투수 마선수 그림, 다른 칸은 타자 마선수 그림이다', () => {
    expect(fielderFramesOf(fielder({ slot: 0, aceIndex: 1 }), 0)).toBe(ACE_PITCHER_DEFENDER_FRAMES[1])
    expect(fielderFramesOf(fielder({ slot: 5, aceIndex: 4 }), 0)).toBe(ACE_BATTER_DEFENDER_FRAMES[4])
  })

  it('투수 마선수 그림은 38장뿐이라 그보다 큰 프레임은 보통 그림으로 되돌린다', () => {
    expect(fielderFramesOf(fielder({ slot: 0, aceIndex: 0 }), 37)).toBe(ACE_PITCHER_DEFENDER_FRAMES[0])
    expect(fielderFramesOf(fielder({ slot: 0, aceIndex: 0 }), 38)).toBe(DEFENDER_FRAMES)
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
    expect(ballShadowFrameOf(1200)).toBe(25)
  })
})
