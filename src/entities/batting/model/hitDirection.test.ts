import { describe, expect, it } from 'vitest'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정 = (value: number): RandomPort => ({ next: () => value, nextInRange: () => 0, pick: (items) => items[0] })

describe('hitDirectionOf — 0x5141c', () => {
  it('번트 코드에는 방향을 붙이지 않고 난수도 쓰지 않는다', () => {
    expect(hitDirectionOf({ code: 6, frame: 16, frameCount: 18, batterSide: 0 }, 고정(0))).toBe(0)
  })

  it('제때 치면 10~80 이 가운데, 그 밖은 양 끝이다', () => {
    const 제때 = { code: 15, frame: 16, frameCount: 18, batterSide: 0 }
    expect(hitDirectionOf(제때, 고정(0.5))).toBe(0) // r = 45
    expect(hitDirectionOf(제때, 고정(0.1))).toBe(1) // r = 9 < 10
    expect(hitDirectionOf(제때, 고정(0.9))).toBe(2) // r = 81 > 80
  })

  it('일찍 치면(cls 1) 70~80 만 가운데라 대부분 방향 1 이다', () => {
    const 이르게 = { code: 15, frame: 10, frameCount: 18, batterSide: 0 }
    expect(hitDirectionOf(이르게, 고정(0.5))).toBe(1)
  })

  it('타자 side 1 이면 cls 1·2 를 바꾼다', () => {
    const 이르게좌타 = { code: 15, frame: 10, frameCount: 18, batterSide: 1 }
    // cls 2 → (10, 20): r = 45 > 20 → 2
    expect(hitDirectionOf(이르게좌타, 고정(0.5))).toBe(2)
  })

  it('공 프레임 수가 1 이하면 나눗셈을 하지 않고 cls 0 으로 본다 (점검 10차)', () => {
    expect(hitDirectionOf({ code: 15, frame: 0, frameCount: 1, batterSide: 0 }, 고정(0.5))).toBe(0)
  })
})
