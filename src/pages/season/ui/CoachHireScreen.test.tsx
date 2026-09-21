// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CoachHireScreen } from '@/pages/season/ui/CoachHireScreen'
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

const 띄우기 = (state: SeasonState) => {
  const onHire = vi.fn()
  render(<CoachHireScreen state={state} onHire={onHire} onBack={vi.fn()} />)
  return onHire
}

const 줄고르기 = (이름: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(이름) }))
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('코치 목록', () => {
  it('마투수 다섯·마타자 다섯이 계약금과 함께 나온다', () => {
    띄우기(상태())

    expect(screen.getByRole('button', { name: /싸이커/ }).textContent).toContain('1억')
    expect(screen.getByRole('button', { name: /드래고나/ }).textContent).toContain('3억5000')
    expect(screen.getByRole('button', { name: /킹타이거/ })).toBeDefined()
  })

  it('고른 칸의 보너스·필요 인기도가 아래에 나온다 (StrMODE[149]·[160])', () => {
    띄우기(상태())

    expect(document.body.textContent).toContain('팀 투수 변화 +8')
    expect(document.body.textContent).toContain('필요 인기도 : 0')
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
