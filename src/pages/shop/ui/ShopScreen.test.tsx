// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { createCareer } from '@/entities/career/model/playerCareer'

/** 상점 구매 확인 창은 키보드로도 답할 수 있어야 한다 — 뒤쪽 목록이 같은 Enter 를 가로채면 안 된다. */

afterEach(cleanup)

const pressKey = (key: string) => fireEvent.keyDown(window, { key })

function renderShop(onPurchase = vi.fn()) {
  render(
    <ShopScreen
      initialTab="GP"
      career={{ ...createCareer('테스터'), gamePoint: 9999 }}
      noticeText=""
      onPurchase={onPurchase}
      onBack={vi.fn()}
    />,
  )
  return onPurchase
}

describe('상점 구매 확인', () => {
  it('Enter 로 고르면 확인 창이 뜨고, 다시 Enter 로 구매가 끝난다', () => {
    const onPurchase = renderShop()

    pressKey('Enter')
    expect(screen.queryByRole('dialog', { name: '알림' }), '확인 창이 뜨지 않았다').not.toBeNull()

    pressKey('Enter')

    expect(onPurchase, `구매 호출 횟수: ${onPurchase.mock.calls.length}`).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: '알림' }), '확인 창이 닫히지 않았다').toBeNull()
  })

  it('확인 창에서 Escape 는 아니오 — 사지 않고 닫힌다', () => {
    const onPurchase = renderShop()

    pressKey('Enter')
    pressKey('Escape')

    expect(onPurchase).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
  })
})

describe('GP 결과 창 (0x872a1)', () => {
  it('detail 이 있으면 결과 창이 뜨고 목록 키는 막힌다 — Enter 로 닫으면 onCloseGpDetail 만 (굴림 없음)', () => {
    const before = { ...createCareer('테스터'), gamePoint: 9999, morale: 30 }
    const after = { ...before, morale: 70 }
    const onPurchase = vi.fn()
    const onClose = vi.fn()
    render(
      <ShopScreen
        initialTab="GP"
        career={after}
        noticeText=""
        gpDetail={{ itemIndex: 6, before, after }}
        onCloseGpDetail={onClose}
        onPurchase={onPurchase}
        onBack={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog', { name: '상세정보' })).not.toBeNull()
    expect(screen.getByText('[영지버섯] 구매')).toBeTruthy()

    pressKey('Enter')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: '알림' }), '목록이 같은 Enter 로 구매를 물으면 안 된다').toBeNull()
    expect(onPurchase).not.toHaveBeenCalled()
  })
})

describe('그리기 0x167cc — 창 종류 1 · 2 는 상태판 0x7d34c · 커맨드 줄 0x7e418 을 먼저 그린다', () => {
  const draw = (initialTab: string) => render(
    <ShopScreen initialTab={initialTab} career={createCareer('테스터')} noticeText="" onPurchase={vi.fn()} onBack={vi.fn()} />,
  )

  it('서브 · GP 는 아이템 하위 메뉴 세 칸(110 그대로)에 그 칸이 커서다', () => {
    for (const [tab, cursorId] of [['서브', '서브'], ['GP', 'GP']] as const) {
      const { container, unmount } = draw(tab)
      const bar = screen.getByTestId('command-bar')
      expect([...bar.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual(['장착', '서브', 'GP'])
      expect(bar.querySelector('button[aria-current="true"]')?.getAttribute('aria-label')).toBe(cursorId)
      expect(container.textContent).toContain('테스터')
      unmount()
    }
  })

  it('장비(종류 3)는 상태판 · 커맨드 줄 대신 기본정보 카드를 그린다', () => {
    draw('장착')
    expect(screen.queryByTestId('command-bar')).toBeNull()
    expect(screen.getByTestId('basic-info-card')).toBeTruthy()
  })
})
