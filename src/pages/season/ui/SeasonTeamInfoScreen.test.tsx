// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeasonTeamInfoScreen } from '@/pages/season/ui/SeasonTeamInfoScreen'

/** 구단정보 0xd5 — 카드 0x7ba44 의 0xd5 갈래 */

afterEach(cleanup)

const 띄우기 = (hasCardBadge?: boolean) => render(
  <SeasonTeamInfoScreen teamId={2} teamAbilities={[50, 50, 50, 50]} rows={[]} onBack={vi.fn()} hasCardBadge={hasCardBadge} />,
)

describe('구단정보 0xd5 카드', () => {
  it('계단형 판(0x76725) 을 깔고 로고를 (20, 72) 에 효과 없이 그린다', () => {
    띄우기()
    expect(screen.getByTestId('시즌카드-판')).toBeTruthy()
    const logo = screen.getByTestId('구단정보-로고') as HTMLElement
    expect([logo.style.left, logo.style.top, logo.style.opacity]).toEqual(['20px', '72px', ''])
  })

  it('딱지 [gfx+0x168] 이 없으면 팀 이름도 그리지 않는다 — 팀 이름은 딱지 안에서만 (0x7bbd4)', () => {
    띄우기()
    expect(screen.queryByTestId('시즌카드-딱지')).toBeNull()
  })

  it('0xca · 0xe4 를 거친 장면이면 딱지 두 판과 팀 이름 img_text 0x41 + 팀 · 157 을 그린다', () => {
    띄우기(true)
    expect((screen.getByTestId('시즌카드-딱지-이름판') as HTMLElement).dataset.image).toBe('9')
    expect((screen.getByTestId('시즌카드-딱지-머리판') as HTMLElement).dataset.image).toBe('116')
  })
})
