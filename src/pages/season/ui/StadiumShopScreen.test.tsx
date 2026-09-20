// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StadiumShopScreen } from '@/pages/season/ui/StadiumShopScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  boardBonusOf, standCapacityOf, stadiumOwnedIndexOf,
} from '@/entities/season-mode/model/stadiumItems'

/**
 * 구장 아이템 상점(0x957c · 0x7d90)과 구장관리 교체(0x7958) — S3 확정.
 * 가드 순서와 **원본 버그 세 가지**(인기도 안 깎임 · 교체 가드 없음 · 잔디 무효과)를 못박는다.
 */

afterEach(cleanup)

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

const 보유하게 = (record: SeasonRecord, kind: '관중석' | '전광판' | '잔디', slot: number): SeasonRecord => ({
  ...record,
  stadiumOwned: record.stadiumOwned.map((owned, index) =>
    index === stadiumOwnedIndexOf(kind, slot) ? true : owned,
  ),
})

const 띄우기 = (record: SeasonRecord, 나머지: Partial<Parameters<typeof StadiumShopScreen>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <StadiumShopScreen
      record={record}
      teamMorale={100}
      onChange={onChange}
      onBack={vi.fn()}
      {...나머지}
    />,
  )
  return onChange
}

const 칸고르기 = (이름: string) => fireEvent.click(screen.getByRole('button', { name: 이름 }))
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('구장 아이템 상점 — 가드 순서 (0x9a84~0x9bd2)', () => {
  it('인기도가 모자라면 필요한 인기도를 알려 준다 (StrMODE[62])', () => {
    띄우기(레코드({ popularity: 0, money: 9999 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('인기도가 부족합니다. 필요한 인기도 : 200')
  })

  it('인기도를 채워도 소지금이 모자라면 막힌다 (StrMODE[77])', () => {
    띄우기(레코드({ popularity: 200, money: 299 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('소지금이 부족합니다')
  })

  it('이미 가진 칸은 인기도보다 먼저 걸린다 (StrMODE[78])', () => {
    띄우기(보유하게(레코드({ popularity: 0, money: 0 }), '관중석', 1))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('이미 가지고 있는 아이템입니다')
  })

  it('히든 칸(4~6)은 해금 전이면 이름도 안 보이고 StrMODE[76] 로 막힌다', () => {
    띄우기(레코드({ popularity: 9999, money: 9999 }))

    // 히든 세 칸은 "???" 로만 보인다
    expect(screen.getAllByRole('button', { name: '관중석 ???' })).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button', { name: '관중석 ???' })[0])

    expect(알림글()).toContain('아직 구매할 수 없는 아이템입니다')
  })

  it('해금된 히든 칸은 살 수 있다', () => {
    띄우기(레코드({ popularity: 9999, money: 9999 }), { isHiddenOpen: (id) => id === 13 })

    칸고르기('관중석 트로피컬')

    expect(알림글()).toContain('구매하겠습니까')
  })
})

describe('구장 아이템 상점 — 구매 확정 (0x812c)', () => {
  it('가격은 표값 × 100(100만 단위) 이라 2단 관중석이 3억이다', () => {
    띄우기(레코드({ popularity: 200, money: 9999 }))

    칸고르기('관중석 2단 관중석')

    expect(알림글()).toContain('소지금 3억')
  })

  it('사면 소지금이 깎이고 그 자리에서 장착된다', () => {
    const onChange = 띄우기(레코드({ popularity: 200, money: 400 }))

    칸고르기('관중석 2단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.money).toBe(100) // 400 − 300
    expect(바뀐.stadiumOwned[stadiumOwnedIndexOf('관중석', 1)]).toBe(true)
    expect(바뀐.stadiumEquipped[0]).toBe(1)
  })

  it('⚠️ 원본 버그: 사도 **인기도가 깎이지 않는다** (S3 5-1 — 차감 코드가 없다)', () => {
    const onChange = 띄우기(레코드({ popularity: 800, money: 9999 }))

    칸고르기('관중석 3단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect((onChange.mock.calls[0][0] as SeasonRecord).popularity).toBe(800)
  })

  it('기본 4칸을 다 모으면 컬렉터 해금 13 이 열린다 (0x81d0)', () => {
    const onUnlock = vi.fn()
    let record = 레코드({ popularity: 9999, money: 9999 })
    record = 보유하게(보유하게(보유하게(record, '관중석', 0), '관중석', 1), '관중석', 2)
    띄우기(record, { onUnlock })

    칸고르기('관중석 4단 관중석')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onUnlock).toHaveBeenCalledWith([13])
  })
})

describe('구장관리 교체 (0x7958)', () => {
  it('⚠️ 원본 버그: 가드가 하나도 없어 **안 산 칸도 그대로 끼워진다**', () => {
    const onChange = 띄우기(레코드({ popularity: 0, money: 0 }), { mode: '구장관리' })

    칸고르기('관중석 4단 관중석')

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.stadiumEquipped[0]).toBe(3)
    // 보유 기록은 건드리지 않는다 — `rec[0x1b8 + 종류] = 선택칸` 한 줄이 전부다
    expect(바뀐.stadiumOwned[stadiumOwnedIndexOf('관중석', 3)]).toBe(false)
    expect(바뀐.money).toBe(0)
    expect(알림글()).toContain('[4단 관중석] 아이템을 적용합니다')
  })
})

describe('키 조작 (0x957c)', () => {
  it('↑↓ 로 칸을 옮기고 확인 키로 고른다', () => {
    띄우기(레코드({ popularity: 0, money: 9999 }))

    fireEvent.keyDown(window, { key: 'ArrowDown' }) // 0 → 1 (2단 관중석)
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(알림글()).toContain('필요한 인기도 : 200')
  })

  it('취소(−16)로 되돌아간다', () => {
    const onBack = vi.fn()
    render(
      <StadiumShopScreen record={레코드()} teamMorale={100} onChange={vi.fn()} onBack={onBack} />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})

describe('잔디', () => {
  it('⚠️ 원본 버그: 1·2·3억을 받으면서 **관중 계산에 하나도 안 들어간다** (S3 8절)', () => {
    const onChange = 띄우기(레코드({ popularity: 0, money: 9999 }))

    fireEvent.click(screen.getByRole('button', { name: '잔디' }))
    칸고르기('잔디 인조잔디')
    expect(알림글()).toContain('소지금 1억') // 표값 1 × 100 = 100(100만) = 1억
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    const 바뀐 = onChange.mock.calls[0][0] as SeasonRecord
    expect(바뀐.money).toBe(9899)
    expect(바뀐.stadiumEquipped[2]).toBe(1)
    // 관중 수용·가산은 관중석·전광판 칸만 본다 — 잔디를 바꿔도 그대로다
    expect(standCapacityOf(바뀐)).toBe(standCapacityOf(레코드()))
    expect(boardBonusOf(바뀐)).toBe(boardBonusOf(레코드()))
  })

  it('잔디에는 히든이 없어 네 칸뿐이고 인기도 제한도 없다', () => {
    띄우기(레코드())

    fireEvent.click(screen.getByRole('button', { name: '잔디' }))

    expect(screen.getAllByRole('button', { name: /^잔디 / })).toHaveLength(4)
    expect(screen.getByRole('group', { name: '구장 아이템' }).textContent).toContain('인기도 제한 없음')
  })
})
