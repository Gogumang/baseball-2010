import { describe, expect, it } from 'vitest'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'

describe('팀경기 정산(0x19) 배경 +0x17e2 — 진입 0x4ea0c = 0 · 갱신 0x4b100', () => {
  it('사람 팀이 이겼으면 들어선 틱부터 3 씩, 150 에서 멈춘다', () => {
    expect(settlementBackdropOffsetAt(0, true)).toBe(3)
    expect(settlementBackdropOffsetAt(1, true)).toBe(6)
    expect(settlementBackdropOffsetAt(48, true)).toBe(147)
    expect(settlementBackdropOffsetAt(49, true)).toBe(150)
    expect(settlementBackdropOffsetAt(1_000, true)).toBe(150)
  })

  it('지거나 비기면 0 그대로다 (r7 = 0 이면 4b15e 에서 건너뛴다)', () => {
    expect(settlementBackdropOffsetAt(0, false)).toBe(0)
    expect(settlementBackdropOffsetAt(100, false)).toBe(0)
  })
})
