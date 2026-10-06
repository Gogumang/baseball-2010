import { describe, expect, it } from 'vitest'
import { buntStanceAfterSwingKey, isBuntJudgeFrame } from '@/widgets/batting-stage/lib/buntStance'

describe('번트 판정 시점 — 0x4e060 의 r7 (S+8 && 틱 == N−1)', () => {
  it('공이 N−1 틱에 닿을 때 판정한다 (그 전은 아니다)', () => {
    expect(isBuntJudgeFrame(16, 18)).toBe(false)
    expect(isBuntJudgeFrame(17, 18)).toBe(true)
  })
})

describe('번트 자세에서 스윙 키 — 0xb9374 가 S+8 이면 스윙을 안 낸다', () => {
  it('번트 종류는 그대로, 판정 F(+0xfd8)만 누른 틱으로', () => {
    expect(buntStanceAfterSwingKey({ kind: 2, frame: 4 }, 11)).toEqual({ kind: 2, frame: 11 })
  })
})
