// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { createCareer, MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { SUB_ITEMS } from '@/entities/career/model/subItems'
import {
  DESCRIPTION_BOX, MONEY_BAR_OFFSET, NAME_BOX, RIGHT_TAB_BOX, SLOT_COUNT, SLOT_SIZE, SLOT_XS, SLOT_YS, VALUE_BOX, WINDOW_BOX,
  slotPositionOf, valueBarPositionOf,
} from '@/pages/shop/lib/shopLayout'

/**
 * 상점·아이템 창 (0x81dc0 — P6 3절).
 * mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸(33×33, x 34·69·104·139·174, y 77·115) 배치를 고정한다.
 * 가드(R12 1b)에 걸린 칸은 구매 확인이 아니라 안내만 떠야 한다.
 */

afterEach(cleanup)

const 소지금많은선수 = { ...createCareer('테스터'), gamePoint: 9999, money: 9999 }

const 띄우기 = (tab: string, career = 소지금많은선수, onPurchase = vi.fn()) => {
  render(
    <ShopScreen initialTab={tab} career={career} noticeText="" onPurchase={onPurchase} onBack={vi.fn()} />,
  )
  return onPurchase
}

const 칸 = (name: string) => screen.getByRole('option', { name })
/** 원작은 커서를 옮긴 뒤 확인 키를 누른다 — 웹에서도 칸을 한 번 눌러 커서를 옮기고(이미 커서 칸이면 건너뜀) 다시 눌러야 고른 것이 된다 */
const 칸고르기 = (name: string) => {
  const button = 칸(name)
  if (button.getAttribute('aria-selected') !== 'true') fireEvent.click(button)
  fireEvent.click(button)
}
const 알림 = () => screen.queryByRole('dialog', { name: '알림' })

describe('아이템 창 격자 (mode_ui 프레임 34)', () => {
  it('GP 상점의 열 칸이 원본 좌표 5열 × 2행에 놓인다', () => {
    띄우기('GP')

    expect(BATTER_GP_ITEMS.length).toBe(SLOT_COUNT)
    BATTER_GP_ITEMS.forEach((item, index) => {
      const { x, y } = slotPositionOf(index)
      const slot = 칸(item.name)
      expect(slot.style.left, `${item.name} 의 x`).toBe(`${x}px`)
      expect(slot.style.top, `${item.name} 의 y`).toBe(`${y}px`)
      expect(slot.style.width).toBe(`${SLOT_SIZE}px`)
      expect(slot.style.height).toBe(`${SLOT_SIZE}px`)
    })
  })

  it('격자 좌표는 x 34·69·104·139·174 · y 77·115 다', () => {
    expect([...SLOT_XS]).toEqual([34, 69, 104, 139, 174])
    expect([...SLOT_YS]).toEqual([77, 115])
  })

  it('서브아이템 상점도 같은 열 칸을 쓴다', () => {
    띄우기('서브')

    expect(SUB_ITEMS.length).toBe(SLOT_COUNT)
    expect(칸(SUB_ITEMS[0].name).style.left).toBe(`${SLOT_XS[0]}px`)
    expect(칸(SUB_ITEMS[9].name).style.top).toBe(`${SLOT_YS[1]}px`)
  })

  it('칸마다 칸 바탕 0x7e764 를 깐다 — 테 #041D52 · 채우기 #2033AA · 위 절반 #3045CD (10칸 모두)', () => {
    띄우기('GP')

    const cells = screen.getByTestId('shop-slot-cells').querySelectorAll('rect')
    expect(cells.length).toBe(SLOT_COUNT * 6)
    const fill = [...cells].find((rect) => rect.getAttribute('fill') === '#2033AA')
    expect(fill?.getAttribute('x')).toBe(String(SLOT_XS[0] + 1))
    expect(fill?.getAttribute('width')).toBe(String(SLOT_SIZE - 1))
    const shine = [...cells].find((rect) => rect.getAttribute('fill') === '#3045CD')
    expect(shine?.getAttribute('height')).toBe('14')
  })
})

describe('아이템 창 박스 (mode_ui 프레임 33)', () => {
  it('머리 칸 (0x81fb6~0x82254) — 서브 소지금 막대 (152, 54) · 값 칸 막대는 박스 5 오른쪽 위 (146, 163)', () => {
    expect(valueBarPositionOf(RIGHT_TAB_BOX, 0x11, 61, MONEY_BAR_OFFSET.x, MONEY_BAR_OFFSET.y)).toEqual({ x: 152, y: 54 })
    expect(valueBarPositionOf(VALUE_BOX, 0x14, 61)).toEqual({ x: 146, y: 163 })
  })

  it('판은 (24,48) 192×212 공용 판 0x55e60 이다 (81e66 — 제목 탭 1)', () => {
    render(
      <ShopScreen initialTab="GP" career={소지금많은선수} noticeText="" onPurchase={vi.fn()} onBack={vi.fn()} />,
    )
    const panel = screen.getByTestId('상점-판')

    expect(panel.style.left).toBe(`${WINDOW_BOX.x}px`)
    expect(panel.style.top).toBe(`${WINDOW_BOX.y}px`)
    expect(panel.style.height).toBe(`${WINDOW_BOX.height}px`)
  })

  it('설명 칸은 박스 4 를 3 씩 줄인 자리에서 설명 · 효과 줄(0x82400)을 보여 준다 (0x82b72~0x82bce)', () => {
    띄우기('GP')

    const description = screen.getByTestId('shop-description')
    expect(description.style.left).toBe(`${DESCRIPTION_BOX.x + 3}px`)
    expect(description.style.top).toBe(`${DESCRIPTION_BOX.y + 3}px`)
    // 첫 줄은 설명 StrITEM[0xad] 의 "!N" 앞 조각
    expect(within(description).getByText('입안에서 살살 녹는 이 맛!')).toBeTruthy()
    expect(within(description).getByText(/효과 :/)).toBeTruthy()
    expect(within(description).getByText(BATTER_GP_ITEMS[0].effectText)).toBeTruthy()
  })

  it('이름 딱지는 박스 3, 값 칸은 박스 5 자리다', () => {
    const { container } = render(
      <ShopScreen initialTab="GP" career={소지금많은선수} noticeText="" onPurchase={vi.fn()} onBack={vi.fn()} />,
    )
    const names = screen.getAllByText(BATTER_GP_ITEMS[0].name)
    // 이름은 검정 그림자 + 흰 글 두 장이다
    expect(names.length).toBe(2)
    expect(names[1].style.left).toBe(`${NAME_BOX.x + 5}px`)

    const tag = container.querySelector(`div[style*="width: ${NAME_BOX.width}px"]`) as HTMLElement
    expect(tag.style.left).toBe(`${NAME_BOX.x}px`)
    expect(tag.style.top).toBe(`${NAME_BOX.y}px`)
    expect(VALUE_BOX).toEqual({ x: 123, y: 163, width: 84, height: 15 })
  })
})

describe('가드에 걸린 칸 (0x13460)', () => {
  it('사기가 최고면 영지버섯은 안내만 뜨고 구매 확인이 안 열린다', () => {
    const onPurchase = 띄우기('GP', { ...소지금많은선수, morale: MAXIMUM_MORALE })

    칸고르기('영지버섯')

    const dialog = 알림()
    expect(dialog, '안내 창이 뜨지 않았다').not.toBeNull()
    expect(within(dialog as HTMLElement).getByText(/사기 최고 상태입니다/)).toBeTruthy()
    // 1버튼 알림이라 [예]/[아니오] 가 아니라 [확인] 하나다
    expect(within(dialog as HTMLElement).getByRole('button', { name: '확인' })).toBeTruthy()
    expect(onPurchase).not.toHaveBeenCalled()
  })

  it('G 포인트가 모자라면 살 수 없다고 안내한다 (StrMODE[65])', () => {
    const onPurchase = 띄우기('GP', { ...createCareer('테스터'), gamePoint: 0 })

    칸고르기('장어구이')

    expect(within(알림() as HTMLElement).getByText(/G포인트가 부족합니다/)).toBeTruthy()
    expect(onPurchase).not.toHaveBeenCalled()
  })

  it('막히지 않은 칸은 구매 확인(예/아니오)을 연다', () => {
    const onPurchase = 띄우기('GP')

    칸고르기('장어구이')

    const dialog = 알림() as HTMLElement
    expect(within(dialog).getByRole('button', { name: '예' })).toBeTruthy()
    expect(onPurchase).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: '예' }))
    expect(onPurchase).toHaveBeenCalledWith('GP:0:0')
  })

  it('이미 가진 서브아이템은 안내만 뜬다', () => {
    const onPurchase = 띄우기('서브', { ...소지금많은선수, subItemIds: [0] })

    칸고르기(SUB_ITEMS[0].name)

    expect(within(알림() as HTMLElement).getByText(/이미 가지고 있는/)).toBeTruthy()
    expect(onPurchase).not.toHaveBeenCalled()
  })
})

describe('마우스 길 — 원본은 키패드뿐', () => {
  it('칸에 포인터를 올려 두기만 해서는 커서가 안 옮겨진다 — 첫 누름은 커서만 옮기고 고르지 않는다', () => {
    const onPurchase = 띄우기('GP')
    const 둘째 = 칸(BATTER_GP_ITEMS[1].name)
    fireEvent.mouseEnter(둘째)
    fireEvent.mouseOver(둘째)
    expect(둘째.getAttribute('aria-selected')).toBe('false')
    expect(칸(BATTER_GP_ITEMS[0].name).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(둘째)
    expect(둘째.getAttribute('aria-selected')).toBe('true')
    expect(onPurchase).not.toHaveBeenCalled()
  })
})

describe('격자 커서 감김 (0x81618 목록 꼴 0x30)', () => {
  it('오른쪽 끝에서 → 는 같은 줄 첫 칸으로, ↓ 는 같은 열 다른 줄로 간다', () => {
    띄우기('GP')
    for (let step = 0; step < 4; step += 1) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(칸(BATTER_GP_ITEMS[4]!.name).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(칸(BATTER_GP_ITEMS[0]!.name).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(window, { key: '8' })
    expect(칸(BATTER_GP_ITEMS[5]!.name).getAttribute('aria-selected')).toBe('true')
  })
})

