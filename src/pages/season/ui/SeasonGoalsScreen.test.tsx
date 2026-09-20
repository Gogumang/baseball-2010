// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonGoalsScreen } from '@/pages/season/ui/SeasonGoalsScreen'
import type { SeasonGoalInput } from '@/entities/season-mode/model/seasonGoals'

/**
 * 올해의 목표 — 표 `0xd7cf6`, 판정 `0xa37bc` (P4 2b 확정).
 * 표 다섯 줄이 연차대로 나오고 달성 수가 393~396 으로 갈리는지 본다.
 */

afterEach(cleanup)

const 성적 = (덮어쓰기: Partial<SeasonGoalInput> = {}): SeasonGoalInput => ({
  rank: 9,
  wins: 0,
  losses: 10,
  teamBattingAverage: 0,
  teamEarnedRunAverage: 999,
  popularityGain: 0,
  ...덮어쓰기,
})

const 창글 = () => screen.getByRole('group', { name: /년차 목표/ }).textContent ?? ''

describe('연차별 목표', () => {
  it('1년차 목표는 5위 이내 · 55% · 0.250 · 3.90 · 인기도 +50 이다', () => {
    render(<SeasonGoalsScreen yearIndex={0} input={성적()} onBack={vi.fn()} />)

    const 글 = 창글()
    expect(글).toContain('순위 5위 이내')
    expect(글).toContain('승률 55% 이상')
    expect(글).toContain('팀 타율 0.250 이상')
    expect(글).toContain('팀 방어율 3.90 이하')
    expect(글).toContain('인기도 상승 50 이상')
  })

  it('10년차 목표는 2위 이내 · 82% · 0.340 · 3.00 · 인기도 +140 이다', () => {
    render(<SeasonGoalsScreen yearIndex={9} input={성적()} onBack={vi.fn()} />)

    const 글 = 창글()
    expect(글).toContain('순위 2위 이내')
    expect(글).toContain('승률 82% 이상')
    expect(글).toContain('팀 타율 0.340 이상')
    expect(글).toContain('팀 방어율 3.00 이하')
    expect(글).toContain('인기도 상승 140 이상')
  })

  it('하나도 못 채우면 이벤트 396 — 인기도 −10 · 평판 −5 (연차 보정 없음)', () => {
    render(<SeasonGoalsScreen yearIndex={0} input={성적()} onBack={vi.fn()} />)

    expect(창글()).toContain('달성 0/5 → 이벤트 396')
    expect(창글()).toContain('인기도 -10 · 평판 -5')
  })

  it('다섯 개를 다 채우면 이벤트 393 이고 연차 보정(+5y)이 붙는다', () => {
    render(
      <SeasonGoalsScreen
        yearIndex={2}
        input={성적({
          rank: 0, wins: 30, losses: 5, teamBattingAverage: 300, teamEarnedRunAverage: 200, popularityGain: 200,
        })}
        onBack={vi.fn()}
      />,
    )

    // 3년차(idx 2) → 인기도 25+10 · 평판 30+10 · 소지금 35+10
    expect(창글()).toContain('달성 5/5 → 이벤트 393')
    expect(창글()).toContain('인기도 +35 · 평판 +40 · 소지금 +45')
  })

  it('세 개만 채우면 이벤트 395 이고 보상이 없다', () => {
    render(
      <SeasonGoalsScreen
        yearIndex={0}
        input={성적({ rank: 0, wins: 30, losses: 5, teamBattingAverage: 300 })}
        onBack={vi.fn()}
      />,
    )

    expect(창글()).toContain('달성 3/5 → 이벤트 395')
    expect(창글()).toContain('보상 없음')
  })

  it('승률은 버림이라 2승 1패는 66% 다', () => {
    render(<SeasonGoalsScreen yearIndex={0} input={성적({ wins: 2, losses: 1 })} onBack={vi.fn()} />)

    expect(창글()).toContain('66%')
  })

  it('취소로 되돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonGoalsScreen yearIndex={0} input={성적()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})
