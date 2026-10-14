import { describe, expect, it } from 'vitest'
import {
  PITCHER_ENTRY_ACE_SLOT,
  aceLeveledAbility,
  defenseTeamBonusFor,
  runnerTeamGradeFor,
  entryBattersOfOrder,
  entryPitchersOfOrder,
  rosterEntryBattersOf,
  rosterEntryPitchersOf,
  withAceBatter,
  withAcePitcher,
  withBatterRecordNibbles,
  withPitcherRecordNibbles,
} from '@/features/play-team-game/model/teamGameRoster'
import type { TeamEntryOrder } from '@/features/play-team-game/model/teamGameRoster'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { createFielders, defenseTeamBonusOf, runnerTeamGradeOf } from '@/entities/fielding/model/fieldingState'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'

describe('투수 명단의 레코드 +0x14 스킬 비트 — 공 하나 소모 0xa5e14 의 비겁자(18) · 끈기(10)', () => {
  it('붙박이 줄은 Xls 행 비트 그대로, 마투수 · 마타자는 XlsACE 행 비트 그대로 (0xb521c · 0xb53f0 이 통째 베낀다)', () => {
    const entry = rosterEntryPitchersOf(0)
    expect(entry.map((pitcher) => pitcher.skillBits)).toEqual(teamPitchers(0).map((player) => player.skillBits))
    // 전역 투수 0 번(팀 0 칸 0)은 끈기 줄이다 (104811f)
    expect(((entry[0]!.skillBits ?? 0) >>> 10) & 1).toBe(1)
    expect(withAcePitcher(entry, 0)[PITCHER_ENTRY_ACE_SLOT]!.skillBits).toBe(ACE_PITCHERS[0]!.skillBits)
    // 발렌타인(마투수 3) 0x410000 — 실투 16 안정감 · 22 냉정 / 킹타이거(마타자 4) 0x401200 — 압도 22
    expect(withAcePitcher(entry, 3)[PITCHER_ENTRY_ACE_SLOT]!.skillBits).toBe(0x410000)
    expect(withAceBatter(rosterEntryBattersOf(0), 4)[9]!.skillBits).toBe(0x401200)
  })
})

describe('명단 능력치는 레코드의 0xb6414(rec, k, 1) — 장비 니블 · 장착 스킬', () => {
  it('붙박이 줄은 Xls 행의 니블·스킬을 먹는다 — 외인구단(14) 타자 배트 니블 3 → 파워 +70', () => {
    const entry = rosterEntryBattersOf(14)
    const row = teamBatters(14)[0]!
    expect(entry[0]!.ability[1]).toBe(Math.min(row.ability[1] + 70, 999))
    expect(entry[0]!.equipment).toEqual([0, 3, 0, 0])
    // 리그 열 팀은 니블이 모두 0 이라 그대로
    expect(rosterEntryBattersOf(0).map((batter) => batter.ability)).toEqual(teamBatters(0).map((player) => player.ability))
  })

  it('명단 차례가 실은 니블(시즌 저장 명단)로 타자·투수 모두 보너스를 먹는다', () => {
    const order: TeamEntryOrder = {
      batters: [{ rosterSlot: 2, position: 3, equipment: [1, 0, 0, 4] }, { rosterSlot: 0, position: 2 }],
      pitchers: [{ tableSlot: 1, equipment: [0, 3, 0, 0] }, 0],
    }
    const batters = entryBattersOfOrder(0, order)
    const rowB = teamBatters(0)[2]!
    expect(batters[0]!.ability).toEqual([rowB.ability[0] + 30, rowB.ability[1], rowB.ability[2], rowB.ability[3] + 90])
    expect(batters[0]!.rosterSlot).toBe(2)
    expect(batters[1]!.ability).toEqual(teamBatters(0)[0]!.ability)
    const pitchers = entryPitchersOfOrder(0, order)
    const rowP = teamPitchers(0)[1]!
    expect(pitchers[0]!.ability).toEqual([rowP.ability[0], rowP.ability[1] + 70, rowP.ability[2], rowP.ability[3]])
    // 제 팀 표 자리 — 표 팀을 따로 들지 않고 칸 1 의 구질·보직으로 선다
    expect(pitchers[0]).toMatchObject({ tableSlot: 1, role: rosterPitcherRoleOf(1) })
    expect(pitchers[0]!.tableTeamId).toBeUndefined()
    expect(pitchers[1]!.ability).toEqual(teamPitchers(0)[0]!.ability)
  })
})

describe('명단 타자의 장착 스킬 비트 — 0xab214 가 0xb62b4(타자, n)로 레코드 +0x14 를 읽는다', () => {
  it('붙박이 표 줄은 Xls 행 비트, 기록으로 선 영입 선수는 그 기록의 비트를 든다', () => {
    expect(rosterEntryBattersOf(0).map((batter) => batter.skillBits)).toEqual(teamBatters(0).map((player) => player.skillBits))
    const order: TeamEntryOrder = {
      batters: [
        { rosterSlot: 3, position: 1 },
        { rosterSlot: -1, position: 2, record: { name: '명전', ability: [500, 500, 500, 500], recordId: 0xb4, skillBits: 1 << 22 } },
      ],
      pitchers: [0],
    }
    const entry = entryBattersOfOrder(0, order)
    expect(entry[0]?.skillBits).toBe(teamBatters(0)[3]?.skillBits)
    expect(entry[1]?.skillBits).toBe(1 << 22)
  })
})

describe('마선수 경기 능력치 aceLeveledAbility — 0xb6415(rec, k, 1): 레벨 배율 뒤 장착 스킬 단계', () => {
  it('발렌타인(마투수 3) 냉정 22 — Lv1 60% 제구 420 에 1/10 을 얹어 462, 다른 칸은 배율만', () => {
    const valentine = ACE_PITCHERS[3]!
    const raw = [valentine.ability.hit, valentine.ability.power, valentine.ability.defense, valentine.ability.run] as const
    const leveled = aceLeveledAbility(raw, '투수', 3, {})
    expect(leveled[0]).toBe(Math.trunc((raw[0] * 60) / 100) + Math.trunc(Math.trunc((raw[0] * 60) / 100) / 10))
    expect(leveled[1]).toBe(Math.trunc((raw[1] * 60) / 100))
  })
})

describe('기록으로 선 영입 선수의 니블 · +0xb — 영입 0xc554 가 통째로 옮긴 0x30 바이트', () => {
  const 투수기록 = {
    name: '나리투',
    ability: [500, 500, 500, 500] as const,
    repertoire: { name: '나리투', form: 1, pitchMask: 1, magicId: 0 },
    recordId: 0xfe,
    equipment: [4, 0, 0, 2],
  }
  const 타자기록 = { name: '나리타', ability: [500, 500, 500, 500] as const, recordId: 0xfe, equipment: [0, 3, 0, 0], profile: 0x34 }
  const order: TeamEntryOrder = {
    batters: [{ rosterSlot: -1, position: 3, record: 타자기록 }, ...Array.from({ length: 8 }, (_, slot) => ({ rosterSlot: slot, position: slot + 1 }))],
    pitchers: [투수기록, 1, 2, 3, 4],
  }

  it('명단 칸이 니블(마운드 장비 겹 0x79790 · 타자 0x78fd8)과 +0xb 를 든다', () => {
    expect(entryPitchersOfOrder(0, order)[0]?.equipment).toEqual([4, 0, 0, 2])
    expect(entryBattersOfOrder(0, order)[0]).toMatchObject({ equipment: [0, 3, 0, 0], profile: 0x34, recordId: 0xfe })
  })

  it('옛 경기 블록(칸 없음)은 같은 원본 id 의 지금 기록에서 빠진 칸만 채운다 — 표 줄 · 있는 값은 그대로', () => {
    const { equipment: _p, ...옛투수 } = entryPitchersOfOrder(0, order)[0]!
    const { equipment: _b, profile: _f, ...옛타자 } = entryBattersOfOrder(0, order)[0]!
    const 표투수 = entryPitchersOfOrder(0, order)[1]!
    expect(withPitcherRecordNibbles([옛투수, 표투수], order)).toEqual([{ ...옛투수, equipment: [4, 0, 0, 2] }, 표투수])
    expect(withBatterRecordNibbles([옛타자], order)).toEqual([{ ...옛타자, equipment: [0, 3, 0, 0], profile: 0x34 }])
    const 있는값 = { ...옛투수, equipment: [1, 1, 1, 1] }
    expect(withPitcherRecordNibbles([있는값], order)).toEqual([있는값])
  })
})

describe('수비 팀 보너스 — 판 시작 0xb0fb4 b10d0~b10f2', () => {
  it('모드 1·2·8·9 만 0xbbe98(팀레코드+8 = 집중) 등급, 나머지 모드는 0', () => {
    // 서울 드래곤즈(0) 집중 430 → 등급 3 · 인천 돌핀즈(2) 집중 320 → 등급 2
    for (const mode of [1, 2, 8, 9]) {
      expect(defenseTeamBonusFor({ mode, seasonTeamId: -1 }, 0)).toBe(3)
      expect(defenseTeamBonusFor({ mode, seasonTeamId: -1 }, 2)).toBe(2)
    }
    for (const mode of [3, 4, 5, 6, 7]) expect(defenseTeamBonusFor({ mode, seasonTeamId: -1 }, 0)).toBe(0)
    // 시즌 트레이닝을 먹인 팀 능력치를 넘기면 그 값을 본다
    expect(defenseTeamBonusFor({ mode: 2, seasonTeamId: 0, teamAbilities: [[0, 0, 926, 0]] }, 0)).toBe(7)
    expect(defenseTeamBonusOf(2, 125)).toBe(0)
  })

  it('940 + 8g 를 다 센 뒤 송구 속도에만 더한다 — 칸 0(투수)도 g = 2 고정값 위에 받고, 등급은 그대로', () => {
    const plain = createFielders([500, 500, 500, 500, 500, 500, 500, 500, 500])
    const bonused = createFielders([500, 500, 500, 500, 500, 500, 500, 500, 500], 3)
    expect(plain[0]!.baseThrowSpeed).toBe(956)
    expect(bonused[0]!.baseThrowSpeed).toBe(959)
    expect(bonused[0]!.throwSpeed).toBe(959)
    expect(bonused[0]!.defenseGrade).toBe(plain[0]!.defenseGrade)
    // 수비 500 → 등급 3 → g = 4 → 940 + 32
    expect(plain[4]!.baseThrowSpeed).toBe(972)
    expect(bonused[4]!.baseThrowSpeed).toBe(975)
  })
})

describe('주자 속도의 팀 등급 — 주자 만들기 0xa93ac a9488', () => {
  it('모드 1·2·8 만 0xbbe98(공격 팀레코드+0xa = 근성) 등급, 모드 9 를 포함한 나머지는 0', () => {
    // 서울 드래곤즈(0) 근성 365 → 등급 2 · 서울 게임빌즈(8) 근성 555 → 등급 4
    for (const mode of [1, 2, 8]) {
      expect(runnerTeamGradeFor({ mode, seasonTeamId: -1 }, 0)).toBe(2)
      expect(runnerTeamGradeFor({ mode, seasonTeamId: -1 }, 8)).toBe(4)
    }
    // 수비 보너스(b10d0, 1·2·8·9)와 달리 모드 9 는 a9488 의 비교(2 · 1 · 8)에 없다
    for (const mode of [0, 3, 4, 5, 6, 7, 9]) expect(runnerTeamGradeFor({ mode, seasonTeamId: -1 }, 8)).toBe(0)
    // 시즌 트레이닝을 먹인 팀 능력치를 넘기면 그 값을 본다
    expect(runnerTeamGradeFor({ mode: 2, seasonTeamId: 0, teamAbilities: [[0, 0, 0, 926]] }, 0)).toBe(7)
    expect(runnerTeamGradeOf(9, 926)).toBe(0)
  })

  it('주자+0xa4 = ⌊주루×7/100⌋ + 등급 — 달리기 속도 300 + 그 값', () => {
    expect(runnerSpeedOf(500, runnerTeamGradeOf(8, 555))).toBe(300 + 35 + 4)
  })
})
