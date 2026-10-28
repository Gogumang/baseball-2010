import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { magicInUseNumberOfCell, magicSelectBlockReasonOf, selectMagicPitch } from '@/entities/pitcher-career/model/pitchSelection'

const careerOf = (typeIndex: number) => ({ ...createPitcherCareer('투수'), typeIndex, magicLevel: 4 })

describe('123 마구 고르기 "사용 중" — 0xa43c4(저장, 칸)', () => {
  it('셋째 칸까지는 칸 + 1, 넷째 칸은 4 + 등록 타입과 견준다', () => {
    expect([0, 1, 2, 3].map((cell) => magicInUseNumberOfCell(cell, 0))).toEqual([1, 2, 3, 4])
    expect([0, 1, 2, 3].map((cell) => magicInUseNumberOfCell(cell, 2))).toEqual([1, 2, 3, 6])
  })

  it('타입 0 은 넷째 마구를 다시 고르면 "사용 중"', () => {
    const chosen = selectMagicPitch(careerOf(0), 3)
    expect(chosen.selectedMagicNumber).toBe(4)
    expect(magicSelectBlockReasonOf(chosen, 3)).toBe('사용중')
  })

  it('타입 1 · 2 는 저장 4 · 비교 5 · 6 이라 넷째 마구를 다시 골라도 "사용 중" 이 안 뜬다 (원본 어긋남 그대로)', () => {
    for (const typeIndex of [1, 2]) {
      const chosen = selectMagicPitch(careerOf(typeIndex), 3)
      expect(chosen.selectedMagicNumber).toBe(4)
      expect(magicSelectBlockReasonOf(chosen, 3)).toBeNull()
    }
  })

  it('앞 세 칸은 타입과 상관없이 "사용 중"', () => {
    const chosen = selectMagicPitch(careerOf(2), 1)
    expect(magicSelectBlockReasonOf(chosen, 1)).toBe('사용중')
  })
})
