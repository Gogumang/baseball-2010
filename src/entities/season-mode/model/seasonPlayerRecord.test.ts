import { describe, expect, it } from 'vitest'
import {
  equippedSeasonAbilityOf, hasSeasonSkill, seasonAbilityLimitsOf, seasonPlayerEquipmentOf, seasonPlayerRecordOf,
} from '@/entities/season-mode/model/seasonPlayerRecord'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'

/**
 * 시즌 선수 레코드 칸 — 0xd9 카드 · 0x897e8 글이 읽는 선수 +0xb · +0x14 · +0x19/+0x1a 를 붙박이 표 행에서 빌린다.
 */

const 보기 = (patch: Partial<SeasonPlayerRecordView>): SeasonPlayerRecordView => ({
  name: '시험', isPitcher: false, base: [500, 500, 500, 500], profile: 0, skillBits: 0,
  equipment: [0, 0, 0, 0], fieldPosition: 0, isComplete: true, ...patch,
})

describe('붙박이 표의 새 칸 (생성기 — Xls 행 +0xb · +0x14 · +0x19/+0x1a)', () => {
  it('서울 1번 타자 박택용 — +0xb 0x11 · 스킬 13·15 · 장비 없음', () => {
    expect(BATTERS[0]).toMatchObject({ name: '박택용', profile: 0x11, skillBits: (1 << 13) | (1 << 15), equipment: [0, 0, 0, 0] })
  })

  it('리그 열 팀의 장비 니블은 모두 0 — 외인구단(팀 14)만 차 있다', () => {
    const leagueEquipped = [...BATTERS.slice(0, 120), ...PITCHERS.slice(0, 80)].filter((player) => player.equipment.some((n) => n !== 0))
    expect(leagueEquipped).toEqual([])
    expect(BATTERS[168]?.equipment).toEqual([0, 3, 0, 0]) // 행 +0x19 = 0x03
    expect(PITCHERS[112]?.equipment).toEqual([3, 0, 0, 0]) // 행 +0x19 = 0x30
  })
})

describe('시즌 명단 선수 → 레코드 칸', () => {
  it('리그 선수는 붙박이 표 팀의 id 번째 행을 읽고 수비 위치는 명단 값이다', () => {
    const roster = tableRosterOf(0)
    const view = seasonPlayerRecordOf(0, roster.batters[3]!, false, 3)
    expect(view).toMatchObject({
      name: '페드로', isPitcher: false, base: [550, 560, 540, 340], profile: 0x34, fieldPosition: 1, isComplete: true,
    })
  })

  it('트레이드로 옮겨 온 선수는 옛 팀(tableTeamId) 표를 읽는다', () => {
    const player = { ...tableRosterOf(1).pitchers[0]!, tableTeamId: 1 }
    expect(seasonPlayerRecordOf(0, player, true, 0).name).toBe(PITCHERS[8]!.name)
  })

  it('장비는 명단 값이 있으면 그것, 없으면 표 값 (옛 저장 호환)', () => {
    const player = tableRosterOf(0).batters[0]!
    expect(seasonPlayerEquipmentOf(player, 0, false)).toEqual([0, 0, 0, 0])
    expect(seasonPlayerEquipmentOf({ ...player, equipment: [2, 0, 0, 5] }, 0, false)).toEqual([2, 0, 0, 5])
    expect(seasonPlayerRecordOf(0, { ...player, equipment: [2, 0, 0, 5] }, false, 0).equipment).toEqual([2, 0, 0, 5])
  })

  it('영입한 나리 선수는 기록 사본뿐이라 isComplete 가 거짓이다 (보직만 +0xb & 3 로 싣는다)', () => {
    const view = seasonPlayerRecordOf(0, {
      id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 10000,
      record: { name: '나리투수', ability: [700, 650, 600, 640], repertoire: { name: '', form: 0, magicId: 0, pitchMask: 1 }, role: 1 },
    }, true, 8)
    expect(view).toMatchObject({ name: '나리투수', base: [700, 650, 600, 640], profile: 1, skillBits: 0, isComplete: false })
  })
})

describe('0xb6415(기록, k, 1) — 장비·장착 스킬', () => {
  it('장비 니블 n 은 0xd8890[n − 1] 을 더하고 999 로 자른다', () => {
    expect(equippedSeasonAbilityOf(보기({ equipment: [1, 0, 0, 0] }), 0)).toBeGreaterThan(500)
    expect(equippedSeasonAbilityOf(보기({ base: [990, 0, 0, 0], equipment: [11, 0, 0, 0] }), 0)).toBe(999)
  })

  it('스킬 5 −100(바닥 0) · 7 +50 · 투수 22 제구 +10%(자르지 않음) · 타자 20 수비 −100', () => {
    expect(equippedSeasonAbilityOf(보기({ skillBits: 1 << 5, base: [50, 0, 0, 0] }), 0)).toBe(0)
    expect(equippedSeasonAbilityOf(보기({ skillBits: 1 << 7 }), 1)).toBe(550)
    expect(equippedSeasonAbilityOf(보기({ isPitcher: true, skillBits: 1 << 22, base: [999, 0, 0, 0] }), 0)).toBe(1098)
    expect(equippedSeasonAbilityOf(보기({ skillBits: 1 << 20 }), 2)).toBe(400)
    expect(equippedSeasonAbilityOf(보기({ skillBits: 1 << 20 }), 1)).toBe(500)
    expect(hasSeasonSkill(보기({ skillBits: 1 << 21 }), 21)).toBe(true)
  })
})

describe('최대 칸 0x5e864', () => {
  it('투수는 보직 min(+0xb & 3, 1) 행 — 0 → 800×4 · 1·2 → 850·850·850·600', () => {
    expect(seasonAbilityLimitsOf({ isPitcher: true, profile: 0x10 })).toEqual([800, 800, 800, 800])
    expect(seasonAbilityLimitsOf({ isPitcher: true, profile: 0x41 })).toEqual([850, 850, 850, 600])
    expect(seasonAbilityLimitsOf({ isPitcher: true, profile: 0x02 })).toEqual([850, 850, 850, 600])
  })

  it('타자는 +0xb >> 5 타입 행 — 0 → 800×4 · 1 → 800·850·750·750', () => {
    expect(seasonAbilityLimitsOf({ isPitcher: false, profile: 0x11 })).toEqual([800, 800, 800, 800])
    expect(seasonAbilityLimitsOf({ isPitcher: false, profile: 0x34 })).toEqual([800, 850, 750, 750])
  })
})
