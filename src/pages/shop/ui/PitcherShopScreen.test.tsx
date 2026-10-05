// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherShopEntriesOf } from '@/pages/shop/lib/pitcherShopEntries'

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

  it('GP 창은 투수 표다 — 칸 9 가 십전대보탕이고, 막힌 칸은 묻지 않고 그 글만 띄운다', () => {
    const onPurchase = vi.fn()
    render(
      <PitcherShopScreen
        tab="GP"
        career={{ ...createPitcherCareer('투수'), gamePoint: 0 }}
        noticeText=""
        onPurchase={onPurchase}
        onBack={vi.fn()}
      />,
    )

    // 창은 커서 칸(0 장어구이) 이름만 그린다 — 칸 9 는 표에서 본다
    expect(screen.getAllByText('장어구이').length).toBeGreaterThan(0)
    const entries = pitcherShopEntriesOf(createPitcherCareer('투수'), 'GP', 0)
    expect(entries[9]).toMatchObject({ name: '십전대보탕', iconFrame: 20 })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('G포인트가 부족합니다')).toBeTruthy()
    expect(onPurchase).not.toHaveBeenCalled()
  })

  it('서브 창은 부위 탭 없이 서브 아이템 열 칸이다', () => {
    render(
      <PitcherShopScreen
        tab="서브"
        career={{ ...createPitcherCareer('투수'), money: 100_000 }}
        noticeText=""
        onPurchase={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getAllByText('표적판').length).toBeGreaterThan(0)
    expect(screen.queryByText('모자')).toBeNull()
  })
})
