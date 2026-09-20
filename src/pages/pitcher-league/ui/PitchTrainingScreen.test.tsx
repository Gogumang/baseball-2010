// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'
import { hasPitchType } from '@/entities/pitcher-career/model/pitchTraining'

/** 구질 훈련 창 (상태 0x78) — 표 0xcc390 과 가드 순서를 그대로 보인다 (J 3-2) */

afterEach(cleanup)

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트', { ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 1] }),
  gamePoint: 5000,
  ...overrides,
})

const 화면 = (career: PitcherCareer, onTrained: (career: PitcherCareer) => void = () => {}) =>
  render(<PitchTrainingScreen career={career} onTrained={onTrained} onClose={() => {}} />)

describe('구질 훈련 창', () => {
  it('구질 20칸을 그리고 이미 가진 구질은 "보유" 로 보인다', () => {
    화면(투수())

    expect(screen.getByRole('button', { name: 'TWO-SEAM 보유' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'CUT FAST' })).toBeTruthy()
  })

  it('선행을 안 채운 칸은 StrMODE[68] 안내가 뜬다', () => {
    화면(투수())

    fireEvent.click(screen.getByRole('button', { name: 'H.SHOOT' }))

    expect(screen.getByText(/선행 구질 훈련 완료/)).toBeTruthy()
  })

  it('계열이 안 열린 히든은 StrMODE[67] 이다', () => {
    화면(투수())

    fireEvent.click(screen.getByRole('button', { name: 'P.SINKER' }))

    expect(screen.getByText(/아직 배울 수 없는 구질/)).toBeTruthy()
  })

  it('G포인트가 모자라면 StrMODE[65] 다', () => {
    화면(투수({ gamePoint: 0 }))

    fireEvent.click(screen.getByRole('button', { name: 'CUT FAST' }))

    expect(screen.getByText(/G포인트가 부족/)).toBeTruthy()
  })

  it('확인 상자에서 [예] 를 고르면 구질을 배우고 G포인트가 준다 (600G)', () => {
    let trained: PitcherCareer | null = null
    화면(투수(), (career) => { trained = career })

    fireEvent.click(screen.getByRole('button', { name: 'CUT FAST' }))
    expect(screen.getByText(/600 G포인트가 소모됩니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(trained).not.toBeNull()
    expect(hasPitchType(trained!, 10)).toBe(true)
    expect(trained!.gamePoint).toBe(5000 - 600)
  })

  it('이미 가진 구질은 아무 말 없이 무시한다', () => {
    화면(투수())

    fireEvent.click(screen.getByRole('button', { name: 'TWO-SEAM 보유' }))

    expect(screen.queryByText(/소모됩니다/)).toBeNull()
  })
})
