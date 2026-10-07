// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherGameEvaluationScreen } from '@/pages/pitcher-league/ui/PitcherGameEvaluationScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

afterEach(cleanup)

const 경기: PitcherLastGame = { decisionCode: 1, outs: 18, runs: 1, strikeouts: 5, managerCommentIndex: 2 }

describe('투수편 116 경기 뒤 평가 (0x11e0c · 0x8a6fc)', () => {
  it('밑그림은 공 무늬 → 상태판 → 머리띠 — 근사 창(PixelScreen)이 아니다', () => {
    const { container } = render(<PitcherGameEvaluationScreen career={createPitcherCareer('테스터')} lastGame={경기} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    // 상태판 이름 칸
    expect(container.textContent).toContain('테스터')
  })

  it('대사(기록 줄 + 감독 글) → 변화 창(system sub 2 · 0x86c90) → 확인이면 114 로', () => {
    const onConfirm = vi.fn()
    render(<PitcherGameEvaluationScreen career={{ ...createPitcherCareer('테스터'), lastEvaluation: { moraleChange: 3, popularityChange: 0, reputationChange: -2 } }}
      lastGame={경기} onConfirm={onConfirm} />)
    const 대사 = screen.getByRole('group', { name: '경기 평가' }).textContent ?? ''
    expect(대사).toContain('6.0이닝 5삼진 1실점')
    expect(대사).toContain(stripGameMarkup(ORIGINAL_USER_EVENTS[2] ?? '').slice(0, 5))

    fireEvent.keyDown(window, { key: 'Enter' })
    // 글(StrUSER_EVT[75])이 아니라 mode_ui 프레임 84 창 — 제목 359 · 이름 84 사기 · 327 인기도 · 331 평판
    const 창 = screen.getByRole('dialog', { name: '경기 평가 변화' })
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((img) => Number(img.getAttribute('data-frame')))
    expect(글.slice(0, 4)).toEqual([359, 84, 327, 331])
    // 변화 0 인 인기도 줄은 흰 막대 (147 + 1, 83 + 17 + 7)
    const 막대 = 창.querySelectorAll('[data-part="변화없음"]')
    expect(막대).toHaveLength(1)
    expect((막대[0] as HTMLElement).style.left).toBe('148px')
    expect((막대[0] as HTMLElement).style.top).toBe('107px')
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).toHaveBeenCalled()
  })
})
