// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { GameEvaluationScreen } from '@/pages/game-result/ui/GameEvaluationScreen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { resetSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'

/**
 * 나리 타자편 116 경기 뒤 평가 — 나리 장면 0x106 의 116(진입 0x1278c · 그림 0x11e0c) → 114 내장 이벤트 0x8a6fc.
 * 경기 결과(경기 장면 0x18 · 0x19 — `GameResultScreen`)와 따로 선다(정산 판을 나간 0x3f3 → 100 → 116, 이어하기 1c26a).
 */

afterEach(() => {
  cleanup()
  resetSkinTickerCounter()
  vi.useRealTimers()
})

const 평가 = { popularityChange: 1, reputationChange: 0, moraleChange: 2, commentIndex: 40 } as const

const 프레임 = (count: number) =>
  act(() => {
    vi.advanceTimersByTime(count * millisecondsPerFrame())
  })

describe('116 평가 (114 내장 이벤트 0x8a6fc)', () => {
  it('116 이 선 틀은 116 그림뿐 — 114 는 다음 틀: 대사(기록 줄 + 감독 글) → 변화 창 → 114 끝에 다음', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameEvaluationScreen
        newTitles={[]}
        evaluation={평가}
        recordLine={{ atBats: 4, hits: 2, runsBattedIn: 3, homeRuns: 1 }}
        career={createCareer('선수')}
        onContinue={onContinue}
        underlay={<div data-testid="밑그림" />}
        entryUnderlay={<div data-testid="116-그림" />}
      />,
    )
    expect(screen.getByTestId('116-그림')).toBeTruthy()
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    프레임(1)
    expect(screen.queryByTestId('116-그림')).toBeNull()
    expect(screen.getByTestId('밑그림')).toBeTruthy()
    expect(screen.queryByTestId('정산-판')).toBeNull()
    프레임(200)
    const 줄 = [...screen.getByTestId('대사-상자').querySelectorAll('[data-part="글줄"]')].map((line) => line.textContent)
    expect(줄[0]).toBe('4타수 2안타 3타점 1홈런')
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain(
      (ORIGINAL_USER_EVENTS[40] ?? '').replace(/!c[0-9A-Fa-f]{6}|!N/g, '').slice(0, 4),
    )
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      fireEvent.keyDown(window, { key: 'Enter' })
      프레임(200)
    }
    const 창 = screen.getByRole('dialog', { name: '경기 평가 변화' })
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((img) => Number(img.getAttribute('data-frame')))
    expect(글.slice(0, 4)).toEqual([359, 84, 327, 331])
    expect(onContinue).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: '5' })
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('연속 기록이 있으면 변화 창 뒤 명령 3 say — 같은 상자에 " / " 로 이은 줄을 찍는다', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    render(
      <GameEvaluationScreen
        newTitles={[]}
        evaluation={평가}
        streakNotices={[
          { labelIndex: 100, count: 5, commentIndex: 108, reputationChange: 10 },
          { labelIndex: 101, count: 5, commentIndex: 108, reputationChange: 10 },
        ]}
        career={createCareer('선수')}
        onContinue={onContinue}
      />,
    )
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      프레임(200)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    fireEvent.keyDown(window, { key: '5' })
    expect(onContinue).not.toHaveBeenCalled()
    expect(screen.getByTestId('대사-상자').getAttribute('data-text')).toContain(' / 5')
    for (let page = 0; page < 5 && onContinue.mock.calls.length === 0; page += 1) {
      프레임(200)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('연속 기록 say 뒤 보상 명령(종류 7)마다 창 — 평판 합은 공용 알림, 슬럼프 +18 은 스킬 창 0x8e054 (0x8d4c4), 다 닫으면 114 끝', () => {
    vi.useFakeTimers()
    const onContinue = vi.fn()
    const onRewardsGiven = vi.fn()
    const 밑그림 = vi.fn((career: { readonly reputation: number }) => <div data-testid="밑그림" data-reputation={career.reputation} />)
    const career = { ...createCareer('선수'), reputation: 100 }
    render(
      <GameEvaluationScreen
        newTitles={[]}
        evaluation={평가}
        streakNotices={[{ labelIndex: 102, count: 4, commentIndex: 111, reputationChange: -10 }]}
        streakRewards={[
          { kind: 1, value: -10 },
          { kind: 4, value: 18 },
        ]}
        career={career}
        onContinue={onContinue}
        rewardUnderlay={밑그림}
        onRewardsGiven={onRewardsGiven}
      />,
    )
    for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
      프레임(200)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.getByTestId('밑그림').getAttribute('data-reputation')).toBe('100')
    // 명령 3 say 중 CLR(0x8b7b0) — 다음 보상 명령으로
    프레임(200)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onContinue).not.toHaveBeenCalled()
    // 평판 알림 창 — 0x8c460 이 창을 띄운 갱신에 평판을 준다
    const 알림 = screen.getByRole('dialog')
    expect(알림.textContent).toContain('평판')
    expect(알림.textContent).toContain('-10')
    expect(screen.getByTestId('밑그림').getAttribute('data-reputation')).toBe('90')
    // 그 갱신에 세션이 몫을 주고 저장한다(0x8c460 끝, Q-23)
    expect(onRewardsGiven).toHaveBeenLastCalledWith(1)
    프레임(20)
    fireEvent.keyDown(window, { key: 'Enter' })
    프레임(20)
    // 스킬 창 — img_text 370(획득)
    expect(screen.getByTestId('스킬-보상-창')).toBeTruthy()
    expect(screen.getByTestId('스킬-보상-창').textContent).toContain('획득')
    expect(onRewardsGiven).toHaveBeenLastCalledWith(2)
    expect(onContinue).not.toHaveBeenCalled()
    프레임(20)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('경기 결과 판(점수판 틀 · 정산 판 · 결과 배경)은 그리지 않는다 — 그것은 경기 장면의 상태다', () => {
    const { container } = render(
      <GameEvaluationScreen
        newTitles={[]}
        evaluation={평가}
        career={createCareer('선수')}
        onContinue={vi.fn()}
        underlay={<div data-testid="밑그림" />}
      />,
    )
    expect(screen.getByTestId('밑그림')).toBeTruthy()
    expect(screen.queryByTestId('정산-판')).toBeNull()
    expect(screen.queryByTestId('점수판-틀')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('116 이 건 칭호 39 는 칭호 팝업 0x1274c(0x1afe8 창) — 밑에서 평가 이벤트가 같이 돌고, 키는 팝업이 먹는다', () => {
    vi.useFakeTimers()
    const onConfirmTitle = vi.fn()
    render(
      <GameEvaluationScreen
        newTitles={['다이너마이트 배트']}
        evaluation={평가}
        career={createCareer('선수')}
        onContinue={vi.fn()}
        onConfirmTitle={onConfirmTitle}
      />,
    )
    expect(screen.getByTestId('칭호-창').querySelector('[data-part="이름"]')?.textContent).toBe('"다이너마이트 배트"')
    // 116 이 선 틀은 116 그림과 팝업뿐 — 114 진입은 116 진입 끝(12bb6~12bbe)의 0xbcb49 로 다음 틀이다
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    프레임(1)
    // 나리 틀 0x1cdec 는 창이 떠 있어도 상태 바꿈 · 갱신을 돌린다 — 114 의 명령 1 say 상자가 팝업 밑에 선다
    expect(screen.getByTestId('대사-상자')).toBeTruthy()
    const 대사 = () => screen.getByTestId('대사-상자').getAttribute('data-text')
    const 처음대사 = 대사()
    // 펼침(높이 6 → 120) 동안은 키 콜백을 안 부른다 (0x754f8 75556~75588) — 대사도 안 넘어간다(0x754f9 참 → 키 표 건너뜀)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirmTitle).not.toHaveBeenCalled()
    프레임(200)
    expect(대사()).toBe(처음대사)
    expect(screen.queryByRole('dialog', { name: '경기 평가 변화' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirmTitle).toHaveBeenCalledTimes(1)
    // 닫힘 애니 없음 — 0x1b1e4 가 0x742a8 로 바로 치운다. 그 키는 이벤트에 안 간다
    expect(screen.queryByTestId('칭호-창')).toBeNull()
    expect(screen.queryByRole('dialog', { name: '경기 평가 변화' })).toBeNull()
    expect(screen.getByTestId('대사-상자')).toBeTruthy()
    // 팝업이 치워진 뒤의 키부터 이벤트가 받는다 — 명령 2 system sub 2(변화 창)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: '경기 평가 변화' })).toBeTruthy()
  })
})
