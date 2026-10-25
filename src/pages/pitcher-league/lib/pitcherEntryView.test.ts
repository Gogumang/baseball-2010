import { describe, expect, it } from 'vitest'
import { playerDetailOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherGameOptionsOf } from '@/pages/pitcher-league/model/pitcherGameOptions'
import { pitcherNariEntryViewOf } from '@/pages/pitcher-league/lib/pitcherEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import { createNariCupTeams } from '@/entities/career/model/nariCupTeams'
import { entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'

const capacityOf = (view: NariEntryView, slot: number) => view.lists.pitchers[slot]?.stamina?.capacity
const staminaOf = (view: NariEntryView, slot: number) => view.lists.pitchers[slot]?.ability[3] ?? 0

describe('투수편 143 — 체력 줄 용량 0x66e44 의 팀 레코드 +2 (r128)', () => {
  it('상대 팀은 그 팀이 마지막으로 선 경기 때의 나리 사기, 옛 저장은 100', () => {
    const base = createPitcherCareer('보기')
    const options = pitcherGameOptionsOf(base)
    const stale = { ...base, teamRecordMorales: { [options.opponentTeamId]: 15 } }
    const view = pitcherNariEntryViewOf(stale, pitcherGameOptionsOf(stale), false)
    expect(capacityOf(view, 0)).toBe(staminaCapacityOf(staminaOf(view, 0), 15, false))
    const old = pitcherNariEntryViewOf(base, options, false)
    expect(capacityOf(old, 0)).toBe(staminaCapacityOf(staminaOf(old, 0), 100, false))
  })

  it('내 팀은 커리어 사기 그대로', () => {
    const base = { ...createPitcherCareer('보기'), morale: 40 }
    const options = pitcherGameOptionsOf(base)
    const view = pitcherNariEntryViewOf({ ...base, teamRecordMorales: { [base.teamId]: 90 } }, options, true)
    const slot = view.lists.pitchers.findIndex((row) => row.name !== '보기' && row.stamina !== undefined)
    expect(capacityOf(view, slot)).toBe(staminaCapacityOf(staminaOf(view, slot), 40, false))
  })
})

describe("투수편 143 '0' 상세 창 — 내 투수 줄 (0x5b798 투수 갈래 · 육성 연봉 5c848~5c872)", () => {
  it('타입 · 손 · 구질 · 마구 · 연봉(저장 +0x1c8 × 100)을 커리어에서 채운다', () => {
    const base = { ...createPitcherCareer('보기'), salary: 50 }
    const view = pitcherNariEntryViewOf(base, pitcherGameOptionsOf(base), true)
    const row = view.lists.pitchers.find((candidate) => candidate.name === '보기')
    expect(row?.detailSource).toBeDefined()
    const detail = playerDetailOf(row!.detailSource!)
    expect(detail.kind).toBe('투수')
    expect(detail.values.at(-1)?.text).toBe('5000')
    expect(detail.values[2].text).not.toBe('')
  })
})

describe('투수편 143 내 투수 줄의 기록 열 · 체력 줄 — 0x56ebc 줄 레코드 +0x20~ · 0x572a4(+0x2c) (r213)', () => {
  it('커리어 시즌 줄과 +0x2c 스태미나 · 0x66e44 용량(장비 · 스킬을 얹은 체력)으로 선다', () => {
    const base = { ...createPitcherCareer('보기'), morale: 80, stamina: 4321 }
    const stats = { ...base.stats, outs: 27, runsAllowed: 4, saves: 1, strikeouts: 11, pitches: 120, walks: 3, wins: 2, losses: 1 }
    const career = { ...base, stats }
    const view = pitcherNariEntryViewOf(career, pitcherGameOptionsOf(career), true)
    const row = view.lists.pitchers.find((candidate) => candidate.name === '보기')
    expect(row?.pitcherLine).toEqual({ outs: 27, runsAllowed: 4, saves: 1, strikeouts: 11, pitches: 120, walks: 3, wins: 2, losses: 1 })
    expect(row?.stamina).toEqual({ capacity: staminaCapacityOf(row!.ability[3] ?? 0, 80, false), percent: 43 })
  })
})

describe('투수편 143 국가대항전 — 대회 칸 기록 열 (0x20648 마스터 복사 · 0xa56dc 거짓, r216)', () => {
  it('상대국 투수 줄은 Xls 행 줄 · 체력 100%, 용량은 상대국 칸 +2', () => {
    const base = createPitcherCareer('보기')
    const options = { ...pitcherGameOptionsOf(base), opponentTeamId: 12 }
    const cup = { ...createNariCupTeams(0, 12), opponentMorale: 55 }
    const view = pitcherNariEntryViewOf(base, options, false, cup)
    const row = view.lists.pitchers[0]!
    const player = teamPitchers(12).find((candidate) => candidate.name === row.name)!
    expect(row.pitcherLine).toEqual(entryPitcherLineOfRecord(player.recordLine))
    expect(row.pitcherLine?.outs).toBeGreaterThan(0)
    expect(row.stamina).toEqual({ capacity: staminaCapacityOf(player.ability[3], 55, false), percent: 100 })
    expect(view.lists.batters.every((batter) => batter.batterLine !== undefined)).toBe(true)
  })

  it('대표팀 칸 — 사기는 대회 경기가 남긴 +2, 붙박이 실책은 쌓인 수, 내 줄은 사사구 더하기 · 둘째 날부터 체력 100% (r221)', () => {
    const base = { ...createPitcherCareer('보기'), stamina: 4300 }
    const options = { ...pitcherGameOptionsOf(base), ourTeamId: 10, opponentTeamId: 12 }
    const cup = { ...createNariCupTeams(0, 12), koreaMorale: 33, koreaErrors: { 2: 4 }, myCupWalks: 5 }
    const day0 = pitcherNariEntryViewOf({ ...base, nariCupTeams: cup }, options, true, cup)
    expect(day0.lists.batters.find((row) => row.name === teamBatters(10)[2]?.name)?.batterLine?.errors).toBe(4)
    expect(day0.lists.batters.find((row) => row.name === teamBatters(10)[3]?.name)?.batterLine?.errors).toBe(0)
    const mine = day0.lists.pitchers.find((row) => row.name === '보기')!
    expect(mine.pitcherLine?.walks).toBe(5)
    expect(mine.stamina?.percent).toBe(43)
    expect(mine.stamina?.capacity).toBe(staminaCapacityOf(mine.ability[3] ?? 0, 33, false))
    const nationalCup = { day: 1 } as unknown as NonNullable<typeof base.nationalCup>
    const day1 = pitcherNariEntryViewOf({ ...base, nariCupTeams: cup, nationalCup }, options, true, cup)
    expect(day1.lists.pitchers.find((row) => row.name === '보기')?.stamina?.percent).toBe(100)
  })
})
