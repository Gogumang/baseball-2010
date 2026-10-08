import { describe, expect, it } from 'vitest'
import {
  DERBY_HALL_OF_FAME_BATTER_SLOT,
  confirmDerbyNextBatter,
  createDerbyLineup,
  derbyLineupBatterOf,
  derbyMasterBatterOf,
  derbyModeBatterPositionOf,
  reserveDerbyNextBatter,
} from '@/entities/home-run-derby/model/derbyLineup'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { masterBatterAbilityOf } from '@/entities/mission/model/missionCpuTeam'

describe('홈런더비 공격 팀 타순 — 0x39fdc · 0xaf020 · 0xaebe4', () => {
  it('경기를 세우면 타순 = 모드 타자 칸 k (3a550 0xb6394)', () => {
    const lineup = createDerbyLineup(3, 5)
    expect(lineup).toEqual({ teamId: 3, modeBatterSlot: 5, order: 5, reservedOrder: null })
    expect(derbyLineupBatterOf(lineup)).toEqual({ isModeBatter: true, order: 5 })
  })

  it('볼넷 · 사구(0xaf020)는 예약만 — 0xd 의 0xaebe4 가 타순을 넘긴다', () => {
    const reserved = reserveDerbyNextBatter(createDerbyLineup(3, 5))
    expect(reserved.order).toBe(5)
    expect(reserved.reservedOrder).toBe(6)
    expect(derbyLineupBatterOf(reserved).isModeBatter).toBe(true)
    const confirmed = confirmDerbyNextBatter(reserved)
    expect(confirmed).toEqual({ teamId: 3, modeBatterSlot: 5, order: 6, reservedOrder: null })
    expect(derbyLineupBatterOf(confirmed)).toEqual({ isModeBatter: false, order: 6, row: teamBatters(3)[6] })
  })

  it('예약이 서 있으면(+0x291) 또 볼넷이어도 한 칸뿐 (af02e)', () => {
    const twice = reserveDerbyNextBatter(reserveDerbyNextBatter(createDerbyLineup(0, 2)))
    expect(confirmDerbyNextBatter(twice).order).toBe(3)
  })

  it('예약이 없으면 0xd 를 지나도 그대로', () => {
    const lineup = createDerbyLineup(0, 2)
    expect(confirmDerbyNextBatter(lineup)).toBe(lineup)
  })

  it('타순은 mod 9 로 돌아 k 에 오면 다시 모드 타자 — 8 다음은 0', () => {
    let lineup = createDerbyLineup(1, 7)
    const orders: number[] = []
    for (let index = 0; index < 9; index += 1) {
      lineup = confirmDerbyNextBatter(reserveDerbyNextBatter(lineup))
      orders.push(lineup.order)
    }
    expect(orders).toEqual([8, 0, 1, 2, 3, 4, 5, 6, 7])
    expect(derbyLineupBatterOf(lineup).isModeBatter).toBe(true)
  })

  it('명예 타자 칸은 0 (0x20 & 0x1f)', () => {
    expect(DERBY_HALL_OF_FAME_BATTER_SLOT).toBe(0)
  })

  it('모드 타자의 수비는 옛 [k] 마스터 줄의 +0x1c (0xb53f0 b54b6 · b551a)', () => {
    expect(derbyModeBatterPositionOf(createDerbyLineup(4, 3))).toBe(teamBatters(4)[3]!.position! & 0xf)
  })
})

describe('마스터 타자 줄의 타석 재료', () => {
  it('능력치는 0xb6415 · 스킬은 +0x14 비트 · 폼 · 피부는 +0xb · 장비는 니블 네 칸', () => {
    // 외인구단(팀 14)은 장비 니블이 차 있다
    const row = teamBatters(14).find((player) => player.skillBits !== 0) ?? teamBatters(14)[0]!
    const batter = derbyMasterBatterOf(row)
    expect(batter.ability).toEqual(masterBatterAbilityOf(row))
    expect(batter.name).toBe(row.name)
    expect(batter.form).toBe(row.profile >> 4)
    expect(batter.skinIndex).toBe((row.profile >> 2) & 3)
    expect(batter.equipmentLevels).toEqual({
      hit: row.equipment[0],
      power: row.equipment[1],
      defense: row.equipment[2],
      run: row.equipment[3],
    })
    for (const id of batter.skillIds) expect((row.skillBits >>> id) & 1).toBe(1)
    expect(batter.skillIds.length).toBe(row.skillBits.toString(2).split('').filter((bit) => bit === '1').length)
  })
})
