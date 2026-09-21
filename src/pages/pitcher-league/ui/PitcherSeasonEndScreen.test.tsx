// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherSeasonEndScreen } from '@/pages/pitcher-league/ui/PitcherSeasonEndScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 투수편 시즌 끝 화면 — 타자편과 달리 성적 칸이 투수 레코드다 (P1 6절) */

afterEach(cleanup)

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  season: 2,
  wins: 20,
  draws: 1,
  losses: 24,
  stats: { games: 22, outs: 400, runsAllowed: 50, saves: 0, strikeouts: 120, pitches: 1800, wins: 12, losses: 7 },
  ...overrides,
})

describe('투수편 시즌 끝 화면', () => {
  it('연차와 팀 전적을 띄운다', () => {
    render(<PitcherSeasonEndScreen career={투수()} onYearEnd={() => {}} />)

    expect(screen.getByText('2시즌 종료')).toBeDefined()
    expect(screen.getByText(/20승 1무 24패/)).toBeDefined()
  })

  it('타율·홈런이 아니라 이닝·탈삼진·방어율을 보여 준다', () => {
    render(<PitcherSeasonEndScreen career={투수()} onYearEnd={() => {}} />)

    expect(screen.getByText('이닝')).toBeDefined()
    expect(screen.getByText('탈삼진')).toBeDefined()
    // 방어율 0xb6ce8 = 50 × 2700 / 400 = 337 → 3.37
    expect(screen.getByText('3.37')).toBeDefined()
    expect(screen.queryByText('타율')).toBeNull()
    expect(screen.queryByText('홈런')).toBeNull()
  })

  it('[다음] 이 연말 사슬을 연다', () => {
    const onYearEnd = vi.fn()
    render(<PitcherSeasonEndScreen career={투수()} onYearEnd={onYearEnd} />)

    fireEvent.click(screen.getByText('다음'))

    expect(onYearEnd).toHaveBeenCalledTimes(1)
  })
})
