import { describe, expect, it } from 'vitest'
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
