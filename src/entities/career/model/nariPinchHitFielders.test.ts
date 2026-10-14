import { describe, expect, it } from 'vitest'
import {
  nariFieldersAfterPinchHits,
  nariQuickLineupOf,
  nariRecordFieldersOf,
  seatAceBatter,
  tableNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'

describe('대타 0xaebe4 뒤 레코드 자리 니블 (aece6 — 두 레코드 니블 맞바꿈, 레코드 차례는 그대로)', () => {
  it('타순 칸 3 에 마타자(레코드 9)가 대타로 서면 마타자가 칸 3 시작 레코드의 니블을, 빠진 레코드가 마타자 니블(0)을 받는다', () => {
    const record = seatAceBatter(tableNariTeamRecord(0), 1)
    const fielders = nariRecordFieldersOf(record, 0, null)
    const lineup = nariQuickLineupOf(record)
    const rosterSlots = [...lineup.rosterSlots]
    const out = rosterSlots[3]
    rosterSlots[3] = rosterSlots[9]
    rosterSlots[9] = out
    rosterSlots.splice(9, 1)
    const after = nariFieldersAfterPinchHits(fielders, { ...lineup, rosterSlots })
    expect(after.map((fielder) => fielder.name)).toEqual(fielders.map((fielder) => fielder.name))
    expect(after[9].ace).toBe(1)
    expect(after[9].position).toBe(fielders[3].position)
    expect(after[3].position).toBe(fielders[9].position)
    // 대타가 없으면 그대로
    expect(nariFieldersAfterPinchHits(fielders, lineup)).toEqual(fielders)
  })
})
