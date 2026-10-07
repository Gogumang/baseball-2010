// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { SeasonEventUnderlay } from '@/pages/season/ui/SeasonEventUnderlay'
import { createCareer } from '@/entities/career/model/playerCareer'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'

/** 대화창 0x8b5ac 의 밑그림 — 공 무늬 0x5fd61 · 상태판 0x7d34c · 머리띠 (커맨드 줄 · 가운데 판은 없다) */

afterEach(cleanup)

describe('이벤트 밑그림 (0x8b5ac)', () => {
  it('시즌 0xd3 — 공 무늬 · 상태판 · 머리띠, 커맨드 줄은 없다', () => {
    const state = startNewSeason(0, '테스터')
    const { container } = render(<SeasonEventUnderlay record={state.record} teamMorale={state.teamMorale} gamePoint={0} />)

    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    expect(screen.getByRole('group', { name: '상태판' })).toBeTruthy()
    expect(container.querySelector('[data-testid="command-bar"]')).toBeNull()
    expect(container.querySelector('[data-testid="가운데판"]')).toBeNull()
  })

  it('나리 114 — 같은 밑그림에 나리 상태판', () => {
    const { container } = render(<NariEventUnderlay career={createCareer('테스터')} />)

    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    expect(container.querySelector('[data-testid="command-bar"]')).toBeNull()
  })
})
