// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameIncomeScreen } from '@/pages/season/ui/GameIncomeScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { IncomeSettlement } from '@/entities/season-mode/model/seasonAttendance'

/**
 * 경기 뒤 관중·수입 창 (상태 0xe9 = `0xdea0`) — 계산은 `0xa34b8`, 표시는 J 4-7.
 * 문서의 예("평판 300 · 10경기 이후 · 1위 vs 5위 → 18160명 · 수입 13")를 그대로 못박는다.
 */

afterEach(cleanup)

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

const 띄우기 = (record: SeasonRecord, input = { myRank: 0, opponentRank: 4 }) => {
  const onConfirm = vi.fn()
  render(<GameIncomeScreen record={record} teamMorale={100} input={input} onConfirm={onConfirm} />)
  return onConfirm
}

const 창글 = () => screen.getByRole('group', { name: '경기 수입' }).textContent ?? ''

describe('경기 수입 정산', () => {
  it('J 4-7 의 보기 그대로 18160명 · 1300만이 나온다', () => {
    띄우기(레코드({ reputation: 300, games: 10 }))

    expect(창글()).toContain('18160명')
    expect(창글()).toContain('1300만')
  })

  it('수입이 소지금에 더해진다 (5000만 + 1300만)', () => {
    const onConfirm = 띄우기(레코드({ reputation: 300, games: 10 }))

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    const settlement = onConfirm.mock.calls[0][0] as IncomeSettlement
    expect(settlement.income).toBe(13)
    expect(settlement.record.money).toBe(63) // 50 + 13 (100만 단위)
    expect(settlement.record.lastAttendance).toBe(18160)
  })

  it('구내매점이 남아 있으면 +200만이 붙고 남은 경기가 하나 준다 (R13 10절)', () => {
    const onConfirm = 띄우기(레코드({ reputation: 300, games: 10, storeGames: 45 }))

    expect(창글()).toContain('1500만')
    expect(창글()).toContain('(+200)')

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    const settlement = onConfirm.mock.calls[0][0] as IncomeSettlement
    expect(settlement.income).toBe(15)
    expect(settlement.record.storeGames).toBe(44)
  })

  it('구내매점 기간이 이 경기로 끝나면 StrUSER_EVT[113] 안내가 먼저 뜬다', () => {
    const onConfirm = 띄우기(레코드({ reputation: 300, games: 10, storeGames: 1 }))

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).not.toHaveBeenCalled()
    const 알림 = screen.getByRole('dialog', { name: '알림' })
    expect(알림.textContent).toContain('기간이 끝났습니다')

    fireEvent.click(within(알림).getByRole('button', { name: '확인' }))
    expect((onConfirm.mock.calls[0][0] as IncomeSettlement).record.storeGames).toBe(0)
  })

  it('관중석이 작으면 수용 상한에 걸린다 (1단 관중석 = 2만 명)', () => {
    띄우기(레코드({ reputation: 9999, games: 10 }))

    expect(창글()).toContain('20000명')
  })

  it('시즌 초반(9경기 이하)에는 순위 대신 +100 을 쓴다 — 순위를 바꿔도 같다', () => {
    띄우기(레코드({ reputation: 300, games: 9 }), { myRank: 0, opponentRank: 0 })
    const 앞 = 창글()
    cleanup()
    띄우기(레코드({ reputation: 300, games: 9 }), { myRank: 9, opponentRank: 9 })

    expect(창글()).toBe(앞)
  })
})
