import { describe, expect, it } from 'vitest'
import { applyBaserunningKey, canReturnRunner, runnerIndexOnBase } from '@/entities/fielding/model/baserunningKey'
import { basePosition, SLIDING_SPEED_BONUS } from '@/entities/fielding/model/fieldGeometry'
import { createRunner, type RunnerState } from '@/entities/fielding/model/fieldingState'

/** 루 b 에 선 주자(+0x8c = +0x7c = b) */
const standing = (index: number, base: number): RunnerState => createRunner(index, base, 335, { isBatterRunner: index === 0 })

/** +0x8c = from 에서 +0x7c = to 로 가는 중인 주자 (두 루 사이 한가운데) */
const running = (index: number, from: number, to: number): RunnerState => {
  const a = basePosition(from)
  const b = basePosition(to)
  return {
    ...createRunner(index, from, 335, { isBatterRunner: index === 0 }),
    targetBase: to,
    position: { x: Math.trunc((a.x + b.x) / 2), y: 0, z: Math.trunc((a.z + b.z) / 2) },
  }
}

const keyOn = (runners: readonly RunnerState[], kind: '진루' | '귀루', target: 1 | 2 | 3 | '전원', playKind = 5) =>
  applyBaserunningKey({ playKind, homeRunFlag: false, runners, previousTargets: runners.map((runner) => runner.startBase) }, kind, target)

describe('사람 주루 키 0x582 · 0x584 → 0xa9b04', () => {
  it('인자는 +0x8c(닿은 루)로 찾는다 — 목록 앞에서부터 첫 산 주자 (0xa97a0)', () => {
    const runners = [running(0, 0, 1), running(1, 1, 2), standing(2, 3)]
    expect(runnerIndexOnBase(runners, 1)).toBe(1)
    expect(runnerIndexOnBase(runners, 3)).toBe(2)
    expect(runnerIndexOnBase(runners, 2)).toBe(-1)
    // 아웃 · 득점(+0x96)은 건너뛴다
    expect(runnerIndexOnBase([{ ...standing(1, 1), isOut: true }, standing(2, 1)], 1)).toBe(1)
    expect(runnerIndexOnBase([{ ...standing(1, 1), scored: true }], 1)).toBe(-1)
  })

  it('진루 — 목표 = +0x8c + 1 (0xb6228), 플레이+0x128 을 세울 성공(참)을 돌려준다', () => {
    const result = keyOn([standing(1, 1)], '진루', 1)
    expect(result.succeeded).toBe(true)
    expect(result.retargeted).toEqual([0])
    expect(result.runners[0]!.targetBase).toBe(2)
    // vt48 은 닿은 루 · 위치를 안 바꾼다 — +0x84 = 옛 +0x7c
    expect(result.runners[0]!.startBase).toBe(1)
    expect(result.runners[0]!.position).toEqual(basePosition(1))
    expect(result.previousTargets[0]).toBe(1)
  })

  it('진루 — 이미 다음 루로 가는 주자에게 눌러도 목표는 +0x8c + 1 그대로다 (+0x7c + 1 이 아니다)', () => {
    const result = keyOn([running(1, 1, 2)], '진루', 1)
    expect(result.succeeded).toBe(true)
    expect(result.runners[0]!.targetBase).toBe(2)
  })

  it('진루 — 3루 주자는 홈 4', () => {
    expect(keyOn([standing(1, 3)], '진루', 3).runners[0]!.targetBase).toBe(4)
  })

  it('진루 — 앞길 검사 0xa9924: 앞 주자가 바로 앞 루에 서 있으면 못 간다', () => {
    const result = keyOn([standing(1, 1), standing(2, 2)], '진루', 1)
    expect(result.succeeded).toBe(false)
    expect(result.runners[0]!.targetBase).toBe(1)
  })

  it('전원 진루(0)는 3 · 2 · 1 차례 — 앞 주자가 먼저 떠나 뒤 주자의 앞길이 열린다', () => {
    const result = keyOn([standing(1, 1), standing(2, 2), standing(3, 3)], '진루', '전원')
    expect(result.retargeted).toEqual([2, 1, 0])
    expect(result.runners.map((runner) => runner.targetBase)).toEqual([2, 3, 4])
  })

  it('귀루 — 목표 = +0x8c. 1루(또는 홈)로 가는 주자는 못 되돌린다 (0xa99a8 t ≤ 1)', () => {
    const back = keyOn([running(1, 2, 3)], '귀루', 2)
    expect(back.succeeded).toBe(true)
    expect(back.runners[0]!.targetBase).toBe(2)
    expect(back.previousTargets[0]).toBe(3)
    // 타자주자(홈 → 1루)는 +0x8c 가 0 이라 인자 1 로 안 잡히고, 1루에 닿은 뒤로는 t = 1 이라 거절된다
    expect(keyOn([standing(0, 1)], '귀루', 1).succeeded).toBe(false)
  })

  it('귀루 — 뒤 산 주자가 이미 닿은 루까지는 못 물러난다 (t − 1 ≤ 뒤.+0x8c → 0)', () => {
    // 1루에 선 타자주자 뒤로 2 → 3 가는 주자: t − 1 = 2 > 1 → 된다
    expect(canReturnRunner([standing(0, 1), running(1, 2, 3)], 1)).toBe(true)
    // 2루에 선 주자 뒤로 2 → 3 가는 주자: t − 1 = 2 ≤ 2 → 안 된다
    expect(canReturnRunner([standing(1, 2), running(2, 2, 3)], 1)).toBe(false)
    // 뒤 주자가 죽었으면 없는 것과 같다
    expect(canReturnRunner([{ ...standing(1, 2), isOut: true }, running(2, 2, 3)], 1)).toBe(true)
  })

  it('전원 귀루(CLR)는 1 · 2 · 3 차례', () => {
    const result = keyOn([running(1, 1, 2), running(2, 2, 3), running(3, 3, 4)], '귀루', '전원')
    expect(result.retargeted).toEqual([0, 1, 2])
    expect(result.runners.map((runner) => runner.targetBase)).toEqual([1, 2, 3])
  })

  it('판 종류 마스크 0xae794 = {1, 4, 5, 9} 밖(밀어내기 2 · 사건 6 · 7 · 10)이면 아무도 안 움직인다 — 경기+0x24 = 0 은 적는다', () => {
    for (const kind of [2, 3, 6, 7, 8, 10]) {
      const result = keyOn([standing(1, 1)], '진루', 1, kind)
      expect(result.handled).toBe(true)
      expect(result.succeeded).toBe(false)
    }
    for (const kind of [1, 4, 5, 9]) expect(keyOn([standing(1, 1)], '진루', 1, kind).succeeded).toBe(true)
  })

  it('플레이+0x111(홈런)이 서면 메시지가 통째로 아무것도 안 한다 (0x5209e · 0x5222a 머리)', () => {
    const result = applyBaserunningKey({ playKind: 1, homeRunFlag: true, runners: [standing(1, 1)], previousTargets: [1] }, '진루', 1)
    expect(result.handled).toBe(false)
    expect(result.succeeded).toBe(false)
  })

  it('vt48 은 슬라이딩을 푼다 — +0xb8 = 0 · 속도 −40 (0x9ff38 · vt44(0))', () => {
    const sliding = { ...running(1, 1, 2), sliding: true, speed: 335 + SLIDING_SPEED_BONUS }
    const result = keyOn([sliding], '귀루', 1)
    expect(result.runners[0]!.sliding).toBe(false)
    expect(result.runners[0]!.speed).toBe(335)
  })
})
