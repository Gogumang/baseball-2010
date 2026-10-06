// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonPlayerCardScreen } from '@/pages/season/ui/SeasonPlayerCardScreen'
import { seasonCardAbilitiesOf, seasonPlayerDetailViewOf } from '@/pages/season/lib/seasonPlayerDetail'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

/** 선수 카드 0xd9 (키 0x48a0) ↔ 능력치 상세 창 0xda (키 0x9398) */

afterEach(cleanup)

const 키 = (key: string) => fireEvent.keyDown(window, { key })

function 띄우기(isDetailOpen: boolean, teamMorale = 100) {
  const record = startNewSeason(0, '테스터').record
  const view = seasonPlayerRecordOf(0, tableRosterOf(0).batters[0]!, false, 0)
  const context = { record, teamMorale }
  const props = {
    onOpenDetail: vi.fn(), onCloseDetail: vi.fn(), onBack: vi.fn(),
  }
  render(
    <SeasonPlayerCardScreen teamId={0} view={view} abilities={seasonCardAbilitiesOf(view, context)}
      detail={seasonPlayerDetailViewOf(view, context)} isDetailOpen={isDetailOpen} {...props} />,
  )
  return props
}

describe('선수 카드 0xd9', () => {
  it("취소 → 0xdf · '0' → 0xda · 확인은 아무 일도 없다", () => {
    const props = 띄우기(false)
    키('Enter')
    expect(props.onBack).not.toHaveBeenCalled()
    expect(props.onOpenDetail).not.toHaveBeenCalled()
    키('0')
    expect(props.onOpenDetail).toHaveBeenCalled()
    키('Escape')
    expect(props.onBack).toHaveBeenCalled()
  })

  it('이름과 네 칸 — 실효값이 기본값보다 낮으면 빨강 (사기 20 → −100)', () => {
    띄우기(false, 20)
    expect(screen.getByTestId('선수상세-이름').textContent).toBe('박택용')
    expect(screen.getByTestId('선수상세-능력-0').textContent).toBe('히트470')
  })
})

describe('능력치 상세 창 0xda', () => {
  it("취소·'0' → 0xd9 — 카드 키는 안 먹는다", () => {
    const props = 띄우기(true)
    expect(screen.getByRole('dialog', { name: '상세정보' })).toBeTruthy()
    키('0')
    키('Escape')
    expect(props.onCloseDetail).toHaveBeenCalledTimes(2)
    expect(props.onBack).not.toHaveBeenCalled()
    expect(props.onOpenDetail).not.toHaveBeenCalled()
  })
})
