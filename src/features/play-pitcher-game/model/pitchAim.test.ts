import { describe, expect, it } from 'vitest'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import {
  AIM_STILL,
  aimAfterTicks,
  aimKeyActionOf,
  aimStartOf,
  aimTickOf,
  gaugePressedCellOf,
  isPitchReleaseDue,
  isPitchSelectionDue,
  pitchSlotOfKey,
  stepAim,
} from '@/features/play-pitcher-game/model/pitchAim'

/** 굴림마다 values 를 차례로 쓰고 몇 번 굴렸는지 센다 — rand(a, b) = a + floor(v × (b − a)) */
const 차례난수 = (values: number[]) => {
  let index = 0
  const port: RandomPort = createFractionRandom(() => values[index++] ?? 0)
  return { port, drawn: () => index }
}
const C = ZONE_CENTERS[1]

describe('구질 키 0x534d8 → 메시지 7 의 칸', () => {
  it('OK·5 → 0, 2·위 → 1, 4·왼 → 2, 6·오른 → 3, 8·아래 → 4, 0 → 5', () => {
    expect(['Enter', ' ', '5'].map(pitchSlotOfKey)).toEqual([0, 0, 0])
    expect(['2', 'ArrowUp'].map(pitchSlotOfKey)).toEqual([1, 1])
    expect(['4', 'ArrowLeft'].map(pitchSlotOfKey)).toEqual([2, 2])
    expect(['6', 'ArrowRight'].map(pitchSlotOfKey)).toEqual([3, 3])
    expect(['8', 'ArrowDown'].map(pitchSlotOfKey)).toEqual([4, 4])
    expect(pitchSlotOfKey('0')).toBe(5)
  })

  it('견제 키 3·1·7 과 그 밖은 구질 메시지가 없다', () => {
    expect(['3', '1', '7', '9', '*', '#', 'Escape', 'a'].map(pitchSlotOfKey)).toEqual(Array(8).fill(null))
  })
})

describe('0xf → 0x10 넘김 0x39c1c — 틱 > 7 이고 구질이 정해졌을 때만', () => {
  it('틱 7 까지는 골라도 안 넘어가고 틱 8 에 넘어간다', () => {
    expect(isPitchSelectionDue(7, 0)).toBe(false)
    expect(isPitchSelectionDue(8, 0)).toBe(true)
  })

  it('안 골랐으면 틱이 지나도 머문다', () => {
    expect(isPitchSelectionDue(100, null)).toBe(false)
  })
})

describe('조준 키 — 메시지 8 0x50e3a', () => {
  it('2·위 = 위(dy +1), 8·아래 = 아래, 4·왼 · 6·오른, 1·3·7·9 대각선', () => {
    const 방향 = (key: string) => {
      const action = aimKeyActionOf(key)
      return action?.kind === 'move' ? [action.direction.dx, action.direction.dy] : action?.kind
    }
    expect([방향('2'), 방향('ArrowUp')]).toEqual([[0, 1], [0, 1]])
    expect([방향('8'), 방향('ArrowDown')]).toEqual([[0, -1], [0, -1]])
    expect([방향('4'), 방향('ArrowLeft')]).toEqual([[-1, 0], [-1, 0]])
    expect([방향('6'), 방향('ArrowRight')]).toEqual([[1, 0], [1, 0]])
    expect([방향('1'), 방향('3'), 방향('7'), 방향('9')]).toEqual([[-1, 1], [1, 1], [-1, -1], [1, -1]])
  })

  it('OK·5 는 확정, CLR 은 0xf 로, 그 밖 키(0 등)는 멈춤(dx = dy = 0)', () => {
    expect(aimKeyActionOf('Enter')).toEqual({ kind: 'confirm' })
    expect(aimKeyActionOf('5')).toEqual({ kind: 'confirm' })
    expect(aimKeyActionOf('Escape')).toEqual({ kind: 'cancel' })
    expect(aimKeyActionOf('0')).toEqual({ kind: 'move', direction: AIM_STILL })
  })
})

describe('조준점 0x39894 · 0x39c5c', () => {
  it('들어설 때 존 중심 표 0xcfbcc[side] 세 칸 그대로', () => {
    expect(aimStartOf(0)).toEqual(ZONE_CENTERS[0])
    expect(aimStartOf(1)).toEqual(ZONE_CENTERS[1])
  })

  it('한 틱에 x · y 는 20, z 는 dy × 10 을 뺀다', () => {
    expect(stepAim(C, { dx: 1, dy: 1 }, 1)).toEqual({ x: C.x + 20, y: C.y + 20, z: C.z - 10 })
    expect(stepAim(C, { dx: -1, dy: -1 }, 1)).toEqual({ x: C.x - 20, y: C.y - 20, z: C.z + 10 })
  })

  it('존 중심 기준 x ±600 · y ±400 · z ±200 에서 멈춘다', () => {
    expect(aimAfterTicks(1, { dx: 1, dy: 1 }, 100)).toEqual({ x: C.x + 600, y: C.y + 400, z: C.z - 200 })
    expect(aimAfterTicks(1, { dx: -1, dy: -1 }, 100)).toEqual({ x: C.x - 600, y: C.y - 400, z: C.z + 200 })
  })

  it('미션이 아니면 난수를 한 톨도 안 쓴다', () => {
    const random = 차례난수([0])
    aimTickOf(C, { dx: 1, dy: 0 }, 1, { conditionCode: 0, random: random.port })
    aimTickOf(C, { dx: 1, dy: 0 }, 1)
    expect(random.drawn()).toBe(0)
  })

  it('투수 미션은 걸음 · 자르기 뒤에 흔든다 — 세기 1 은 51% 로 가로 ±40', () => {
    // rand(0,100) = 0 ≤ 50 → 흔든다, rand(−40, 40) = −40
    const random = 차례난수([0, 0])
    expect(aimTickOf(C, { dx: 1, dy: 0 }, 1, { conditionCode: 1, random: random.port })).toEqual({
      x: C.x + 20 - 40,
      y: C.y,
      z: C.z,
    })
    expect(random.drawn()).toBe(2)
  })

  it('틱마다 굴린다 — 흔든 값은 다음 틱에야 잘린다', () => {
    const random = 차례난수([0, 0, 0, 0])
    const 끝 = { x: C.x + 600, y: C.y, z: C.z }
    // 세기 2: rand(0,100)=0 → 흔든다, x · y 각 rand(−80, 80) = −80
    const 첫틱 = aimTickOf(끝, { dx: 1, dy: 0 }, 1, { conditionCode: 2, random: random.port })
    expect(첫틱).toEqual({ x: C.x + 600 - 80, y: C.y - 80, z: C.z })
    expect(random.drawn()).toBe(3)
  })
})

describe('게이지 0x50e08 · 놓기 0x4e060', () => {
  it('처음 누름은 커서 칸을 적고, 이미 적힌 칸은 그대로다', () => {
    expect(gaugePressedCellOf(0, 6)).toBe(6)
    expect(gaugePressedCellOf(6, 9)).toBe(6)
  })

  it('커서 0 에서 누르면 0 이 남아 다시 누를 수 있다', () => {
    expect(gaugePressedCellOf(gaugePressedCellOf(0, 0), 7)).toBe(7)
  })

  it('놓기는 0x11 의 틱 10 — 누름과 상관없다', () => {
    expect(isPitchReleaseDue(9)).toBe(false)
    expect(isPitchReleaseDue(10)).toBe(true)
  })
})
