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

describe('구단정보 0xd5 숫자 값 칸 — numBox 0xba51c (0x7c8ea · 0x7cdc2 · 0x7ceae)', () => {
  it('좌석 5000 은 시스템 글꼴이 아니라 주황 num 그림 20 + 숫자를 칸(60, 218, 81, 15) 가운데에 — 가로 60 + (81 − 4 × 7) >> 1 = 86', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    const cell = screen.getByTestId('구단정보-값-2')
    expect(cell.textContent).toBe('')
    const digits = [...cell.querySelectorAll('img')].filter((image) => image.getAttribute('src')?.startsWith('./sprites/num/'))
    expect(digits.map((image) => image.getAttribute('src'))).toEqual(
      ['./sprites/num/025.png', './sprites/num/020.png', './sprites/num/020.png', './sprites/num/020.png'],
    )
    expect(digits[0].style.left).toBe('86px')
    // 세로 ceil((15 − 10) / 2) = 3 — 줄 2 의 칸 y = 184 + 2 × 17
    expect(digits[0].style.top).toBe('221px')
  })

  it('순위 3 도 num 그림 — 오른쪽 열 칸(176, 218, 32, 15) 가운데 176 + (32 − 7) >> 1 = 188', () => {
    render(<SeasonTeamInfoScreen teamId={0} teamAbilities={[50, 50, 50, 50]} rows={ROWS} onBack={() => {}} />)
    const cell = screen.getByTestId('구단정보-값-6')
    const digit = cell.querySelector('img') as HTMLImageElement
    expect(digit.getAttribute('src')).toBe('./sprites/num/023.png')
    expect(digit.style.left).toBe('188px')
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

describe('구단정보 0xd5 ABILITY 판 — 카드 팀 갈래 0x7bf9c → 0x5aefd 종류 0 (리터럴 0x7c100)', () => {
  it('가운데 (178, 104) 반지름 30 의 ABILITY 판 전체 — 둥근 바탕 · 이름 상자 넷 · 축 이름 46 · 45 · 204 · 205', () => {
    띄우기()
    const 판 = screen.getByTestId('능력치 도형')
    const 그림들 = Array.from(판.querySelectorAll('img'))
    const 바탕 = 그림들.filter((image) => image.getAttribute('src') === './sprites/slt_frame/003.png')
    expect(바탕.map((image) => [image.style.left, image.style.top])).toEqual([['147px', '73px'], ['177px', '73px']])
    expect(그림들.filter((image) => image.getAttribute('src') === './sprites/slt_frame/017.png')).toHaveLength(4)
    for (const frame of ['046', '045', '204', '205']) {
      expect(그림들.map((image) => image.getAttribute('src'))).toContain(`./sprites/img_text/frames/${frame}.png`)
    }
  })
})
