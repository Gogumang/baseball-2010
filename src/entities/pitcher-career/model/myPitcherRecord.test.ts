import { describe, expect, it } from 'vitest'
import {
  gameMyPitcherOrderOf,
  legacyMyPitcherOrderOf,
  myPitcherPositionCodeOf,
  prepareMyPitcherOrder,
  registeredMyPitcherOrderOf,
} from '@/entities/pitcher-career/model/myPitcherRecord'
import { MY_RECORD_SLOT } from '@/entities/career/model/nariTeamRecord'
import {
  createPitcherCareer,
  pitcherLeagueGameSetupOf,
  prepareMyPitcherMatch,
  startNextPitcherSeason,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'

const 나 = MY_RECORD_SLOT

describe('투수편 내 팀 투수 배열 — 등록 0x10fb4 · 0xb521c · 142 진입 0x1c46c', () => {
  it('등록: 선발은 칸 0([나, 1…7, 0]), 구원은 칸 7([0…6, 나, 7]) — 옛 그 칸 선수가 맨 끝', () => {
    expect(registeredMyPitcherOrderOf(PITCHER_ROLE.starter)).toEqual([나, 1, 2, 3, 4, 5, 6, 7, 0])
    expect(registeredMyPitcherOrderOf(PITCHER_ROLE.relief)).toEqual([0, 1, 2, 3, 4, 5, 6, 나, 7])
  })

  it('새 구원 투수의 포지션 코드는 7 — 116 평가가 구원형(> 3)으로 본다', () => {
    const career = createPitcherCareer('구원', { role: PITCHER_ROLE.relief, typeIndex: 0, handIndex: 0, skinIndex: 0, breakingPitchSlots: [], teamId: 2 })
    expect(career.positionCode).toBe(7)
    expect(career.nariTeams?.[2]?.pitchers).toEqual([0, 1, 2, 3, 4, 5, 6, 나, 7])
    expect(career.nariTeams?.[1]?.pitchers).toBeUndefined()
  })

  it('선발: 0xa4f60 의 k 로 맞바꿈이 영구로 쌓이고 두 날씩 되돌아온다', () => {
    const day = (dayCounter: number) => ({ dayCounter, role: PITCHER_ROLE.starter, isPostseason: false })
    let order = registeredMyPitcherOrderOf(PITCHER_ROLE.starter)
    order = prepareMyPitcherOrder(order, day(0))
    expect(order[0]).toBe(나)
    order = prepareMyPitcherOrder(order, day(1))
    expect(order[0]).toBe(1)
    expect(myPitcherPositionCodeOf(order)).toBe(1)
    order = prepareMyPitcherOrder(order, day(2))
    expect(order).toEqual(registeredMyPitcherOrderOf(PITCHER_ROLE.starter))
  })

  it('구원: 0~3 이 포스트시즌에도 날마다 돌고(g ≠ 0) 내 칸 7 은 안 움직인다', () => {
    const relief = { role: PITCHER_ROLE.relief, isPostseason: true }
    let order = registeredMyPitcherOrderOf(PITCHER_ROLE.relief)
    order = prepareMyPitcherOrder(order, { ...relief, dayCounter: 0 })
    expect(order.slice(0, 4)).toEqual([0, 1, 2, 3])
    order = prepareMyPitcherOrder(order, { ...relief, dayCounter: 1 })
    expect(order).toEqual([1, 2, 3, 0, 4, 5, 6, 나, 7])
    expect(myPitcherPositionCodeOf(order)).toBe(7)
  })

  it('옛 저장(배열 없음)은 날짜 셈 — 오늘까지 밟으면 예전 웹 0번과 같다', () => {
    const day = { dayCounter: 5, role: PITCHER_ROLE.relief, isPostseason: false }
    expect(legacyMyPitcherOrderOf(day, true).slice(0, 4)).toEqual([1, 2, 3, 0])
    expect(legacyMyPitcherOrderOf(day, false).slice(0, 4)).toEqual([0, 1, 2, 3])
  })

  it('142 준비가 레코드·포지션 코드를 고치고, g == 0 이면 내 스태미나 10000 (0x1c8a8)', () => {
    const base = createPitcherCareer('구원', { role: PITCHER_ROLE.relief, typeIndex: 0, handIndex: 0, skinIndex: 0, breakingPitchSlots: [], teamId: 0 })
    const tired = { ...base, stamina: 3000, gamesPlayed: 0 }
    const prepared = prepareMyPitcherMatch(tired)
    expect(prepared.stamina).toBe(FULL_STAMINA)
    const setup = pitcherLeagueGameSetupOf(prepared, 1)
    expect(setup.ourPitcherOrder).toEqual(gameMyPitcherOrderOf([0, 1, 2, 3, 4, 5, 6, 나, 7]))
    expect(setup.ourPitcherOrder[7]).toBe(8)
    expect(setup.positionCode).toBe(7)
    expect(setup.stamina).toBe(FULL_STAMINA)

    const later = prepareMyPitcherMatch({ ...prepared, stamina: 3000, gamesPlayed: 1 })
    expect(later.stamina).toBe(3000)
    expect(later.nariTeams?.[0]?.pitchers).toEqual([1, 2, 3, 0, 4, 5, 6, 나, 7])
    expect(pitcherLeagueGameSetupOf(later, 1).stamina).toBeUndefined()
  })

  it('새 시즌 0x1b684 — 선발은 내 투수를 0번으로', () => {
    const base = createPitcherCareer('선발')
    const swapped = { ...base, nariTeams: base.nariTeams?.map((record, team) => team === base.teamId ? { ...record, pitchers: [1, 나, 2, 3, 4, 5, 6, 7, 0] } : record) }
    expect(startNextPitcherSeason(swapped).nariTeams?.[base.teamId]?.pitchers?.[0]).toBe(나)
  })
})
