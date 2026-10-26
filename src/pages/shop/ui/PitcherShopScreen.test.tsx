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
    // 장비 창(0x83378)은 처음에 부위 탭 초점이다 — 확인 키가 먼저 목록으로 들어가고(0x81c34), 다시 확인이 구매다
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
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
    const entries = pitcherShopEntriesOf(createPitcherCareer('투수'), 'GP')
    expect(entries[9]).toMatchObject({ name: '십전대보탕', iconFrame: 20 })
    fireEvent.keyDown(window, { key: 'Enter' })
    // G 부족 [65] 는 0x13460 kind 2 가 0xbbef9(글, 2, 2, 1) 예/아니오로 띄운다 — 예(G 충전)는 서버 제외라 닫기만 한다
    const dialog = screen.getByRole('dialog', { name: '알림' })
    expect(dialog.textContent).toContain('G포인트가 부족합니다.')
    expect(dialog.textContent).toContain('페이지로 이동하시겠습니까?')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
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

describe('장비 창 뒤 기본정보 카드 0x15e20 투수 갈래', () => {
  it('투수 그림 이미지는 (11, 18) 에 두 배(0x98975 효과 0x10 · 2) · 레이더 축 이름은 37~40(제구 · 구속 · 변화 · 체력) · 커맨드 줄은 없다', () => {
    const { container } = render(
      <PitcherShopScreen tab="장착" career={createPitcherCareer('투수')} noticeText="" onPurchase={vi.fn()} onBack={vi.fn()} />,
    )
    const image = screen.getByTestId('투수카드-그림')
    expect([image.style.left, image.style.top]).toEqual(['11px', '18px'])
    expect(image.style.transform).toBe('scale(2)')
    const labels = [...container.querySelectorAll('[data-testid="pitcher-basic-info-card"] img')]
      .map((node) => (node as HTMLImageElement).getAttribute('src') ?? '')
      .filter((src) => src.includes('img_text/frames/0'))
    expect(labels.filter((src) => /\/0(37|38|39|40)\.png$/.test(src))).toHaveLength(4)
    expect(screen.queryByTestId('command-bar')).toBeNull()
  })
})
