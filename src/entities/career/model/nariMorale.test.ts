import { describe, expect, it } from 'vitest'
import {
  nariLeagueRecordMoralesOf,
  nariMoraleAfterBurst,
  nariMoraleOf,
  nariTeamRecordMoraleOf,
  withNariGameMorale,
  withNariMorale,
  withNariTeamRecordMorales,
} from '@/entities/career/model/nariMorale'
import { createNariCupTeams, nextNariCupDayTeams, prepareNariCupMatch } from '@/entities/career/model/nariCupTeams'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import { createCareer } from '@/entities/career/model/playerCareer'

const 리그 = { morale: 37 }
const 대회 = { morale: 37, nationalCup: createNationalCup(), nariCupTeams: createNariCupTeams(7, 11) }

describe('나리 사기 0xa3a24 · 0xa3a44 — 팀 레코드 +2 (대회 중이면 상대국 칸 +0xbe0, 원본 버그)', () => {
  it('대회가 아니면 커리어 사기를 읽고 쓴다 (0x1f988 → 리그 내 팀 칸)', () => {
    expect(nariMoraleOf(리그)).toBe(37)
    expect(withNariMorale(리그, 150).morale).toBe(100)
    expect(withNariMorale(리그, -3).morale).toBe(0)
  })

  it('대회 중(S+0x12c)에는 상대국 칸 +2 — 마스터 복사라 표값 100 이고, 쓰면 커리어 사기는 그대로 상대국 칸에 쌓인다', () => {
    expect(nariMoraleOf(대회)).toBe(100)
    const 썼다 = withNariMorale(대회, 85)
    expect(썼다.morale).toBe(37)
    expect(nariMoraleOf(썼다)).toBe(85)
    // 142 준비(같은 날)는 그 칸을 그대로 두고, 하루 끝 b8216 의 새 복사(0x20648)가 지운다
    expect(nariMoraleOf({ ...썼다, nariCupTeams: prepareNariCupMatch(썼다.nariCupTeams, 1) })).toBe(85)
    expect(nariMoraleOf({ ...썼다, nariCupTeams: nextNariCupDayTeams(썼다.nariCupTeams, 12) })).toBe(100)
  })

  it('경기 능력치의 사기(0xb570c b5768 → b57c4)도 같은 값이다 — 대회 중이면 커리어 사기 대신 상대국 칸', () => {
    expect(withNariGameMorale(리그)).toBe(리그)
    expect(withNariGameMorale(대회).morale).toBe(100)
  })

  it('돌발 보상 사기(0x8e34c 종류 1)만 0..100 으로 잘라 차례로 먹인다', () => {
    expect(
      nariMoraleAfterBurst(95, [
        { name: '사기', amount: 10 },
        { name: '인기도', amount: 5 },
        { name: '사기', amount: -20 },
      ]),
    ).toBe(80)
  })

  it('타자편 돌발 보상 — 대회 중 사기는 상대국 칸에 쌓이고 커리어 사기는 그대로 (8e408~8e422)', () => {
    const career = { ...createCareer('김'), morale: 40, nationalCup: createNationalCup(), nariCupTeams: createNariCupTeams(7, 11) }
    const rewarded = applyBurstRewards(career, [
      { name: '사기', amount: -30 },
      { name: '평판', amount: 5 },
    ])
    expect(rewarded.morale).toBe(40)
    expect(nariMoraleOf(rewarded)).toBe(70)
    expect(rewarded.reputation).toBe(career.reputation + 5)
    const { nationalCup: _cup, ...outside } = career
    const league = applyBurstRewards(outside, [{ name: '사기', amount: -30 }])
    expect(league.morale).toBe(10)
  })
})

describe('리그 팀 레코드 +2 의 앞 값 teamRecordMorales — 그 팀이 마지막으로 치른 경기 때의 나리 사기 (r101)', () => {
  it('없으면 표값 100, 경기를 치른 팀은 그때 사기로 덮인다', () => {
    const 커리어: { readonly morale: number; readonly teamRecordMorales?: Readonly<Record<number, number>> } = { morale: 37 }
    expect(nariTeamRecordMoraleOf(커리어, 3)).toBe(100)
    const 뒤 = withNariTeamRecordMorales(커리어, [3, 5], 42)
    expect(nariTeamRecordMoraleOf(뒤, 3)).toBe(42)
    expect(nariTeamRecordMoraleOf(뒤, 5)).toBe(42)
    expect(nariTeamRecordMoraleOf(뒤, 4)).toBe(100)
    expect(Object.keys(nariLeagueRecordMoralesOf(뒤))).toHaveLength(10)
    expect(nariLeagueRecordMoralesOf(뒤)[5]).toBe(42)
  })
})
