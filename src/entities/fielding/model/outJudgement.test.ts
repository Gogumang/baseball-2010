import { describe, expect, it } from 'vitest'
import { basePosition, FIELDER_COUNT } from '@/entities/fielding/model/fieldGeometry'
import {
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import {
  baseUnderFoot,
  isStillForced,
  judgeOut,
  OUT_KIND,
  releaseForcesAfterOut,
} from '@/entities/fielding/model/outJudgement'

/** 루 위에 정확히 선, 공을 쥔 야수 하나 (나머지 여덟은 시작 위치 그대로) */
function 루에선야수(slot: number, base: number): FielderState[] {
  const point = basePosition(base)
  return createFielders(Array.from({ length: FIELDER_COUNT }, () => 500)).map((fielder) =>
    fielder.slot === slot
      ? { ...fielder, position: point, target: point, targetBase: base, holdingBall: true }
      : fielder,
  ) as FielderState[]
}

function 문맥(fielders: readonly FielderState[], runners: readonly RunnerState[], slot: number): DefenseContext {
  return {
    play: { ...initialPlayView(1), ballHolderSlot: slot, held: true, everHeld: true },
    fielders,
    runners,
    currentTick: 10,
    landingTick: 5,
  }
}

/** 루 사이 어디쯤 — 목표 루에서 `뒤로` 만큼 떨어진 점 (x 축으로만 민다) */
function 달리는중(runner: RunnerState, 뒤로: number): RunnerState {
  const target = basePosition(runner.targetBase)
  return { ...runner, position: { x: target.x - 뒤로, y: 0, z: target.z } }
}

describe('아웃 판정 0xb36d0 — 0/1/2/3 을 갈라서 돌려준다', () => {
  it('야수.vt58 = 0xa0ae4 는 좌표가 비트까지 같은 루만 "발밑 루" 로 본다', () => {
    const 야수 = 루에선야수(3, 2)[3]
    expect(baseUnderFoot(야수)).toBe(2)
    expect(baseUnderFoot({ ...야수, position: { x: 야수.position.x + 1, y: 0, z: 야수.position.z } })).toBe(NONE)
  })

  it('3 = 태그 — 공 쥔 야수와의 거리가 499 이하이고 주자가 루에 안 붙었으면 아웃 (0xb380e)', () => {
    // **포스가 아닌 주자**를 써야 태그 갈래만 남는다 — 1루가 빈 2루 주자다.
    // (포스가 걸린 주자는 뒤의 2a 갈래가 같은 자리를 덮어써 루 아웃이 된다. 아래 시험 참고)
    const 주자 = [createRunner(0, 0, 335), 달리는중(createRunner(1, 2, 335, { targetBase: 3 }), 400)]
    const 야수 = 루에선야수(3, 3)
    expect(judgeOut({ ...문맥(야수, 주자, 3), skipRunnerIndexes: [0] })).toEqual({
      kind: OUT_KIND.TAG,
      runnerIndex: 1,
    })
  })

  it('2a 가 3a 를 덮어쓴다 — 밀려 있는 주자는 달려가는 루(+0x7c)를 밟은 야수에게 루 아웃 (0xb3890)', () => {
    // 1루 주자가 2루로 뛰는 중, 공 쥔 야수가 2루를 밟고 있다.
    // 주자관리 vt10(0xa9f60)은 `산 주자 수 > [주자+0x8c]` — **닿은 루**가 아직 1이라 참이다.
    const 주자 = [createRunner(0, 0, 335), 달리는중(createRunner(1, 1, 335, { targetBase: 2 }), 400)]
    expect(judgeOut({ ...문맥(루에선야수(3, 2), 주자, 3), skipRunnerIndexes: [0] })).toEqual({
      kind: OUT_KIND.BASE,
      runnerIndex: 1,
    })
  })

  it('499 를 넘으면 아웃이 아니다 — 500 은 세이프다', () => {
    const 주자 = [createRunner(0, 0, 335), 달리는중(createRunner(1, 2, 335, { targetBase: 3 }), 500)]
    expect(judgeOut({ ...문맥(루에선야수(3, 3), 주자, 3), skipRunnerIndexes: [0] }).kind).toBe(OUT_KIND.NONE)
  })

  it('루에 붙어 멈춘 주자는 태그가 안 된다 — 주자.vt18 = 0xbf3a0 (위치 == 목표점)', () => {
    // 목표 루에 정확히 서 있는 주자. 야수가 같은 루를 밟고 공을 쥐고 있어도 거리 0 으로 안 죽는다
    const 주자 = [createRunner(0, 0, 335), createRunner(1, 2, 335, { targetBase: 2 })]
    expect(judgeOut({ ...문맥(루에선야수(3, 2), 주자, 3), skipRunnerIndexes: [0] }).kind).toBe(OUT_KIND.NONE)
  })

  it('공을 쥔 야수가 없으면(P+0x12c = 0) 아무 갈래도 안 선다', () => {
    const 주자 = [createRunner(0, 0, 335), 달리는중(createRunner(1, 1, 335, { targetBase: 2 }), 300)]
    const 문 = 문맥(루에선야수(3, 2), 주자, 3)
    expect(judgeOut({ ...문, play: { ...문.play, held: false }, skipRunnerIndexes: [0] }).kind).toBe(OUT_KIND.NONE)
  })

  it('2 = 루 아웃 — 요구 루(+0x88)를 밟은 야수가 공을 쥐면 거리와 상관없이 아웃 (0xb38e4)', () => {
    // 태그 거리 밖(5000)이지만 요구 루가 서 있으면 포스로 죽는다
    const 주자 = [
      createRunner(0, 0, 335),
      달리는중(createRunner(1, 1, 335, { targetBase: 2, requiredBase: 2 }), 5000),
    ]
    expect(judgeOut({ ...문맥(루에선야수(3, 2), 주자, 3), skipRunnerIndexes: [0] })).toEqual({
      kind: OUT_KIND.BASE,
      runnerIndex: 1,
    })
  })

  it('요구 루가 −1 이고 밀려 있지도 않으면 아웃이 아니다 — 태그를 받아야 죽는다', () => {
    // 1루가 빈 2루 주자 — 요구 루도 없고 vt10 도 거짓이라 2a·2b 가 둘 다 안 선다
    const 주자 = [createRunner(0, 0, 335), 달리는중(createRunner(1, 2, 335, { targetBase: 3 }), 5000)]
    expect(judgeOut({ ...문맥(루에선야수(3, 3), 주자, 3), skipRunnerIndexes: [0] }).kind).toBe(OUT_KIND.NONE)
  })

  it('앞선 주자부터 본다 — 뒤 주자와 앞 주자가 다 걸리면 번호가 큰 쪽이 먼저 죽는다', () => {
    const 주자 = [
      createRunner(0, 0, 335),
      달리는중(createRunner(1, 1, 335, { targetBase: 2, requiredBase: 2 }), 5000),
      달리는중(createRunner(2, 2, 335, { targetBase: 2, requiredBase: 2 }), 5000),
    ]
    expect(judgeOut({ ...문맥(루에선야수(3, 2), 주자, 3), skipRunnerIndexes: [0] }).runnerIndex).toBe(2)
  })

  it('주자관리 vt10 = 0xa9f60 — "산 주자 수 > **마지막으로 닿은 루**(+0x8c)" 일 때 아직 밀려 있다', () => {
    // 0xa9f60: `r2 = 주자+0x78 ; r3 = [r2,#0x14]`(= +0x8c) ; 산 주자 수 > r3 → 1.
    // 곧 왼쪽 항은 **닿은 루**(이 모델의 `startBase`)다 — 뛰기 시작했다고 풀리지 않는다.
    const 루에붙은1루주자 = [createRunner(0, 0, 335, { targetBase: 1 }), createRunner(1, 1, 335, { targetBase: 1 })]
    expect(isStillForced(루에붙은1루주자, 1)).toBe(true)
    const 뛰기시작 = [createRunner(0, 0, 335, { targetBase: 1 }), createRunner(1, 1, 335, { targetBase: 2 })]
    expect(isStillForced(뛰기시작, 1)).toBe(true)
    // 2루를 **밟고 나서야** 풀린다 (0xa040c 도착이 +0x8c = +0x7c 로 굳힌 뒤다)
    const 이미2루 = [createRunner(0, 0, 335, { targetBase: 1 }), createRunner(1, 2, 335, { targetBase: 3 })]
    expect(isStillForced(이미2루, 1)).toBe(false)
  })

  it('0xa9648 — 죽은 주자부터 뒤로, 요구 루가 목표 루보다 앞이면 포스를 푼다', () => {
    const 주자 = [
      createRunner(0, 0, 335, { targetBase: 1, requiredBase: 1 }),
      createRunner(1, 1, 335, { targetBase: 1, requiredBase: 2, isOut: true }),
      createRunner(2, 2, 335, { targetBase: 2, requiredBase: 3 }),
    ]
    const 푼뒤 = releaseForcesAfterOut(주자)

    expect(푼뒤[0].requiredBase).toBe(1) // 죽은 주자 앞은 그대로
    expect(푼뒤[1].requiredBase).toBe(NONE)
    expect(푼뒤[2].requiredBase).toBe(NONE)
  })
})
