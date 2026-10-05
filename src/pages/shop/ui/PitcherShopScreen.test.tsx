// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 투수편 장비 상점 — 타자편과 같은 창·같은 확인 흐름에 투수 표만 얹는다 */

afterEach(cleanup)

describe('투수 장비 상점 화면', () => {
  it('첫 칸(나이스 모자)을 고르면 StrMODE[79] 로 묻고, 예면 그 칸을 산다', () => {
    const onPurchase = vi.fn()
    render(
      <PitcherShopScreen
        tab="장착"
        career={{ ...createPitcherCareer('투수'), money: 100_000 }}
        noticeText=""
        onPurchase={onPurchase}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getAllByText('나이스 모자').length).toBeGreaterThan(0)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByRole('dialog', { name: '알림' })).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onPurchase).toHaveBeenCalledWith('장착:0:0')
  })
})
