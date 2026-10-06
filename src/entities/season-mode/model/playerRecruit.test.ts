import { describe, expect, it } from 'vitest'
import {
  PLAYER_KIND,
  PLAYER_OWN_BIT,
  RECRUIT_PITCHER_STAMINA,
  hasCareerPlayerInSeasonTeam,
  hasRecruitedCareerPlayer,
  hasRecruitedHallOfFamePlayer,
  insertBatter,
  insertPitcher,
  isHallOfFameDeleteBlocked,
  isHallOfFameRecord,
  isPitcherRecord,
  nariRecruitPlayerOf,
  playerKindOf,
  recruitPlayer,
  recruitSourceOf,
  recruitsPitcher,
  removeCareerPlayerFromRoster,
  removeHallOfFamerFromRoster,
  slotOf,
  withSlot,
} from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'

const 투수 = (id: number, slot: number): SeasonPlayer => ({
  id,
  kindByte: PLAYER_KIND.일반투수 | slot,
  fieldPosition: 0,
  stamina: 5_000,
})

const 타자 = (id: number, slot: number, position: number): SeasonPlayer => ({
  id,
  kindByte: PLAYER_KIND.일반타자 | slot,
  fieldPosition: position,
  stamina: 0,
})

const 로스터 = (): SeasonTeamRoster => ({
  pitchers: [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => 투수(100 + slot, slot)),
  batters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((slot) => 타자(200 + slot, slot, slot % 9)),
})

const 나리투수: SeasonPlayer = { id: 0xfe, kindByte: PLAYER_OWN_BIT, fieldPosition: 0, stamina: 0 }
const 명예타자: SeasonPlayer = { id: 0xdc, kindByte: PLAYER_OWN_BIT | 0x20, fieldPosition: 5, stamina: 0 }

describe('선수 +0xa 의 구조 (S6 3절, 원본 Xls 4표로 확인)', () => {
  it('bit6:bit5 가 종류 코드다', () => {
    expect(playerKindOf(0x03)).toBe(PLAYER_KIND.일반투수)
    expect(playerKindOf(0x25)).toBe(PLAYER_KIND.일반타자)
    expect(playerKindOf(0x42)).toBe(PLAYER_KIND.마타자)
    expect(playerKindOf(0x61)).toBe(PLAYER_KIND.마투수)
  })

  it('하위 5비트가 팀 안 칸 번호다', () => {
    expect(slotOf(투수(0, 7))).toBe(7)
    expect(slotOf(타자(0, 11, 0))).toBe(11)
  })

  it('0xb6604 은 상위 3비트를 보존하고 번호만 갈아끼운다', () => {
    const 바뀐 = withSlot({ ...명예타자, kindByte: 0xa5 }, 3)
    expect(바뀐.kindByte).toBe(0xa3)
  })

  it('투수 판정 0xb6278 — 투수 ⟺ bit5 == bit6. 마타자는 정상적으로 타자다', () => {
    expect(isPitcherRecord(0x10, PLAYER_KIND.일반투수)).toBe(true)
    expect(isPitcherRecord(0x10, PLAYER_KIND.일반타자)).toBe(false)
    expect(isPitcherRecord(0xf0, PLAYER_KIND.마투수)).toBe(true)
    // ⚠️ J-3 의 "마타자 면제" 는 틀렸다 — 마타자 id 0xf5..0xf9 는 0xc7 보다 커서 타자가 된다
    expect(isPitcherRecord(0xf5, PLAYER_KIND.마타자)).toBe(false)
    // 명예의전당 투수 20명 = id 0xb4..0xc7
    expect(isPitcherRecord(0xb4, 0)).toBe(true)
    expect(isPitcherRecord(0xc7, 0)).toBe(true)
    expect(isPitcherRecord(0xc8, 0)).toBe(false)
  })
})

describe('⚠️ 영입은 교체가 아니라 끼워넣기다 — 아무도 빠지지 않는다 (S6 4절)', () => {
  it('투수를 넣으면 로스터가 한 칸 늘고 밀려난 선수는 맨 끝으로 간다', () => {
    const 앞 = 로스터().pitchers
    const 뒤 = insertPitcher(앞, 나리투수, 2)
    expect(뒤).toHaveLength(앞.length + 1)
    expect(뒤[2]).toBe(나리투수)
    expect(뒤[뒤.length - 1].id).toBe(앞[2].id)
    // 빠진 선수가 하나도 없다
    for (const player of 앞) expect(뒤.some((p) => p.id === player.id)).toBe(true)
  })

  it('타자도 마찬가지로 아무도 안 빠진다', () => {
    const 앞 = 로스터().batters
    const 뒤 = insertBatter(앞, 명예타자, 4)
    expect(뒤).toHaveLength(앞.length + 1)
    expect(뒤[4].id).toBe(명예타자.id)
    for (const player of 앞) expect(뒤.some((p) => p.id === player.id)).toBe(true)
  })

  it('정원 상한이 없다 — 몇 번을 영입해도 계속 늘어난다', () => {
    let roster = 로스터()
    for (let i = 0; i < 5; i += 1) {
      roster = recruitPlayer(roster, { ...나리투수, id: 0xf0 + i }, true, 0).roster
    }
    expect(roster.pitchers).toHaveLength(8 + 5)
  })

  it('타자는 밀려난 선수의 수비 위치를 새 선수가 받고, 밀려난 쪽은 0 이 된다', () => {
    const 앞 = 로스터().batters
    const 밀려날선수 = 앞[3]
    const 뒤 = insertBatter(앞, 명예타자, 3)
    expect(뒤[3].fieldPosition).toBe(밀려날선수.fieldPosition & 0xf)
    const 맨끝 = 뒤[뒤.length - 1]
    expect(맨끝.id).toBe(밀려날선수.id)
    expect(맨끝.fieldPosition).toBe(0)
    // 칸 번호는 마지막 자리로 다시 매겨진다
    expect(slotOf(맨끝)).toBe(뒤.length - 1)
  })

  it('⚠️ 투수 쪽만 뒷정리가 빠졌다 — 밀려난 투수의 칸 번호가 그대로라 새 투수와 겹친다', () => {
    const 앞 = 로스터().pitchers
    const 뒤 = insertPitcher(앞, withSlot(나리투수, 2), 2)
    expect(slotOf(뒤[2])).toBe(2)
    // 원본에 0xb6605 한 줄이 없어 맨 끝으로 밀린 선수도 여전히 2 다
    expect(slotOf(뒤[뒤.length - 1])).toBe(2)
  })
})

describe('영입 확정 0xc554', () => {
  it('투수는 스태미나가 10000 으로 채워진다', () => {
    const { roster } = recruitPlayer(로스터(), 나리투수, true, 1)
    expect(roster.pitchers[1].stamina).toBe(RECRUIT_PITCHER_STAMINA)
  })

  it('원본 레코드의 칸 번호가 실제로 바뀐다 (0xb6604 의 부작용, 원본 그대로)', () => {
    const { source } = recruitPlayer(로스터(), 나리투수, true, 5)
    expect(slotOf(source)).toBe(5)
    expect(source.kindByte & 0xe0).toBe(나리투수.kindByte & 0xe0)
  })

  it('비용도 인기도 조건도 없다 — 레코드를 건드리지 않는다', () => {
    const 결과 = recruitPlayer(로스터(), 명예타자, false, 0)
    expect(결과.roster.batters).toHaveLength(13)
  })
})

describe('영입 목록의 칸 배치 (R13 9절)', () => {
  it('0 나리 투수 · 1~4 명예 투수 · 5 나리 타자 · 6~ 명예 타자', () => {
    expect(recruitSourceOf(0)).toBe('나리투수')
    expect(recruitSourceOf(1)).toBe('명예투수')
    expect(recruitSourceOf(4)).toBe('명예투수')
    expect(recruitSourceOf(5)).toBe('나리타자')
    expect(recruitSourceOf(6)).toBe('명예타자')
  })

  it('쪽은 k > 4 로 가른다', () => {
    expect(recruitsPitcher(4)).toBe(true)
    expect(recruitsPitcher(5)).toBe(false)
  })
})

describe('중복 검사 — StrMODE[181] "이미 영입된 선수 입니다"', () => {
  it('나리 선수는 +0xa 의 bit7 로 찾는다 (한 쪽에 한 명)', () => {
    const roster = 로스터()
    expect(hasRecruitedCareerPlayer(roster.pitchers)).toBe(false)
    const 뒤 = recruitPlayer(roster, 나리투수, true, 0).roster
    expect(hasRecruitedCareerPlayer(뒤.pitchers)).toBe(true)
    expect(hasRecruitedCareerPlayer(뒤.batters)).toBe(false)
  })

  it('명예의전당 선수는 선수 번호로 찾는다', () => {
    const roster = 로스터()
    expect(hasRecruitedHallOfFamePlayer(roster.batters, 명예타자.id)).toBe(false)
    const 뒤 = recruitPlayer(roster, 명예타자, false, 2).roster
    expect(hasRecruitedHallOfFamePlayer(뒤.batters, 명예타자.id)).toBe(true)
  })
})

describe('명전 칸 삭제의 시즌 명단 정리 — 0x221dc · 0xb6348', () => {
  const 명전투수 = (slot: number): SeasonPlayer => ({ id: 0xb4, kindByte: PLAYER_KIND.일반투수 | slot, fieldPosition: 0, stamina: 10_000 })
  const 명전타자 = (slot: number, position: number): SeasonPlayer =>
    ({ id: 0xc9, kindByte: PLAYER_KIND.일반타자 | slot, fieldPosition: position, stamina: 0 })

  it('0xb6348 — 마선수 비트가 아니고 투수 id 0xb4..0xcc · 타자 id 0xc8..0xd0', () => {
    expect(isHallOfFameRecord(명전투수(0))).toBe(true)
    expect(isHallOfFameRecord({ ...명전투수(0), id: 0xb3 })).toBe(false)
    expect(isHallOfFameRecord(명전타자(0, 3))).toBe(true)
    expect(isHallOfFameRecord({ ...명전타자(0, 3), id: 0xd1 })).toBe(false)
    expect(isHallOfFameRecord({ ...명전타자(0, 3), kindByte: PLAYER_KIND.마타자 })).toBe(false)
  })

  it('타자: 맨 끝 선수가 지운 자리로 와서 그 수비 위치·칸 번호를 이어받고 명단이 한 칸 준다', () => {
    const roster: SeasonTeamRoster = { pitchers: [], batters: [타자(1, 0, 2), 명전타자(1, 6), 타자(3, 2, 7), 타자(4, 3, 0)] }

    const next = removeHallOfFamerFromRoster(roster, 0xc9, false)

    expect(next.batters.map((player) => player.id)).toEqual([1, 4, 3])
    expect(next.batters[1].fieldPosition).toBe(6)
    expect(slotOf(next.batters[1])).toBe(1)
  })

  it('투수: 맨 끝 선수가 옮겨 오고 칸 번호는 고치지 않는다 (원본 그대로)', () => {
    const roster: SeasonTeamRoster = { pitchers: [명전투수(0), 투수(2, 1), 투수(3, 2)], batters: [] }

    const next = removeHallOfFamerFromRoster(roster, 0xb4, true)

    expect(next.pitchers.map((player) => player.id)).toEqual([3, 2])
    expect(slotOf(next.pitchers[0])).toBe(2)
  })

  it('맨 끝이 그 선수면 그냥 빠지고, 없으면 같은 객체', () => {
    const roster: SeasonTeamRoster = { pitchers: [투수(2, 0), 명전투수(1)], batters: [] }
    expect(removeHallOfFamerFromRoster(roster, 0xb4, true).pitchers.map((player) => player.id)).toEqual([2])
    expect(removeHallOfFamerFromRoster(roster, 0xb5, true)).toBe(roster)
  })

  it('막기 — 내 팀에 있고 시즌모드 경기 진행 중일 때만 (0xb50ad && 전역기록 +0x4e)', () => {
    const roster: SeasonTeamRoster = { pitchers: [명전투수(0)], batters: [] }
    expect(isHallOfFameDeleteBlocked(roster, 0xb4, true, true)).toBe(true)
    expect(isHallOfFameDeleteBlocked(roster, 0xb4, true, false)).toBe(false)
    expect(isHallOfFameDeleteBlocked(roster, 0xb5, true, true)).toBe(false)
    expect(isHallOfFameDeleteBlocked(null, 0xb4, true, true)).toBe(false)
  })
})

describe('나만의리그 초기화의 시즌 명단 정리 — 0x223a8 · 0xb6388 · 막기 앞쪽 0xb5054', () => {
  const 나리타자 = (slot: number, position: number): SeasonPlayer =>
    ({ id: 0xfe, kindByte: PLAYER_OWN_BIT | PLAYER_KIND.일반타자 | slot, fieldPosition: position, stamina: 0 })

  it('타자편: 첫 나리 타자 자리로 맨 끝 선수가 와서 수비 위치·칸 번호를 이어받는다', () => {
    const roster: SeasonTeamRoster = { pitchers: [나리투수], batters: [타자(1, 0, 2), 나리타자(1, 6), 타자(3, 2, 7), 타자(4, 3, 0)] }

    const next = removeCareerPlayerFromRoster(roster, false)

    expect(next.batters.map((player) => player.id)).toEqual([1, 4, 3])
    expect(next.batters[1].fieldPosition).toBe(6)
    expect(slotOf(next.batters[1])).toBe(1)
    // 투수 쪽은 건드리지 않는다
    expect(next.pitchers).toBe(roster.pitchers)
  })

  it('투수편: 맨 끝 투수가 옮겨 오고 칸 번호는 고치지 않는다', () => {
    const roster: SeasonTeamRoster = { pitchers: [투수(2, 0), 나리투수, 투수(3, 2)], batters: [] }

    const next = removeCareerPlayerFromRoster(roster, true)

    expect(next.pitchers.map((player) => player.id)).toEqual([2, 3])
    expect(slotOf(next.pitchers[1])).toBe(2)
  })

  it('그 쪽에 나리 선수가 없으면 같은 객체', () => {
    const roster = 로스터()
    expect(removeCareerPlayerFromRoster(roster, true)).toBe(roster)
    expect(removeCareerPlayerFromRoster(roster, false)).toBe(roster)
  })

  it('0xb5054 — 타자편은 타자 쪽, 투수편은 투수 쪽만 본다. 시즌 저장이 없으면 거짓', () => {
    const roster: SeasonTeamRoster = { pitchers: [나리투수], batters: [타자(1, 0, 2)] }
    expect(hasCareerPlayerInSeasonTeam(roster, true)).toBe(true)
    expect(hasCareerPlayerInSeasonTeam(roster, false)).toBe(false)
    expect(hasCareerPlayerInSeasonTeam(null, true)).toBe(false)
  })
})

describe('나리 선수 기록 0x22168 · 0x220ec → 시즌 선수 (0x1762e · 0x10ff8)', () => {
  const 투수기록 = { name: '나리', ability: [1, 2, 3, 4] as const, repertoire: { name: '나리', form: 0, magicId: 0, pitchMask: 1 } }
  const 타자기록 = { name: '나리', ability: [5, 6, 7, 8] as const }

  it('id 0xfe · +0xa 투수 0x80 / 타자 0xa0 — 0xb6278 이 투수·타자로 가르고 0xb5054 에 걸린다', () => {
    const pitcher = nariRecruitPlayerOf(투수기록, true)
    const batter = nariRecruitPlayerOf(타자기록, false)
    expect(pitcher).toMatchObject({ id: 0xfe, kindByte: 0x80, record: 투수기록 })
    expect(batter).toMatchObject({ id: 0xfe, kindByte: 0xa0, record: 타자기록 })
    expect(isPitcherRecord(pitcher.id, pitcher.kindByte)).toBe(true)
    expect(isPitcherRecord(batter.id, batter.kindByte)).toBe(false)
    expect(isHallOfFameRecord(pitcher)).toBe(false)

    const roster = recruitPlayer(로스터(), pitcher, true, 2).roster
    expect(roster.pitchers[2]).toMatchObject({ id: 0xfe, kindByte: 0x82, stamina: RECRUIT_PITCHER_STAMINA, record: 투수기록 })
    expect(hasRecruitedCareerPlayer(roster.pitchers)).toBe(true)
    const batters = recruitPlayer(로스터(), batter, false, 4).roster.batters
    expect(batters[4]).toMatchObject({ id: 0xfe, kindByte: 0xa4, fieldPosition: 4, record: 타자기록 })
    expect(hasRecruitedCareerPlayer(batters)).toBe(true)
  })
})
