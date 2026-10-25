import { describe, expect, it } from 'vitest'
import { playerDetailOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherGameOptionsOf } from '@/pages/pitcher-league/model/pitcherGameOptions'
import { pitcherNariEntryViewOf } from '@/pages/pitcher-league/lib/pitcherEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'

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
