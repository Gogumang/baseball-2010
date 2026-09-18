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
