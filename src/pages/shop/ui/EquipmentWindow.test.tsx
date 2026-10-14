// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { createCareer } from '@/entities/career/model/playerCareer'

/** 장비 상점·장비착용은 0x81dc0 격자가 아니라 장비 창 0x83378 이다 (0x8453c `[창+0x1a4] == 3`) */

afterEach(cleanup)

const 키 = (key: string) => fireEvent.keyDown(window, { key })
const 띄우기 = (tab: string, career = { ...createCareer('테스터'), money: 9999 }, onBack = vi.fn()) => {
  const onPurchase = vi.fn()
  render(<ShopScreen initialTab={tab} career={career} noticeText="" onPurchase={onPurchase} onBack={onBack} />)
  return { onPurchase, onBack }
}

describe('장비 창 0x83378', () => {
  it('목록은 한 화면 다섯 줄 — 레벨 숫자 격자가 아니다', () => {
    띄우기('장착')

    expect(screen.getByTestId('장비줄-0').textContent).toBe('나이스 헬멧')
    expect(screen.getByTestId('장비줄-4')).toBeTruthy()
    expect(screen.queryByTestId('장비줄-5')).toBeNull()
    expect(screen.queryByText('11')).toBeNull()
    expect(screen.getByTestId('장비줄-0').style.top).toBe('180px')
    expect(screen.getByTestId('장비줄-4').style.top).toBe(`${180 + 17 * 4}px`)
  })

  it('탭 초점에서는 가격·효과·설명이 없고, 확인으로 목록에 들어가면 고른 줄 것을 보인다', () => {
    띄우기('장착')

    expect(screen.queryByTestId('장비-설명')).toBeNull()
    키('Enter')
    expect(screen.getByTestId('장비-설명').textContent).toBe('인기도 제한 없음')
    expect(screen.getByTestId('장비-효과').dataset.bonus).toBe('30')
    키('ArrowDown')
    expect(screen.getByTestId('장비-설명').textContent).toBe('인기도 50 이상')
  })

  it('목록에서 확인은 StrMODE[79] 로 묻고, 예면 그 줄을 산다', () => {
    const { onPurchase } = 띄우기('장착')

    키('Enter')
    키('Enter')
    expect(screen.queryByRole('dialog', { name: '알림' })).not.toBeNull()
    키('Enter')
    expect(onPurchase).toHaveBeenCalledWith('장착:0:0')
  })

  it('→ 로 부위를 바꾸면 그 부위 장비가 나온다 · 취소는 목록 → 탭 → 나가기', () => {
    const { onBack } = 띄우기('장착')

    키('ArrowRight')
    expect(screen.getByTestId('장비줄-0').textContent).toBe('나이스 배트')
    키('Enter')
    키('Escape')
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.queryByTestId('장비-설명')).toBeNull()
    키('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('장비착용은 가진 장비만 줄에 선다', () => {
    const career = { ...createCareer('테스터'), ownedEquipment: ['0-3'] }
    띄우기('착용', career)

    expect(screen.getByTestId('장비줄-3')).toBeTruthy()
    expect(screen.queryByTestId('장비줄-0')).toBeNull()
  })

  it('창 위에 기본정보 카드(0x15e20)를 그리되 정보 칸은 건너뛴다', () => {
    띄우기('장착')

    expect(screen.getByTestId('basic-info-card')).toBeTruthy()
    expect(screen.queryByText('타격형')).toBeNull()
  })
})
