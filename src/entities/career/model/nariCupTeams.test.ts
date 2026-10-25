import { describe, expect, it } from 'vitest'
import {
  createNariCupTeams,
  nariCupBattingOrderOf,
  nariCupRecordOf,
  myCupPitcherStaminaOf,
  myCupPitcherWalksOf,
  nextNariCupDayTeams,
  prepareNariCupMatch,
  recordNariCupGame,
} from '@/entities/career/model/nariCupTeams'
import { MY_RECORD_SLOT, nariQuickLineupOf } from '@/entities/career/model/nariTeamRecord'

describe('국가대항전 대회 레코드 두 칸 — +0xbc4 대표팀 · +0xbe0 상대국 (0xb7bf0 · 133 · 0x1c46c · 0xb818c)', () => {
  it('대표팀은 마스터 팀 10 에 내 선수를 내 칸에 넣고(0xb53f1 0x80 갈래) 그 칸 선수는 위치 0 으로 맨 끝', () => {
    const teams = createNariCupTeams(7, 11)
    expect(teams.korea.batters[7]?.slot).toBe(MY_RECORD_SLOT)
    expect(teams.korea.batters.at(-1)).toMatchObject({ slot: 7, position: 0 })
    expect(nariCupBattingOrderOf(teams)).toBe(8)
    expect(teams.opponentTeamId).toBe(11)
    expect(teams.opponent.batters[7]?.slot).toBe(7)
  })

  it('레코드 칸 0xb6394 — 경기 장면 3a2fa 의 0xb8768 이 대표팀 배열을 다시 매겨 내 칸 = 타순 − 1, 밀려난 옛 칸 선수는 끝 첨자', () => {
    const teams = createNariCupTeams(2, 12)
    const lineup = nariQuickLineupOf(teams.korea)
    expect((nariCupBattingOrderOf(teams) ?? 0) - 1).toBe(2)
    expect(lineup.recordSlots?.[2]).toBe(2)
    // 붙박이 칸 2 였던 선수는 맨 끝(12)으로 가 그 첨자를 받는다 — 붙박이 칸 2 가 아니다
    expect(lineup.rosterSlots.at(-1)).toBe(2)
    expect(lineup.recordSlots?.at(-1)).toBe(teams.korea.batters.length - 1)
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

describe('대표팀 칸에 대회 경기가 남기는 것 — 게이트 0xa56dc 밖 (r221)', () => {
  it('사기 +2(3a31e · b5762) · 대표팀 실책 +0x2e(0x43278) · 내 투수 사사구 +0x2a(a8b04) 를 쌓고, 하루 끝 새 복사에도 남는다', () => {
    const teams = { ...createNariCupTeams(0, 11), opponentMorale: 70 }
    const played = recordNariCupGame(teams, {
      morale: 70,
      errors: [
        { teamId: 10, battingOrderIndex: 3 },
        { teamId: 10, battingOrderIndex: 3 },
        { teamId: 11, battingOrderIndex: 5 },
      ],
      myWalks: 2,
    })
    expect(played.koreaMorale).toBe(70)
    expect(played.koreaErrors).toEqual({ 3: 2 })
    expect(played.myCupWalks).toBe(2)
    const nextDay = nextNariCupDayTeams(recordNariCupGame(played, { myWalks: 1 }), 12)
    expect(nextDay.koreaMorale).toBe(70)
    expect(nextDay.koreaErrors).toEqual({ 3: 2 })
    expect(nextDay.myCupWalks).toBe(3)
    // 상대국 칸 +2 는 새 복사로 지워진다
    expect(nextDay.opponentMorale).toBeUndefined()
    expect(myCupPitcherWalksOf(nextDay, 9998)).toBe(9999)
  })

  it('내 투수 사본 +0x2c — 첫날은 베낀 내 스태미나, 하루 끝 b81e0 0xb6190 뒤로는 10000', () => {
    expect(myCupPitcherStaminaOf(0, 4300)).toBe(4300)
    expect(myCupPitcherStaminaOf(1, 4300)).toBe(10000)
  })
})
