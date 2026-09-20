// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NationalCupMatchup } from '@/pages/national-cup/ui/NationalCupMatchup'
import { MATCHUP_PANEL } from '@/pages/national-cup/lib/nationalCupLayout'
import { createNationalCup, nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/**
 * 매치업 화면 (나리 135 · 시즌 244).
 * ⚠️ 원본 배치가 미해독이라 공용 판 (24, 54, 192, 212) 관례로 둔 **근사** 화면이다.
 */

afterEach(cleanup)

const 띄우기 = (cup: NationalCup, overrides: { onStart?: () => void; onBack?: () => void } = {}) => {
  const matchup = nationalCupMatchupOf(cup)
  if (matchup === null) throw new Error('치를 경기가 없다')
  return render(
    <NationalCupMatchup
      cup={cup}
      matchup={matchup}
      edition={2}
      onStart={overrides.onStart ?? vi.fn()}
      onBack={overrides.onBack}
    />,
  )
}

describe('국가대항전 매치업', () => {
  it('판은 공용 판 192×212 를 (24, 54) 에 둔다 (근사)', () => {
    const { container } = 띄우기(createNationalCup())
    const panel = container.querySelector(`div[style*="${MATCHUP_PANEL.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${MATCHUP_PANEL.x}px`)
    expect(panel.style.top).toBe(`${MATCHUP_PANEL.y}px`)
  })

  it('1라운드 상대는 일본이고, 내 팀은 늘 대한민국이다', () => {
    띄우기(createNationalCup())
    expect(screen.getByAltText('대한민국')).toBeTruthy()
    expect(screen.getByAltText('일본')).toBeTruthy()
    expect(screen.getByText('풀리그 1라운드')).toBeTruthy()
    expect(screen.getByText('제2회 국가대항전')).toBeTruthy()
  })

  it('결승에서 칸 0 이 다른 나라여도 대한민국이 내 팀이다 (0x1c46c 의 맞바꿈)', () => {
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [13, 10] }
    띄우기(결승)

    expect(screen.getByText('결승')).toBeTruthy()
    expect(screen.getByAltText('대한민국')).toBeTruthy()
    expect(screen.getByAltText('미국')).toBeTruthy()
  })

  it('확인은 경기로, 취소는 순위 화면으로 간다', () => {
    const onStart = vi.fn()
    const onBack = vi.fn()
    띄우기(createNationalCup(), { onStart, onBack })

    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }))

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
