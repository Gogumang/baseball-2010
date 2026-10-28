import { describe, expect, it } from 'vitest'
import { arrivalPlaySettles, pendingSettlementEventsAfter, withSettlementEvents } from '@/features/defense-play/model/settlementEvents'

describe('정산 사건 목록의 앞 몫 — 0xa5e14 · 0xa5bcc 만 비운다', () => {
  it('같은 타석이 이어지면 판의 아웃 · 득점을 얹고, 끝나면 없앤다', () => {
    expect(withSettlementEvents(undefined, { outs: 1, runs: 0 })).toEqual({ outs: 1, runs: 0 })
    expect(withSettlementEvents({ outs: 1, runs: 2 }, { outs: 1, runs: 1 })).toEqual({ outs: 2, runs: 3 })
    expect(pendingSettlementEventsAfter({ outs: 1, runs: 0 }, { outs: 0, runs: 1 }, true)).toEqual({ outs: 1, runs: 1 })
    expect(pendingSettlementEventsAfter({ outs: 1, runs: 0 }, { outs: 0, runs: 1 }, false)).toBeUndefined()
  })
})

describe('판정 B 0xae3e8 이 공 도착 판을 정산하는가 (ae554 · ae576 · ae596)', () => {
  it('도루(5)는 늘, 폭투·포일(9)은 삼진이 선 판이나 반 이닝 · 경기가 끝난 판만', () => {
    expect(arrivalPlaySettles({ kind: 5, strikeout: 'none' }, { halfOrGameEnded: false })).toBe(true)
    expect(arrivalPlaySettles({ kind: 9, strikeout: 'none' }, { halfOrGameEnded: false })).toBe(false)
    expect(arrivalPlaySettles({ kind: 9, strikeout: 'none' }, { halfOrGameEnded: true })).toBe(true)
    expect(arrivalPlaySettles({ kind: 9, strikeout: 'strikeoutStands' }, { halfOrGameEnded: false })).toBe(true)
    expect(arrivalPlaySettles({ kind: 9, strikeout: 'batterRuns' }, { halfOrGameEnded: false })).toBe(true)
  })
})
