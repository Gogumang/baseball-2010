// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'

afterEach(cleanup)

const 띄우기 = (onBack = vi.fn()) => render(
  <OutingMapScreen noticeText="" onCloseNotice={vi.fn()} onRun={vi.fn()} onBack={onBack} eventPlaceIds={new Set()} onEnter={vi.fn()} />,
)
const 누르기 = (key: string) => act(() => { fireEvent.keyDown(window, { key }) })

describe('나리 외출 지도 키 0x13ba4', () => {
  it('CLR(Escape) 은 관리(105)로 돌아간다', () => {
    const onBack = vi.fn()
    띄우기(onBack)
    누르기('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('방향 키는 표 0xd491c 로 칸을 옮기고 OK 는 그 칸의 말풍선(113)을 띄운다', () => {
    띄우기()
    // 칸 0(경기장) → 위 → 칸 1(번화가) → 왼쪽 → 칸 2(병원)
    누르기('ArrowUp')
    누르기('ArrowLeft')
    expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull()
    누르기('Enter')
    expect(screen.getByRole('button', { name: '들어가기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '입원' })).toBeTruthy()
  })

  it('막힘 글은 공용 팝업 0xbbef9(글, 1, 1, 1)로 뜨고 113 에 남는다 — 말풍선은 그대로, 키는 팝업이 받는다 (0x16dc6 · 0x7ee1a)', () => {
    const onRun = vi.fn()
    const onCloseNotice = vi.fn()
    const props = { onCloseNotice, onRun, onBack: vi.fn(), eventPlaceIds: new Set<string>(), onEnter: vi.fn() }
    const { rerender } = render(<OutingMapScreen noticeText="" {...props} />)
    누르기('Enter')
    fireEvent.click(screen.getByRole('button', { name: '팬미팅' }))
    expect(onRun).toHaveBeenCalledTimes(1)
    rerender(<OutingMapScreen noticeText="인기도가 부족합니다. 필요한 인기도 : 600" {...props} />)
    expect(screen.getByText(/인기도가 부족합니다/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '들어가기' })).toBeTruthy()
    누르기('ArrowDown')
    누르기('Enter')
    expect(onRun).toHaveBeenCalledTimes(1)
  })
})
