// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameIncomeScreen } from '@/pages/season/ui/GameIncomeScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { seasonGameEvaluationLineOf } from '@/entities/season-mode/model/seasonGameEvaluation'
import { SEASON_YEAR_GOAL_LABEL_SET } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 경기 뒤 0xe9 → 0xd3 평가 내장 이벤트 — 기록 줄 say(감독 글 없음) → 변화 창 → (구내매점이 끝났으면 [113] 창) → 다음 상태.
 */

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 다찍기 = () => act(() => {
  vi.advanceTimersByTime(200 * millisecondsPerFrame())
})

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  lastGameScore: 5,
  lastGameConceded: 3,
  lastAttendance: 18160,
  lastIncome: 13,
  games: 10,
  ...덮어쓰기,
})

const 목표: YearGoalWindowSource = {
  labelSet: SEASON_YEAR_GOAL_LABEL_SET,
  current: [0, 0, 0, 0, 0],
  goals: [4, 50, 250, 450, 30],
}

const 띄우기 = (record: SeasonRecord, storeExpired = false) => {
  const onDone = vi.fn()
  render(
    <GameIncomeScreen record={record} teamMorale={80} gamePoint={0} line={seasonGameEvaluationLineOf(record)}
      storeExpired={storeExpired} goals={목표} onDone={onDone} />,
  )
  return onDone
}

/** 대사 쪽을 넘겨 변화 창까지 */
const 변화창까지 = () => {
  for (let page = 0; page < 5 && screen.queryByRole('dialog', { name: '경기 평가 변화' }) === null; page += 1) {
    다찍기()
    fireEvent.keyDown(window, { key: 'Enter' })
  }
}

describe('경기 뒤 0xe9 평가 이벤트', () => {
  it('밑그림은 0x8b5ac 의 공 무늬 · 상태판 · 머리띠 — 지어낸 목록 창이 아니다', () => {
    띄우기(레코드())
    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    expect(screen.queryByRole('group', { name: '경기 수입' })).toBeNull()
  })

  it('대사는 기록 줄뿐이다 (글 번호 50000 — 감독 글 없음)', () => {
    띄우기(레코드())
    다찍기()
    const 글 = screen.getByTestId('대사-상자').getAttribute('data-text') ?? ''
    expect(글).toContain('득점: 5 / 실점: 3 / 경기승리!')
    expect(글).toContain('관중: 18160명 / 수입: 1300만')
  })

  it('변화 창을 닫으면 다음 상태로', () => {
    const onDone = 띄우기(레코드())
    변화창까지()
    expect(screen.getByRole('dialog', { name: '경기 평가 변화' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    expect(onDone).toHaveBeenCalled()
  })

  it('구내매점이 이 경기로 끝났으면 변화 창 뒤 StrUSER_EVT[113] 창 (system sub 5)', () => {
    const onDone = 띄우기(레코드({ storeGames: 0 }), true)
    변화창까지()
    fireEvent.keyDown(window, { key: '5' })
    expect(onDone).not.toHaveBeenCalled()
    const 알림 = screen.getByRole('dialog', { name: '알림' })
    expect(알림.textContent).toContain('기간이 끝났습니다')

    fireEvent.click(within(알림).getByRole('button', { name: '확인' }))
    expect(onDone).toHaveBeenCalled()
  })
})
