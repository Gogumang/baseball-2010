import { describe, expect, it } from 'vitest'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import { quickBatterOf, quickPitcherOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { equippedSeasonAbilityOf } from '@/entities/season-mode/model/seasonPlayerRecord'

describe('레코드 실효 능력치 0xb6414(rec, k, 1) — 장비 니블 · 장착 스킬', () => {
  it('니블 n 은 0xd8890[n − 1] 을 더하고 999 에서 자른다 — 칸 k 의 니블이 칸 k 에만', () => {
    expect(recordAbilityOf({ ability: [500, 500, 990, 500], skillBits: 0, equipment: [1, 0, 2, 11] }, false))
      .toEqual([530, 500, 999, 750])
  })

  it('스킬 5 −100 · 7 +50 은 네 칸 모두, 20 은 타자 수비만 −100, 22 는 투수 제구만 +10% (자르지 않는다)', () => {
    const bits = (1 << 5) | (1 << 7) | (1 << 20) | (1 << 22)
    expect(recordAbilityOf({ ability: [100, 50, 120, 300], skillBits: bits, equipment: [0, 0, 0, 0] }, false))
      .toEqual([50, 50, 0, 250])
    expect(recordAbilityOf({ ability: [990, 50, 120, 300], skillBits: 1 << 22, equipment: [11, 0, 0, 0] }, true)[0])
      .toBe(999 + 99)
  })

  it('시즌 카드 equippedSeasonAbilityOf 와 같은 함수다', () => {
    const view = {
      name: '', isPitcher: false, base: [400, 450, 500, 550], profile: 0, skillBits: (1 << 7) | (1 << 20),
      equipment: [3, 0, 1, 0], fieldPosition: 0, isComplete: true,
    }
    expect(recordAbilityOf({ ability: view.base, skillBits: view.skillBits, equipment: view.equipment }, false))
      .toEqual([0, 1, 2, 3].map((slot) => equippedSeasonAbilityOf(view, slot)))
  })
})

describe('간이 타석 능력은 레코드의 0xb6414 를 밑값으로 한다 (0xab214 → 0xb570d(…, 1, 0x5a, 1))', () => {
  it('외인구단(팀 14) 타자는 Xls 행의 배트 니블 3 으로 파워 +70', () => {
    const row = teamBatters(14)[0]!
    expect(row.equipment).toEqual([0, 3, 0, 0])
    expect(quickBatterOf(row).power).toBe(Math.min(row.ability[1] + 70, 999))
    expect(quickBatterOf(row).hit).toBe(row.ability[0])
  })

  it('넘긴 장비 니블(시즌 저장 명단)이 Xls 행 니블을 대신한다 — 투수 손(구질 표 차례)은 그대로', () => {
    const row = teamPitchers(0)[1]!
    const plain = quickPitcherOf(row)
    expect(plain.control).toBe(row.ability[0])
    const equipped = quickPitcherOf(row, [2, 0, 0, 1])
    expect(equipped.control).toBe(row.ability[0] + 50)
    expect(equipped.stamina).toBe(row.ability[3] + 30)
    expect(equipped.velocity).toBe(row.ability[1])
    expect(equipped.hand).toBe(plain.hand)
  })
})
