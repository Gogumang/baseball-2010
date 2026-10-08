// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherGameEvaluationScreen } from '@/pages/pitcher-league/ui/PitcherGameEvaluationScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 상자가 오르고 글을 끝까지 찍게 둔다 */
const 다찍기 = () => act(() => {
  vi.advanceTimersByTime(200 * millisecondsPerFrame())
})

const 경기: PitcherLastGame = { decisionCode: 1, outs: 18, runs: 1, strikeouts: 5, managerCommentIndex: 2 }

describe('투수편 116 경기 뒤 평가 (0x11e0c · 0x8a6fc)', () => {
  it('밑그림은 공 무늬 → 상태판 → 머리띠 — 근사 창(PixelScreen)이 아니다', () => {
    const { container } = render(<PitcherGameEvaluationScreen career={createPitcherCareer('테스터')} lastGame={경기} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    // 상태판 이름 칸
    expect(container.textContent).toContain('테스터')
  })

  it('0x8b5ac 덧그림 — 인기도 변화 막대가 틀마다 한 줄씩 오른다 (선발 d 12: 6 → 30 줄)', () => {
    render(<PitcherGameEvaluationScreen career={{ ...createPitcherCareer('테스터'), lastEvaluation: { moraleChange: 0, popularityChange: 6, reputationChange: 0 } }}
      lastGame={경기} onConfirm={vi.fn()} />)
    const 막대 = screen.getByTestId('인기도-막대')
    expect(막대.getAttribute('data-rows')).toBe('0')
    act(() => {
      vi.advanceTimersByTime(10 * millisecondsPerFrame())
    })
    expect(막대.getAttribute('data-rows')).toBe('10')
    다찍기()
    expect(막대.getAttribute('data-rows')).toBe('30')
  })

  it('대사(기록 줄 + 감독 글) → 변화 창(system sub 2 · 0x86c90) → 확인이면 114 로', () => {
    const onConfirm = vi.fn()
    render(<PitcherGameEvaluationScreen career={{ ...createPitcherCareer('테스터'), lastEvaluation: { moraleChange: 3, popularityChange: 0, reputationChange: -2 } }}
      lastGame={경기} onConfirm={onConfirm} />)
    다찍기()
    const 대사 = screen.getByRole('group', { name: '경기 평가' }).textContent ?? ''
    expect(대사).toContain('6.0이닝 5삼진 1실점')
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain(stripGameMarkup(ORIGINAL_USER_EVENTS[2] ?? '').slice(0, 5))

    // 기록 줄 + 감독 글이 세 줄을 넘으면 쪽마다 확인 — 글 끝(단계 4)의 확인이 다음 명령
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      fireEvent.keyDown(window, { key: 'Enter' })
      다찍기()
    }
    // 글(StrUSER_EVT[75])이 아니라 mode_ui 프레임 84 창 — 제목 359 · 이름 84 사기 · 327 인기도 · 331 평판
    const 창 = screen.getByRole('dialog', { name: '경기 평가 변화' })
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((img) => Number(img.getAttribute('data-frame')))
    expect(글.slice(0, 4)).toEqual([359, 84, 327, 331])
    // 변화 0 인 인기도 줄은 흰 막대 (147 + 1, 83 + 17 + 7)
    const 막대 = 창.querySelectorAll('[data-part="변화없음"]')
    expect(막대).toHaveLength(1)
    expect((막대[0] as HTMLElement).style.left).toBe('148px')
    expect((막대[0] as HTMLElement).style.top).toBe('107px')
    // 팝업이 떠 있는 동안 앞 대사 상자가 밑에 남는다 (0x8b5ac 가 틀마다 0x7fbc4)
    expect(screen.getByTestId('대사-상자')).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).toHaveBeenCalled()
  })

  it('연속 기록 알림은 알림 창이 아니라 명령 3 say — 같은 대사 상자에 다시 오르지 않고 찍는다 (0x8ac1a)', () => {
    const onConfirm = vi.fn()
    const career = {
      ...createPitcherCareer('테스터'),
      role: 0 as const,
      streaks: { win: 3, strikeout: 0, loss: 0 },
      lastGame: 경기,
      lastEvaluation: { moraleChange: 3, popularityChange: 0, reputationChange: -2 },
    }
    render(<PitcherGameEvaluationScreen career={career} lastGame={경기} onConfirm={onConfirm} />)
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      다찍기()
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain('3')
    expect(screen.getByTestId('대사-상자').querySelector('[data-part="본체"]')?.getAttribute('height')).toBe('55')
    다찍기()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalled()
  })
})
