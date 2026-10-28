// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CoachHireScreen } from '@/pages/season/ui/CoachHireScreen'
import { acePlayerOfCell } from '@/pages/general-mode/ui/AceSelectScreen'
import { coachNameOf } from '@/entities/season-mode/model/seasonCoach'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

/**
 * 코치채용 (선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운 것, 채용 0xa248) — J 4-3 확정.
 * 가드 순서와 "바꾸면 계약금을 새로 낸다" 를 못박는다.
 */

afterEach(cleanup)

const 상태 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonState => {
  const base = startNewSeason(0, '테스터')
  return { ...base, record: { ...base.record, ...덮어쓰기 } }
}

const 다열림 = [0, 1, 2, 3, 4]

const 띄우기 = (state: SeasonState, 열린투수 = 다열림, 열린타자 = 다열림, onOpenAce = vi.fn()) => {
  const onHire = vi.fn()
  render(
    <CoachHireScreen
      state={state}
      openedAcePitcherIds={열린투수}
      openedAceBatterIds={열린타자}
      gamePoints={99999}
      onOpenAce={onOpenAce}
      onHire={onHire}
      onBack={vi.fn()}
    />,
  )
  return onHire
}

/** 마선수 격자 칸 탭 — 첫 탭은 커서, 커서 칸 탭이 OK (`AceSelectScreen` 의 `tapCell`) */
const 칸누르기 = (칸: HTMLElement) => {
  fireEvent.click(칸)
  fireEvent.click(칸)
}
const 줄고르기 = (이름: string) => 칸누르기(screen.getByRole('button', { name: new RegExp(이름) }))
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('코치 칸 = 마선수 격자 (0xd7 this+0x11c = 2 — 그림은 공용 목록 k 2)', () => {
  it('칸 0~4 마투수 · 5~9 마타자 — 격자 칸과 코치 칸이 같은 마선수다', () => {
    for (let 칸 = 0; 칸 < 10; 칸 += 1) expect(acePlayerOfCell(칸)?.name).toBe(coachNameOf(칸))
  })

  it('머리띠 아래 바닥은 5 — 되돌아가기만 있고 "0레벨업" 이 없다 (0xad94~0xada0)', () => {
    const { container } = render(
      <CoachHireScreen state={상태()} openedAcePitcherIds={다열림} openedAceBatterIds={다열림} onHire={vi.fn()} onBack={vi.fn()} />,
    )
    expect(container.querySelectorAll('img[data-footer-mark]')).toHaveLength(0)
  })
})

describe('정보 상자 0xaa6c~0xad78 (r263)', () => {
  const 정보글 = () => screen.getByTestId('코치-정보글').textContent ?? ''

  it('커서 칸 코치의 효과 [149 + 칸] · 계약금 [159] · 필요 인기도 [160] — 처음 칸 0', () => {
    띄우기(상태())
    expect(정보글()).toBe('팀 투수 변화 +8계약금 : 1억필요 인기도 : 0')
  })

  it('커서를 옮기면 그 칸 글 — 잠긴 칸이어도 그린다 (가드 없음)', () => {
    띄우기(상태(), [0], [0])
    fireEvent.keyDown(window, { key: '6' })
    expect(정보글()).toBe('팀 투수 구속 +9계약금 : 1억5000필요 인기도 : 100')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(정보글()).toBe('팀 타자 주력/수비 +5계약금 : 1억5000필요 인기도 : 100')
  })

  it('B 딱지(ABILITY 파란 막대 117)는 안 그린다 — k 10 은 [sp+0xc0] = −1 (0x657e0)', () => {
    const { container } = render(
      <CoachHireScreen state={상태()} openedAcePitcherIds={다열림} openedAceBatterIds={다열림} onHire={vi.fn()} onBack={vi.fn()} />,
    )
    expect(container.querySelector('img[src$="slt_frame/117.png"]')).toBeNull()
    expect(screen.getByTestId('코치-정보상자')).toBeDefined()
  })
})

describe('오픈 검사 (0xa734~0xa8fe)', () => {
  it('안 열린 칸은 가드 대신 [43] G 오픈 팝업 — 예면 그 칸을 연다', () => {
    const onOpenAce = vi.fn()
    const onHire = 띄우기(상태({ money: 9999, popularity: 9999 }), [0], [], onOpenAce)

    // 칸 1(마투수 둘째)은 잠겨 있다 — 줄을 가리지 않고 힌트가 뜬다
    칸누르기(screen.getAllByRole('button', { name: 'LOCK' })[0])
    expect(screen.getByRole('button', { name: '예' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onOpenAce).toHaveBeenCalledWith(1)
    expect(onHire).not.toHaveBeenCalled()
  })

  it('칸 4·9 는 [42] 알림 하나 — G 로 못 연다', () => {
    const onOpenAce = vi.fn()
    띄우기(상태({ money: 9999, popularity: 9999 }), [0, 1, 2, 3], [0, 1, 2, 3], onOpenAce)

    칸누르기(screen.getAllByRole('button', { name: 'LOCK' })[0])

    expect(screen.queryByRole('button', { name: '예' })).toBeNull()
    expect(screen.getByRole('button', { name: 'OK' })).toBeDefined()
  })
})

describe('가드 (0xa79c~)', () => {
  it('소지금이 모자라면 StrMODE[77] 이다 — 새 시즌 5000만으로는 1억을 못 낸다', () => {
    띄우기(상태({ popularity: 9999 }))

    줄고르기('싸이커')

    expect(알림글()).toContain('소지금이 부족합니다')
  })

  it('소지금이 되어도 인기도가 모자라면 StrMODE[62] 로 필요한 값을 알려 준다', () => {
    띄우기(상태({ money: 9999, popularity: 0 }))

    줄고르기('레오니') // 칸 1 — 필요 인기도 100

    expect(알림글()).toContain('필요한 인기도 : 100')
  })

  it('이미 채용 중인 코치를 고르면 StrMODE[147] 이다', () => {
    띄우기(상태({ money: 9999, popularity: 9999, coach: 0 }))

    줄고르기('싸이커')

    expect(알림글()).toContain('현재 채용중인 마선수입니다')
  })
})

describe('채용 (0xa248)', () => {
  it('확인을 누르면 소지금이 빠지고 SR+0x185 에 칸이 적힌다', () => {
    const onHire = 띄우기(상태({ money: 1000, popularity: 9999 }))

    줄고르기('드래고나') // 칸 4 — 계약금 3.5억 = 350
    expect(알림글()).toContain('코치로')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onHire).toHaveBeenCalledTimes(1)
    expect(onHire.mock.calls[0][0]).toMatchObject({ coach: 4, money: 650 })
    expect(알림글()).toContain('채용하였습니다')
  })

  it('[아니오] 면 아무 일도 없다', () => {
    const onHire = 띄우기(상태({ money: 1000, popularity: 9999 }))

    줄고르기('싸이커')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onHire).not.toHaveBeenCalled()
  })
})
