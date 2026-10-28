import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createCareer, startNextSeason } from '@/entities/career/model/playerCareer'
import { createPitcherCareer, startNextPitcherSeason } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  nariBatterEquipmentOf,
  nariLeagueTeamRecordOf,
  nariPitcherEquipmentOf,
  nariTeamRecordEquipmentOf,
  rollNariCpuEquipment,
} from '@/entities/career/model/nariCpuEquipment'
import { createNariTeamRecords, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { batterAt, quickPitcherOf, teamPitchers } from '@/entities/team/model/teamRoster'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { opponentPitcherAbilityOf, opponentPitcherEquipmentOf, startGame } from '@/features/play-game/model/gameFlow'
import { nariEntryBattersOf, nariEntryPitchersOf } from '@/pages/management/lib/nariEntryView'

/** rand(lo, hi) 를 적고 `pick` 을 돌려주는 가짜 — 0x665e8 은 rand(0, 2) 만 부른다 */
function 기록난수(pick: (call: number) => number = () => 0): RandomPort & { readonly calls: [number, number][] } {
  const calls: [number, number][] = []
  return {
    calls,
    rand(lo: number, hi: number) {
      calls.push([lo, hi])
      return lo + pick(calls.length - 1)
    },
    rand9d() {
      throw new Error('0x665e8 은 0x9d468 을 안 부른다')
    },
  }
}

describe('나리 새 시즌 CPU 장비 굴림 0x665e8 (0x1b768 의 1b86c)', () => {
  it('2년차로 넘어가면(새 연차 1 · r4 = 2) 줄 둘 × 아홉 팀 = rand(0, 2) 18 번 — 타자편', () => {
    const random = 기록난수()
    const next = startNextSeason({ ...createCareer('선수'), teamId: 3 }, random)
    expect(random.calls).toHaveLength(18)
    expect(random.calls.every(([lo, hi]) => lo === 0 && hi === 2)).toBe(true)
    expect(next.season).toBe(2)
    expect(next.nariTeams).toBeDefined()
  })

  it('투수편도 같은 자리에서 같은 수를 굴린다', () => {
    const random = 기록난수()
    const next = startNextPitcherSeason({ ...createPitcherCareer('투수'), teamId: 5 }, random)
    expect(random.calls).toHaveLength(18)
    expect(next.nariTeams).toBeDefined()
  })

  it('줄 수는 새 연차로 늘고 r4 > 13 이면 안 굴린다 (66600 — 시즌모드 문턱 10 과 다르다)', () => {
    const count = (season: number) => {
      const random = 기록난수()
      startNextSeason({ ...createCareer('선수'), season }, random)
      return random.calls.length
    }
    // r4 = season + 1: 5 → 줄 아홉(r4 > 5 줄만 빠짐) · 13 → 열 줄 · 14 → 끝
    expect(count(4)).toBe(81)
    expect(count(9)).toBe(90)
    expect(count(12)).toBe(90)
    expect(count(13)).toBe(0)
  })

  it('안 굴린 해(r4 > 13)는 레코드를 건드리지 않는다', () => {
    const career = { ...createCareer('선수'), season: 13 }
    expect(startNextSeason(career, 기록난수()).nariTeams).toBe(career.nariTeams)
  })

  it('차례: 줄마다 팀 0..9(내 팀 건너뜀) — 첫 줄은 타자 3번 칸 부위 1, 둘째 줄은 투수 레코드 3번 칸 부위 0', () => {
    // 굴림 번호를 그대로 0/1 로 — 줄 1 의 팀 k 는 (k 번째 굴림 & 1)
    const random = 기록난수((call) => call & 1)
    const records = createNariTeamRecords(3, null)
    const order = [1, 2, 3, 0, 4, 5, 6, 7]
    const rolled = rollNariCpuEquipment(records, random, 1, 3, (team) => (team === 0 ? order : UNSHUFFLED_PITCHER_ORDER))
    const teams = [0, 1, 2, 4, 5, 6, 7, 8, 9]
    teams.forEach((team, k) => {
      // 줄 1: 표 0xd0abb[0] = 0 → 니블 = 0 + rand + 1, 부위 1 만 (부위 0 은 Xls 0 그대로)
      expect(nariBatterEquipmentOf(rolled[team], team, 3)).toEqual([0, (k & 1) + 1, 0, 0])
      // 줄 2: 투수 칸 (0 + 3) % 4 = 3 · 표 0xd0aa6[0] = 0 — 팀 0 은 레코드 3번 칸 = 표 칸 0
      const tableSlot = team === 0 ? 0 : 3
      expect(nariPitcherEquipmentOf(rolled[team], team, tableSlot)).toEqual([((9 + k) & 1) + 1, 0, 0, 0])
    })
    // 내 팀은 그대로
    expect(rolled[3]).toBe(records[3])
  })

  it('첫 시즌 · 옛 저장(레코드 없음)은 Xls 행 니블 — 리그 열 팀은 0 이라 덮개가 없다', () => {
    const career = createCareer('선수')
    const records = nariTeamsOf(career)
    expect(nariTeamRecordEquipmentOf(records, 0)).toBeUndefined()
    expect(nariLeagueTeamRecordOf(records, 0)).toBeUndefined()
    expect(nariPitcherEquipmentOf(records[0], 0, 0)).toEqual([0, 0, 0, 0])
  })
})

describe('굴린 니블이 능력치 · 화면에 실린다 (0xb6414 니블 보너스)', () => {
  const rolledCareer = () => startNextSeason({ ...createCareer('선수'), teamId: 3 }, 기록난수())
  const opponent = 0

  it('CPU 끼리 경기의 팀 레코드 · 경기 덮개에 실린다', () => {
    const records = rolledCareer().nariTeams
    const equipment = nariTeamRecordEquipmentOf(records, opponent)
    expect(equipment?.batters?.[3]).toEqual([0, 1, 0, 0])
    expect(equipment?.pitchers?.[3]).toEqual([1, 0, 0, 0])
    const league = nariLeagueTeamRecordOf(records, opponent)
    expect(league?.batters[3]?.equipment).toEqual([0, 1, 0, 0])
    expect(league?.batters[0]?.equipment).toBeUndefined()
    expect(league?.pitchers[3]?.equipment).toEqual([1, 0, 0, 0])
    // 내 팀은 굴리지 않는다
    expect(nariTeamRecordEquipmentOf(records, 3)).toBeUndefined()
  })

  it('간이 타석 능력 — 파워 · 제구에 니블 1 보너스', () => {
    const equipment = nariTeamRecordEquipmentOf(rolledCareer().nariTeams, opponent)
    const bonus = equipmentBonusOf(1)
    expect(bonus).toBeGreaterThan(0)
    expect(batterAt(opponent, 3, equipment).power).toBe(Math.min(999, batterAt(opponent, 3).power + bonus))
    const row = teamPitchers(opponent)[3]
    expect(quickPitcherOf(row, equipment?.pitchers?.[3]).control).toBe(Math.min(999, quickPitcherOf(row).control + bonus))
  })

  it('타자편 사람 경기 — 상대 마운드 투수 능력 · 장비 그림 니블', () => {
    const equipment = nariTeamRecordEquipmentOf(rolledCareer().nariTeams, opponent)
    const pitchers = { ourOrder: UNSHUFFLED_PITCHER_ORDER, opponentOrder: [3, 0, 1, 2, 4, 5, 6, 7] }
    const plain = startGame(기록난수(), 3, 1, opponent, 1, 0, false, pitchers)
    const equipped = startGame(기록난수(), 3, 1, opponent, 1, 0, false, pitchers, undefined, undefined, undefined, undefined, undefined, equipment)
    const bonus = equipmentBonusOf(1)
    const base = teamPitchers(opponent)[3].ability[0]
    expect(opponentPitcherAbilityOf(plain).gameAbility?.beforeFatigue.control).toBe(base)
    expect(opponentPitcherAbilityOf(equipped).gameAbility?.beforeFatigue.control).toBe(Math.min(999, base + bonus))
    expect(opponentPitcherEquipmentOf(plain)).toEqual([0, 0, 0, 0])
    expect(opponentPitcherEquipmentOf(equipped)).toEqual([1, 0, 0, 0])
  })

  it('143 엔트리 상세 창 도형 값(0xb6414)', () => {
    const record = rolledCareer().nariTeams?.[opponent]
    if (record === undefined) throw new Error('레코드 없음')
    const bonus = equipmentBonusOf(1)
    const batters = nariEntryBattersOf(record, opponent, null)
    const plainBatters = nariEntryBattersOf(createNariTeamRecords(3, null)[opponent], opponent, null)
    expect(batters[3]?.ability[1]).toBe(Math.min(999, (plainBatters[3]?.ability[1] ?? 0) + bonus))
    expect(batters[0]?.ability).toEqual(plainBatters[0]?.ability)
    const pitchers = nariEntryPitchersOf(opponent, UNSHUFFLED_PITCHER_ORDER, undefined, undefined, undefined, record.pitcherEquipment)
    expect(pitchers[3]?.ability[0]).toBe(Math.min(999, teamPitchers(opponent)[3].ability[0] + bonus))
  })
})
