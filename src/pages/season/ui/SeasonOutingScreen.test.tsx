// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonOutingScreen } from '@/pages/season/ui/SeasonOutingScreen'
import { SEASON_OUTING_MAP_MOVES, moveOutingMapCursor, outingMapDirectionOf } from '@/pages/season/lib/seasonOutingMap'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 외출 지도(0xd1) — 키 0xbf50 · 방향 이동 0x7f3e4 · 가드 0xbd38 · 확인 팝업 0x16 을 못박는다 (P4 3절).
 * ⚠️ 나만의리그 외출과 값·가드가 다르다 — 여기 숫자를 나리 표와 맞추면 안 된다.
 */

afterEach(cleanup)

const 시즌 = (덮어쓰기: Partial<SeasonRecord> = {}, 사기 = 50): SeasonState => {
  const state = startNewSeason(0, '테스터')
  return { ...state, record: { ...state.record, ...덮어쓰기 }, teamMorale: 사기 }
}

function 지도({ state, onRun = vi.fn(), onBack = vi.fn(), 처음 = 0 }: {
  readonly state: SeasonState
  readonly onRun?: (place: string, index: number) => void
  readonly onBack?: () => void
  readonly 처음?: number
}) {
  const [cursor, setCursor] = useState(처음)
  return <SeasonOutingScreen state={state} cursor={cursor} onCursorChange={setCursor} onRun={onRun} onBack={onBack} />
}

const 건물 = (이름: string) => screen.getByRole('button', { name: 이름 })
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
const 고른칸 = () => screen.getByTestId('시즌-외출지도').getAttribute('data-selected')
const 키 = (key: string) => fireEvent.keyDown(window, { key })

describe('외출 지도 방향 이동 0x7f3e4 (표 0xd491c)', () => {
  it('표 그대로 — [위, 아래, 왼쪽, 오른쪽]', () => {
    expect(SEASON_OUTING_MAP_MOVES).toEqual([
      [1, 4, 2, 3], [4, 0, 2, 3], [1, 4, 3, 0], [1, 4, 0, 2], [0, 1, 2, 3],
    ])
  })

  it('키 −1·"2" 위 · −2·"8" 아래 · −3·"4" 왼쪽 · −4·"6" 오른쪽', () => {
    expect(['ArrowUp', '2', 'ArrowDown', '8', 'ArrowLeft', '4', 'ArrowRight', '6', '5'].map(outingMapDirectionOf))
      .toEqual([0, 0, 1, 1, 2, 2, 3, 3, null])
    expect(moveOutingMapCursor(0, 0)).toBe(1)
    expect(moveOutingMapCursor(2, 3)).toBe(0)
  })
})

describe('시즌 외출 지도 (상태 0xd1)', () => {
  it('고른 칸 지도를 그리고 방향 키로 칸을 옮긴다', () => {
    render(<지도 state={시즌({ popularity: 999, money: 50 })} />)
    expect(고른칸()).toBe('0')

    키('ArrowUp')
    expect(고른칸()).toBe('1')
    키('2')
    expect(고른칸()).toBe('4')
    키('6')
    expect(고른칸()).toBe('3')
  })

  it('확인 키는 가드를 거쳐 팝업 0x16 — 비용 줄 [162] 이 먼저, "예" 면 장소를 넘긴다', () => {
    const onRun = vi.fn()
    render(<지도 state={시즌({ popularity: 999, money: 50 })} onRun={onRun} 처음={1} />)

    키('5')
    expect(알림글()).toContain('[회식] 이벤트를')
    expect(알림글()).toContain('진행하시겠습니까?')
    expect(알림글().indexOf('소지금 400이 소모됩니다')).toBeLessThan(알림글().indexOf('[회식] 이벤트를'))

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onRun).toHaveBeenCalledWith('번화가', 1)
  })

  it('건물을 누르면 그 칸으로 옮겨 확인과 같게 가드를 탄다', () => {
    render(<지도 state={시즌({ popularity: 999, money: 50 })} />)

    fireEvent.click(건물('학교'))
    expect(고른칸()).toBe('3')
    expect(알림글()).toContain('[야구교실] 이벤트')
    expect(알림글()).not.toContain('소모')
  })

  it('친선경기는 인기도 200, 구단CF 는 400 이 필요하다 (StrMODE[62])', () => {
    const onRun = vi.fn()
    render(<지도 state={시즌({ popularity: 199, money: 50 })} onRun={onRun} />)

    fireEvent.click(건물('경기장'))
    expect(알림글()).toContain('필요한 인기도 : 200')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    fireEvent.click(건물('방송국'))
    expect(알림글()).toContain('필요한 인기도 : 400')
    expect(onRun).not.toHaveBeenCalled()
  })

  it('건강하면 입원이 StrMODE[196] 로 막힌다', () => {
    render(<지도 state={시즌({ money: 50, illness: 0 })} />)
    fireEvent.click(건물('병원'))
    expect(알림글()).toContain('건강한 상태입니다')
  })

  it('사기가 100 이면 회식이 StrMODE[91] 로 막힌다', () => {
    render(<지도 state={시즌({ money: 50 }, 100)} />)
    fireEvent.click(건물('번화가'))
    expect(알림글()).toContain('사기 최고 상태')
  })

  it('⚠️ 원본 버그 — 서브 아이템이 있어도 소지금 500만이 없으면 입원이 막힌다', () => {
    const onRun = vi.fn()
    render(<지도 state={시즌({ money: 4, illness: 1, outingSubItems: [false, false, true, false, false] })} onRun={onRun} />)

    fireEvent.click(건물('병원'))

    expect(알림글()).toContain('소지금이 부족')
    expect(onRun).not.toHaveBeenCalled()
  })

  it('취소(−16) 는 관리 메뉴로 돌아간다', () => {
    const onBack = vi.fn()
    render(<지도 state={시즌({ money: 50 })} onBack={onBack} />)

    키('Escape')

    expect(onBack).toHaveBeenCalled()
  })
})
