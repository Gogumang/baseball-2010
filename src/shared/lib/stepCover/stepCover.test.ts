import { describe, expect, it } from 'vitest'
import { blackStepCoverOpacityOf, colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'

describe('단계 덮기 [0x15605d4] · [0x15605d0]', () => {
  it('검정 0x9aac4 는 화면을 단계/16 만큼 남긴다 — 단계 0 은 완전 검정', () => {
    expect(blackStepCoverOpacityOf(0)).toBe(1)
    expect(blackStepCoverOpacityOf(1)).toBe(15 / 16)
    expect(blackStepCoverOpacityOf(8)).toBe(8 / 16)
    expect(blackStepCoverOpacityOf(15)).toBe(1 / 16)
  })

  it('색 0x9a52c 는 색 몫 (단계 + 1)/16 — 단계 15 는 색 그대로', () => {
    expect(colorStepCoverOpacityOf(0)).toBe(1 / 16)
    expect(colorStepCoverOpacityOf(3)).toBe(4 / 16)
    expect(colorStepCoverOpacityOf(15)).toBe(1)
  })

  it('감싸는 0x9b234 · 0x9b3f4 는 단계가 0~15 밖이면 안 칠한다', () => {
    expect(blackStepCoverOpacityOf(16)).toBe(0)
    expect(colorStepCoverOpacityOf(16)).toBe(0)
    expect(blackStepCoverOpacityOf(-1)).toBe(0)
  })
})
