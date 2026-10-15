// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeasonTeamInfoScreen } from '@/pages/season/ui/SeasonTeamInfoScreen'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'

afterEach(cleanup)

const ROWS: readonly TeamInfoRow[] = [
  { labelFrame: 394, value: { kind: '글', text: '단장' } },
  { labelFrame: 222, value: { kind: '글', text: '----' } },
  { labelFrame: 191, value: { kind: '숫자', value: 5000, suffixFrame: 345 } },
  { labelFrame: 80, value: { kind: '글', text: '구장' } },
  { labelFrame: 321, value: { kind: '그림', frame: 347 } },
  { labelFrame: 224, value: { kind: '글', text: '--' } },
  { labelFrame: 47, value: { kind: '숫자', value: 3 } },
]

const filterOf = (scope: HTMLElement, frame: number) => (scope.querySelector(`img[data-frame="${frame}"]`) as HTMLImageElement).style.filter

describe('구단정보 0xd5 img_text 팔레트 (0x7c450)', () => {
  it('이름표는 팔레트 0 — 47 "순위" 는 팔레트 3 으로 구운 그림을 흰 글자로 되돌린다 (0x7c620 · 0x7c656)', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    expect(filterOf(screen.getByTestId('구단정보-줄-6'), 47)).toMatch(/^url\(#img-text-palette-.*-3-0\)$/)
    expect(filterOf(screen.getByTestId('구단정보-줄-0'), 394)).toBe('')
  })

  it('값 칸의 좌석 "석" 345 와 타입 이름표는 팔레트 1(노랑) — 0x7c914 · 0x7cca6', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    expect(filterOf(screen.getByTestId('구단정보-값-2'), 345)).toMatch(/^url\(#img-text-palette-.*-0-1\)$/)
    expect(filterOf(screen.getByTestId('구단정보-값-4'), 347)).toMatch(/^url\(#img-text-palette-.*-0-1\)$/)
  })
})

/** 구단정보 0xd5 — 카드 0x7ba44 의 0xd5 갈래 */

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
