import { describe, expect, it } from 'vitest'
import {
  createNariCupTeams,
  nariCupBattingOrderOf,
  nariCupRecordOf,
  nextNariCupDayTeams,
  prepareNariCupMatch,
} from '@/entities/career/model/nariCupTeams'
import { MY_RECORD_SLOT } from '@/entities/career/model/nariTeamRecord'

describe('국가대항전 대회 레코드 두 칸 — +0xbc4 대표팀 · +0xbe0 상대국 (0xb7bf0 · 133 · 0x1c46c · 0xb818c)', () => {
  it('대표팀은 마스터 팀 10 에 내 선수를 내 칸에 넣고(0xb53f1 0x80 갈래) 그 칸 선수는 위치 0 으로 맨 끝', () => {
    const teams = createNariCupTeams(7, 11)
    expect(teams.korea.batters[7]?.slot).toBe(MY_RECORD_SLOT)
    expect(teams.korea.batters.at(-1)).toMatchObject({ slot: 7, position: 0 })
    expect(nariCupBattingOrderOf(teams)).toBe(8)
    expect(teams.opponentTeamId).toBe(11)
    expect(teams.opponent.batters[7]?.slot).toBe(7)
  })

  it('142 는 대회 날짜 g ≠ 0 이면 두 칸 투수 0~3 을 한 칸 돌리고, 하루 끝은 상대국 칸만 마스터에서 새로', () => {
    const first = prepareNariCupMatch(createNariCupTeams(0, 11), 0)
    expect(first.korea.pitchers?.slice(0, 4)).toEqual([0, 1, 2, 3])
    const day1 = prepareNariCupMatch(nextNariCupDayTeams(first, 12), 1)
    expect(day1.korea.pitchers?.slice(0, 4)).toEqual([1, 2, 3, 0])
    expect(day1.opponent.pitchers?.slice(0, 4)).toEqual([1, 2, 3, 0])
    const day2 = prepareNariCupMatch(nextNariCupDayTeams(day1, 13), 2)
    // 대표팀은 대회 내내 이어진다 · 상대국은 날마다 새 복사라 한 칸만
    expect(day2.korea.pitchers?.slice(0, 4)).toEqual([2, 3, 0, 1])
    expect(day2.opponent.pitchers?.slice(0, 4)).toEqual([1, 2, 3, 0])
    expect(nariCupRecordOf(day2, 13)).toBe(day2.opponent)
    expect(nariCupRecordOf(day2, 10)).toBe(day2.korea)
    expect(nextNariCupDayTeams(day2, null)).toBe(day2)
  })
})
