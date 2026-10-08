import { describe, expect, it } from 'vitest'
import { nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'

describe('105 진입 0x11910 의 관리 메뉴 커서 (1194a~11970)', () => {
  it('행동함이 아니면 남는다', () => {
    expect(nariMainCursorOnEntry(5, false, false)).toBe(5)
  })

  it('행동함이면 첫 칸 — 단 이전 상태 109 · 110 이면 남는다', () => {
    expect(nariMainCursorOnEntry(3, true, false)).toBe(0)
    expect(nariMainCursorOnEntry(4, true, true)).toBe(4)
  })
})
