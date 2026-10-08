// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CoachHireScreen } from '@/pages/season/ui/CoachHireScreen'
import { acePlayerOfCell } from '@/pages/general-mode/ui/AceSelectScreen'
import { coachNameOf } from '@/entities/season-mode/model/seasonCoach'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'

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
    <CoachHireScreen state={state} openedAcePitcherIds={열린투수} openedAceBatterIds={열린타자} gamePoints={99999}
      onOpenAce={onOpenAce} onHire={onHire} onBack={vi.fn()} />,
  )
  return onHire
}

const 줄고르기 = (이름: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(이름) }))
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

describe('오픈 검사 (0xa734~0xa8fe)', () => {
  it('안 열린 칸은 가드 대신 [43] G 오픈 팝업 — 예면 그 칸을 연다', () => {
    const onOpenAce = vi.fn()
    const onHire = 띄우기(상태({ money: 9999, popularity: 9999 }), [0], [], onOpenAce)

    // 칸 1(마투수 둘째)은 잠겨 있다 — 줄을 가리지 않고 힌트가 뜬다
    fireEvent.click(screen.getAllByRole('button', { name: 'LOCK' })[0])
    expect(screen.getByRole('button', { name: '예' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onOpenAce).toHaveBeenCalledWith(1)
    expect(onHire).not.toHaveBeenCalled()
  })

  it('칸 4·9 는 [42] 알림 하나 — G 로 못 연다', () => {
    const onOpenAce = vi.fn()
    띄우기(상태({ money: 9999, popularity: 9999 }), [0, 1, 2, 3], [0, 1, 2, 3], onOpenAce)

    fireEvent.click(screen.getAllByRole('button', { name: 'LOCK' })[0])

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
