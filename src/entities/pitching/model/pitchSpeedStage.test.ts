import { describe, expect, it } from 'vitest'
import { pitchFrameCountOf, pitchSpeedStageOf } from '@/entities/pitching/model/pitchSpeedStage'

describe('구속 단계 — 0x34968 · 0x66c98', () => {
  it('FASTBALL(식 A) 제구·구속 300, 등급 3 이면 v 300 → rank 2 → 단계 1', () => {
    expect(pitchSpeedStageOf(0, { control: 300, velocity: 300, breaking: 300 }, 3)).toBe(1)
    expect(pitchFrameCountOf(0, { control: 300, velocity: 300, breaking: 300 }, 3)).toBe(16)
  })

  it('능력치가 999 면 rank 7 → 단계 3', () => {
    expect(pitchSpeedStageOf(0, { control: 999, velocity: 999, breaking: 999 }, 5)).toBe(3)
  })

  it('등급 0 은 능력치를 70% 로 본다', () => {
    // 300×0.7 = 210 → v = 63+147 = 210 → rank 1 → 단계 0
    expect(pitchSpeedStageOf(0, { control: 300, velocity: 300, breaking: 300 }, 0)).toBe(0)
  })

  it('CHANGEUP(구질 9, 식 F)은 제구·변화로 정한다', () => {
    // F = trunc(a0/5) + trunc(a2×8/10) = 20 + 80 = 100 → rank 0
    expect(pitchSpeedStageOf(8, { control: 100, velocity: 999, breaking: 100 }, 3)).toBe(0)
  })
})
