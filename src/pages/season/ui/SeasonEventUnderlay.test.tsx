// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { SeasonEventEndFrame, SeasonEventUnderlay } from '@/pages/season/ui/SeasonEventUnderlay'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
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

describe('이벤트 재생이 끝난 한 틀 (0x8b5ac 가 0 — 0x19e64 → 0x19da4 · 0xa09c → 0x9f60)', () => {
  it('나리 114 — 앞 상태 105 면 상태판(0) 위에 관리 6칸 커맨드 줄(커서 = 메뉴 [this+0x8c]), 켬 표 0 칸(행동함 → 트레이닝 · 휴식 · 외출)은 흑백', () => {
    const career = { ...createCareer('테스터'), hasActedThisCycle: true }
    render(
      <NariEventUnderlay career={career}>
        <NariMainCommandBar menuEnable={career} cursor={4} />
      </NariEventUnderlay>,
    )

    expect(screen.getByTestId('command-bar')).toBeTruthy()
    for (const id of ['선수정보', '트레이닝', '휴식', '외출', '아이템', '다음경기']) {
      expect(screen.getByRole('button', { name: id })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: '아이템' }).getAttribute('aria-current')).toBe('true')
    const 흑백 = (id: string) => screen.getByRole('button', { name: id }).querySelector('img')?.style.filter
    expect(흑백('휴식')).toBe('grayscale(1)')
    expect(흑백('다음경기')).toBe('')
  })

  it('시즌 0xd3 — 앞 상태 0xc9 면 시즌 관리 6칸(커서 = 메뉴 [this+0x70]), 그 밖은 칸 없음, 0xd1 이면 지도', () => {
    const state = startNewSeason(0, '테스터')
    const { container, rerender } = render(
      <SeasonEventEndFrame record={state.record} teamMorale={state.teamMorale} gamePoint={0} kind="관리메뉴" cursor={3} />,
    )
    expect(screen.getByRole('button', { name: '외출' }).getAttribute('aria-current')).toBe('true')
    // 0xd3 은 공통 틀이 가운데 판을 뺀다
    expect(container.querySelector('[data-testid="가운데판"]')).toBeNull()

    rerender(<SeasonEventEndFrame record={state.record} teamMorale={state.teamMorale} gamePoint={0} kind="칸없음" cursor={3} />)
    expect(screen.getByTestId('command-bar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '외출' })).toBeNull()
    expect(screen.getByRole('group', { name: '상태판' })).toBeTruthy()

    rerender(<SeasonEventEndFrame record={state.record} teamMorale={state.teamMorale} gamePoint={0} kind="지도" cursor={3} />)
    expect(container.querySelector('[data-testid="command-bar"]')).toBeNull()
    expect(screen.queryByRole('group', { name: '상태판' })).toBeNull()
  })
})
