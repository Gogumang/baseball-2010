import { describe, expect, it } from 'vitest'
import { createFielders, type FielderState } from '@/entities/fielding/model/fieldingState'
import {
  FIELDER_ACTION,
  POSE,
  canStepNextListTick,
  isFreeToRetarget,
  isReadyToThrow,
  listTickFielder,
  withAction,
  withCatchMotion,
  withFlyWaitPose,
  withThrowMotion,
} from '@/entities/fielding/model/fielderPose'

const 야수 = (): FielderState => createFielders(Array(9).fill(500))[3]

/** 동작 시작 틱 S 에 세터를 걸고 야수 틱을 돌려, 워드가 남은 마지막 판 틱(S + n)의 n 을 센다 */
function 남는틱(kind: number): number {
  let fielder = withCatchMotion(야수(), kind)
  let after = 0
  while (fielder.pose !== 0) {
    fielder = listTickFielder(fielder)
    after += 1
  }
  return after - 1
}

describe('포구 동작 표 0xd87f4 · 지우기 a137a~a1456', () => {
  it('종류마다 동작 번호와 자세 바이트를 세운다 (vt94 · vt5c · vt60 · vt90 · vt98)', () => {
    expect(withCatchMotion(야수(), 0)).toMatchObject({ action: FIELDER_ACTION.LOW_CATCH, pose: POSE.LOW })
    expect(withCatchMotion(야수(), 1)).toMatchObject({ action: FIELDER_ACTION.CHEST_CATCH, pose: POSE.FREEZE })
    expect(withCatchMotion(야수(), 2)).toMatchObject({ action: FIELDER_ACTION.GROUNDER_CATCH, pose: POSE.LOW_SWEEP })
    expect(withCatchMotion(야수(), 3)).toMatchObject({ action: FIELDER_ACTION.JUMP_CATCH, pose: POSE.FREEZE })
    expect(withCatchMotion(야수(), 4)).toMatchObject({ action: FIELDER_ACTION.SLIDE_CATCH, pose: POSE.LOW_SWEEP })
    // b414c — 0~4 밖은 아무것도 안 한다
    expect(withCatchMotion(야수(), 5)).toEqual(야수())
  })

  it('워드는 낮은 공 S+1 · 가슴 S+4 · 바운드 전 S+4 · 점프 S+14 · 슬라이딩 S+11 까지 남는다', () => {
    expect([0, 1, 2, 3, 4].map(남는틱)).toEqual([1, 4, 4, 14, 11])
  })

  it('워드가 남은 동안 vtC4 · vtcc 가 거짓이다 — 준비 틱이 먼저 다 줄어도 못 던진다', () => {
    // 바운드 전 낮은 공: 동작 시작 S = 포구 C − 1, 내야 준비 3 틱 → 원본은 C + 4 에 던진다
    let fielder = withCatchMotion(야수(), 2)
    fielder = listTickFielder(fielder) // C — 쥐기가 준비 틱 3 을 넣는다
    fielder = { ...fielder, holdingBall: true, actionRemainingTicks: 3 }
    const 준비 = [] as boolean[]
    for (let tick = 1; tick <= 4; tick += 1) {
      fielder = listTickFielder(fielder)
      준비.push(isReadyToThrow(fielder))
    }
    expect(준비).toEqual([false, false, false, true])
    expect(isFreeToRetarget(fielder)).toBe(true)
  })

  it('던진 야수(동작 5 · +0xb1)는 다음 야수 틱에 걸음 없이 지워진다 (vtc8 거짓)', () => {
    const thrown = withThrowMotion(야수())
    expect(canStepNextListTick(thrown)).toBe(false)
    expect(listTickFielder(thrown)).toMatchObject({ pose: 0, action: FIELDER_ACTION.NONE, actionFrame: 1 })
  })

  it('점프 · 가슴 높이(+0xb0) 동작은 프레임 1 · 2 만 걷는다 (0xa0f7c)', () => {
    let fielder = withCatchMotion(야수(), 3)
    const 걸음 = [] as boolean[]
    for (let tick = 0; tick < 5; tick += 1) {
      걸음.push(canStepNextListTick(fielder))
      fielder = listTickFielder(fielder)
    }
    expect(걸음).toEqual([true, true, false, false, false])
    // 슬라이딩(+0xb3)은 안 막는다
    expect(canStepNextListTick(withCatchMotion(야수(), 4))).toBe(true)
  })

  it('vt44 는 같은 번호면 프레임을 안 되감는다 — 뜬공 기다리기(0xc)는 매 틱 불려도 프레임이 오른다', () => {
    let fielder = withFlyWaitPose(야수())
    fielder = listTickFielder(fielder)
    fielder = withFlyWaitPose(fielder)
    expect(fielder).toMatchObject({ action: FIELDER_ACTION.WAIT_FLY, actionFrame: 1, pose: POSE.LOW })
    // 기다리는 동안은 지우지 않는다(동작 0xc 는 지우기 칸이 없다)
    for (let tick = 0; tick < 10; tick += 1) fielder = listTickFielder(fielder)
    expect(fielder.pose).toBe(POSE.LOW)
    expect(withAction(fielder, FIELDER_ACTION.LOW_CATCH).actionFrame).toBe(0)
  })

  it('잠금 +0xb4 가 있으면 프레임만 오르고 지우기는 없다 — 0 이 되는 틱의 vt10 이 지운다', () => {
    let fielder: FielderState = { ...withCatchMotion(야수(), 1), actionLockTicks: 2 }
    fielder = listTickFielder(fielder)
    expect(fielder).toMatchObject({ actionLockTicks: 1, pose: POSE.FREEZE, actionFrame: 1 })
    fielder = listTickFielder(fielder)
    expect(fielder).toMatchObject({ actionLockTicks: 0, pose: 0, action: FIELDER_ACTION.NONE, actionFrame: 2 })
  })
})
