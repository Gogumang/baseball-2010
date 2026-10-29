// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
})
const 뒤로버튼 = () => touchKeyOffersNow().find((offer) => offer.key === 'Escape')

const 띄우기 = (onBack = vi.fn()) =>
  render(<OutingMapScreen noticeText="" onCloseNotice={vi.fn()} onRun={vi.fn()} onBack={onBack} eventPlaceIds={new Set()} onEnter={vi.fn()} />)
const 누르기 = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key })
  })

describe('나리 외출 지도 키 0x13ba4', () => {
  it('113 취소는 말풍선을 닫고 112 진입을 알린다 — 0x16c64 −16 → 0xbcb49(0x70) (Q-22)', () => {
    const onBack = vi.fn()
    const onCloseBubble = vi.fn()
    render(
      <OutingMapScreen
        noticeText=""
        onCloseNotice={vi.fn()}
        onRun={vi.fn()}
        onBack={onBack}
        eventPlaceIds={new Set()}
        onEnter={vi.fn()}
        onCloseBubble={onCloseBubble}
      />,
    )
    누르기('Enter')
    누르기('Escape')
    expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull()
    expect(onCloseBubble).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('빈 장소 뒤는 그 장소 말풍선(113)으로 선다 — 0x1c014 1c07c (Q-22)', () => {
    render(
      <OutingMapScreen
        noticeText=""
        onCloseNotice={vi.fn()}
        onRun={vi.fn()}
        onBack={vi.fn()}
        eventPlaceIds={new Set()}
        onEnter={vi.fn()}
        initialOpenPlaceId={OUTING_PLACES[2].id}
      />,
    )
    expect(screen.getByRole('button', { name: '입원' })).toBeTruthy()
  })

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

  it("112 그리기 0x16854 에 CLR 글자 자리가 없어 지도가 키를 받는 동안 '뒤로' 상황 버튼(Escape)을 낸다 — 누르면 CLR 과 같은 길 (r194)", () => {
    const onBack = vi.fn()
    띄우기(onBack)
    expect(뒤로버튼()).toEqual({ key: 'Escape', label: '뒤로' })
    // 투명 "취소" 칸은 그대로 남는다
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy()
    // 버튼은 Escape 키 사건을 쏜다 — 키 0x13ba4 의 CLR 가지
    누르기('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("말풍선(113)이 떠 있어도 '뒤로' 버튼(Escape)은 남아 말풍선을 닫고, 한 번 더 누르면 관리로 간다 — 터치 기기에서 건물을 누른 뒤 나갈 길 (r206)", () => {
    const onBack = vi.fn()
    띄우기(onBack)
    누르기('Enter')
    expect(screen.getByRole('button', { name: '들어가기' })).toBeTruthy()
    expect(뒤로버튼()).toEqual({ key: 'Escape', label: '뒤로' })
    누르기('Escape')
    expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull()
    expect(onBack).not.toHaveBeenCalled()
    expect(뒤로버튼()).toEqual({ key: 'Escape', label: '뒤로' })
    누르기('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('막힘 글 팝업이 떠 있어도 걷는다', () => {
    render(<OutingMapScreen noticeText="막힘" onCloseNotice={vi.fn()} onRun={vi.fn()} onBack={vi.fn()} eventPlaceIds={new Set()} onEnter={vi.fn()} />)
    expect(뒤로버튼()).toBeUndefined()
  })
})
