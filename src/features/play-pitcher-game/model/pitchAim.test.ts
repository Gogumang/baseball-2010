import { describe, expect, it } from 'vitest'
import {
  gaugePressedCellOf,
  isPitchReleaseDue,
} from '@/features/play-pitcher-game/model/pitchAim'

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
