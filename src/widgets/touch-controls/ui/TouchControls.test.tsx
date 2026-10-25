// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TouchControls } from '@/widgets/touch-controls/ui/TouchControls'
import { offerTouchKey, resetTouchKeyOffersForTest, tapKey, useTouchKeyOffer, useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PressArea } from '@/shared/ui/PressArea/PressArea'

/** jsdom 에는 PointerEvent 가 없다 — 단추(button) · pointerId 를 싣게 MouseEvent 로 흉내 낸다 */
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
    }
  }
  Object.assign(window, { PointerEvent: TestPointerEvent })
}

interface Seen { readonly type: string; readonly key: string; readonly code: string; readonly repeat: boolean }

let seen: Seen[] = []
const record = (event: KeyboardEvent) => {
  seen.push({ type: event.type, key: event.key, code: event.code, repeat: event.repeat })
}
const keys = () => seen.map((event) => `${event.type}:${event.key}`)

const press = (element: HTMLElement, pointerId = 1) => fireEvent.pointerDown(element, { pointerId, pointerType: 'touch' })
const lift = (element: HTMLElement, pointerId = 1) => fireEvent.pointerUp(element, { pointerId, pointerType: 'touch' })

beforeEach(() => {
  seen = []
  window.addEventListener('keydown', record)
  window.addEventListener('keyup', record)
})

afterEach(() => {
  window.removeEventListener('keydown', record)
  window.removeEventListener('keyup', record)
  cleanup()
  act(() => resetTouchKeyOffersForTest())
})

describe('TouchControls — 늘 있던 확인 · 뒤로는 걷었다 (r186), 숫자판도 없다', () => {
  it('세로 배치 — 알린 키가 없으면 버튼이 하나도 없다(확인 · 뒤로 · 숫자 · 방향 없음)', () => {
    render(<TouchControls layout="below" />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
    expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull()
  })

  it('가로 배치 — 왼쪽 상황 버튼 덩이 하나뿐, 오른쪽 확인 덩이는 없다', () => {
    render(<TouchControls layout="sides" />)
    expect(screen.getByRole('group', { name: '상황 버튼' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: '확인' })).toBeNull()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('화면이 OK · CLR 을 상황 버튼으로 알리면(수비 슬라이딩 · 전원 귀루) Enter · Escape 키 사건이다', () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: 'Enter', label: '슬라이딩', isHold: true })
      offerTouchKey({ key: 'Escape', label: '전원 귀루' })
    })
    const slide = screen.getByRole('button', { name: '슬라이딩' })
    press(slide)
    expect(seen).toEqual([{ type: 'keydown', key: 'Enter', code: 'Enter', repeat: false }])
    lift(slide)
    const back = screen.getByRole('button', { name: '전원 귀루' })
    press(back)
    lift(back)
    expect(seen.map((event) => `${event.type}:${event.key}:${event.code}`)).toEqual([
      'keydown:Enter:Enter', 'keyup:Enter:Enter', 'keydown:Escape:Escape', 'keyup:Escape:Escape',
    ])
  })
})

describe('상황 버튼 — 화면이 알린 키만, 같은 키 사건으로', () => {
  it('알린 동안만 뜨고, 거두면 사라진다', () => {
    render(<TouchControls layout="below" />)
    let withdraw = () => {}
    act(() => {
      withdraw = offerTouchKey({ key: '0', label: '필살타' })
    })
    const special = screen.getByRole('button', { name: '필살타' })
    press(special)
    lift(special)
    expect(seen.map((event) => `${event.type}:${event.key}:${event.code}`)).toEqual(['keydown:0:Digit0', 'keyup:0:Digit0'])
    act(() => withdraw())
    expect(screen.queryByRole('button', { name: '필살타' })).toBeNull()
  })

  it("번트 '8' 은 누르고 있는 동안 keyup 이 없다 — 떼는 순간 keyup 한 번 (pointercancel · 잡기 풀림도)", () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: '8', label: '번트', isHold: true })
    })
    const bunt = screen.getByRole('button', { name: '번트' })
    press(bunt, 3)
    expect(keys()).toEqual(['keydown:8'])
    fireEvent.pointerCancel(bunt, { pointerId: 3, pointerType: 'touch' })
    expect(keys()).toEqual(['keydown:8', 'keyup:8'])
    fireEvent.lostPointerCapture(bunt, { pointerId: 3, pointerType: 'touch' })
    expect(seen.filter((event) => event.type === 'keyup')).toHaveLength(1)
  })

  it('키 차례 — 필살타 · 번트 · 도루 · 교체 · 메뉴, 같은 키는 하나', () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: '*', label: '메뉴' })
      offerTouchKey({ key: '#', label: '교체' })
      offerTouchKey({ key: '3', label: '도루 1루' })
      offerTouchKey({ key: '0', label: '필살타' })
      offerTouchKey({ key: '*', label: '메뉴' })
    })
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['필살타', '도루 1루', '교체', '메뉴'])
  })

  it('원본 글자 자리 투명 칸(PressArea)은 상황 버튼을 따로 띄우지 않는다 — 같은 키를 두 길로 내지 않는다 (r192, 필요한 버튼만)', () => {
    render(
      <>
        <TouchControls layout="below" />
        <PressArea label="메뉴" onPress={() => {}} />
      </>,
    )
    expect(document.querySelector('[data-touch-key]')).toBeNull()
  })

  it('useTouchKeyOffer(null) 은 아무것도 알리지 않는다', () => {
    const Offer = ({ offer }: { offer: TouchKeyOffer | null }) => {
      useTouchKeyOffer(offer)
      return null
    }
    const { rerender } = render(<><TouchControls layout="below" /><Offer offer={null} /></>)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    rerender(<><TouchControls layout="below" /><Offer offer={{ key: '0', label: '마구' }} /></>)
    expect(screen.getByRole('button', { name: '마구' })).toBeTruthy()
  })
})

describe('견제 · 많은 상황 버튼', () => {
  it("견제 '3'/'1'/'7' 은 1루 · 2루 · 3루 차례로 서고, 누르면 그 숫자 키 사건이다", () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: '7', label: '3루 견제' })
      offerTouchKey({ key: '*', label: '메뉴' })
      offerTouchKey({ key: '3', label: '1루 견제' })
      offerTouchKey({ key: '1', label: '2루 견제' })
      offerTouchKey({ key: '0', label: '마구' })
    })
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['마구', '1루 견제', '2루 견제', '3루 견제', '메뉴'])
    const third = screen.getByRole('button', { name: '3루 견제' })
    press(third)
    lift(third)
    expect(seen.map((event) => `${event.type}:${event.key}:${event.code}`)).toEqual(['keydown:7:Digit7', 'keyup:7:Digit7'])
  })

  it('가로 배치 — 셋까지는 세로 한 줄, 넷부터는 두 줄 격자(왼쪽 칸 높이를 넘지 않게)', () => {
    render(<TouchControls layout="sides" />)
    const optionBox = () => screen.getByRole('group', { name: '상황 버튼' }).querySelector('[data-option-layout]')
    act(() => {
      offerTouchKey({ key: '0', label: '마구' })
      offerTouchKey({ key: '3', label: '1루 견제' })
      offerTouchKey({ key: '*', label: '메뉴' })
    })
    expect(optionBox()?.getAttribute('data-option-layout')).toBe('column')
    act(() => {
      offerTouchKey({ key: '1', label: '2루 견제' })
      offerTouchKey({ key: '7', label: '3루 견제' })
      offerTouchKey({ key: '#', label: '강판' })
    })
    expect(optionBox()?.getAttribute('data-option-layout')).toBe('grid')
    expect(optionBox()?.children).toHaveLength(6)
  })
})

describe('넘기기 · 차례 · 누름 칸 키', () => {
  it('order 를 준 버튼은 그 차례로 선다 (수비 송구 1루 · 2루 · 3루 · 홈)', () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: '8', label: '홈 송구', order: 3 })
      offerTouchKey({ key: '6', label: '1루 송구', order: 0 })
      offerTouchKey({ key: '4', label: '3루 송구', order: 2 })
      offerTouchKey({ key: '2', label: '2루 송구', order: 1 })
    })
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['1루 송구', '2루 송구', '3루 송구', '홈 송구'])
  })

  it('세로 배치 — 다섯부터 네 칸 격자', () => {
    render(<TouchControls layout="below" />)
    act(() => {
      for (const key of ['2', '4', '8', '0', '3']) offerTouchKey({ key, label: `키 ${key}` })
    })
    expect(screen.getByRole('group', { name: '터치 조작' }).querySelector('[data-option-layout]')?.getAttribute('data-option-layout')).toBe('grid')
  })

  it('▲ · ▼ 버튼은 ArrowUp · ArrowDown 키 사건이다', () => {
    const Scroll = () => {
      useTouchScrollKeys(true)
      return null
    }
    render(<><TouchControls layout="below" /><Scroll /></>)
    const down = screen.getByRole('button', { name: '▼ 아래' })
    press(down)
    lift(down)
    expect(keys()).toEqual(['keydown:ArrowDown', 'keyup:ArrowDown'])
  })

  it('tapKey — 누름 칸이 쓰는 키 한 번(keydown · keyup, 숫자는 Digit 코드)', () => {
    tapKey('7')
    expect(seen.map((event) => `${event.type}:${event.key}:${event.code}`)).toEqual(['keydown:7:Digit7', 'keyup:7:Digit7'])
  })
})


describe('TouchControls — pointer 사건이 안 오는 기기(iOS Safari 사건 추적 영역 밖)에서도 탭이 닿는다 (r208)', () => {
  it('pointerdown 없이 click 만 오면 키를 한 번 누르고 뗀다', () => {
    render(<TouchControls layout="below" />)
    act(() => {
      offerTouchKey({ key: '*', label: '메뉴' })
    })
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    expect(keys()).toEqual(['keydown:*', 'keyup:*'])
  })

  it('pointer 로 이미 누른 탭 뒤의 click 은 버린다 — 키가 두 번 가지 않는다', () => {
    render(<TouchControls layout="sides" />)
    act(() => {
      offerTouchKey({ key: '0', label: '필살타' })
    })
    const button = screen.getByRole('button', { name: '필살타' })
    press(button)
    lift(button)
    fireEvent.click(button)
    expect(keys()).toEqual(['keydown:0', 'keyup:0'])
    // 다음 탭이 click 만 와도 다시 닿는다
    fireEvent.click(button)
    expect(keys()).toEqual(['keydown:0', 'keyup:0', 'keydown:0', 'keyup:0'])
  })
})
