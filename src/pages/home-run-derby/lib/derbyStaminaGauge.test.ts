import { describe, expect, it } from 'vitest'
import { DERBY_ORDINARY_PITCHER_ROW, derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import { derbyStaminaGaugeOf } from '@/pages/home-run-derby/lib/derbyStaminaGauge'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { masterGameAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'

describe('홈런더비 소개 판 체력 막대 (U-133 — 0x66e44 · 0xaebb0, f 늘 참)', () => {
  it('단계 0: 마스터 팀 v 의 투수 줄 2 체력 0xb6415 · 팀 v 레코드 사기 · 첫 투수 +200 · % 100', () => {
    for (const team of [0, 3, 9]) {
      const row = teamPitchers(team)[DERBY_ORDINARY_PITCHER_ROW]!
      const gauge = derbyStaminaGaugeOf(derbyPitcherOf(0, undefined, team), team)
      const staminaAbility = masterGameAbilityOf(row, true, 3)
      expect(gauge).toEqual({
        lengthValue: staminaCapacityOf(staminaAbility, teamRecordMoraleOf(team), true),
        maxValue: 0x5a9,
        percent: 100,
      })
    }
  })

  it('마투수 단계: 레벨 배율 뒤 체력 칸 · 수비 팀은 그대로 v', () => {
    const pitcher = derbyPitcherOf(2, { 2: 4 }, 5)
    expect(pitcher.staminaAbility).toBe(aceRecordAbilityAtLevel(pitcher.ace!, 4).run)
    const gauge = derbyStaminaGaugeOf(pitcher, 5)!
    expect(gauge.lengthValue).toBe(staminaCapacityOf(pitcher.staminaAbility!, teamRecordMoraleOf(5), true))
    expect(gauge.maxValue).toBe(0x5a9)
    expect(gauge.percent).toBe(100)
  })

  it('상대 팀을 모르면 막대를 비운다', () => {
    expect(derbyStaminaGaugeOf(derbyPitcherOf(0), undefined)).toBeUndefined()
  })
})
