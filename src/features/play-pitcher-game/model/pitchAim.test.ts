import { describe, expect, it } from 'vitest'
import {
  gaugePressedCellOf,
  isPitchReleaseDue,
  isPitchSelectionDue,
  pitchSlotOfKey,
} from '@/features/play-pitcher-game/model/pitchAim'

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
