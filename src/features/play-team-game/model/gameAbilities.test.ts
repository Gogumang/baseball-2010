import { describe, expect, it } from 'vitest'
import {
  ABILITY_LIMIT,
  BATTER_SLOT,
  COACH_BONUS,
  PITCHER_SLOT,
  TEAM_ABILITY_SLOT,
  coachBonusOf,
  gameAbilityOf,
  hasPositionMismatch,
  isTeamAbilityMode,
  moraleFlatPenaltyOf,
  positionMismatchPenaltyOf,
  teamAbilityBonusOf,
  teamAbilitySlotFor,
} from '@/features/play-team-game/model/gameAbilities'

describe('팀 능력치 → 선수 능력치 (0xb5a04)', () => {
  it('식은 (17·T − 5100)/100 이고 0 쪽으로 버린다', () => {
    // J-4 가 적어 둔 예시 그대로
    expect(teamAbilityBonusOf(330)).toBe(5)
    expect(teamAbilityBonusOf(400)).toBe(17)
    expect(teamAbilityBonusOf(500)).toBe(34)
    expect(teamAbilityBonusOf(600)).toBe(51)
    expect(teamAbilityBonusOf(666)).toBe(62)
  })

  it('T 가 300 보다 작으면 줄어들고, 나눗셈은 0 쪽으로 버린다', () => {
    // (17×290 − 5100)/100 = −1.7 → −1 (0 쪽 버림, 내림이 아니다)
    expect(teamAbilityBonusOf(290)).toBe(-1)
  })

  it('T 가 0 이면 아무것도 더하지 않는다', () => {
    expect(teamAbilityBonusOf(0)).toBe(0)
  })

  it('칸마다 밀어 주는 팀 능력치가 다르다 (0xb5942~0xb59fe)', () => {
    expect(teamAbilitySlotFor(true, PITCHER_SLOT.구속)).toBe(TEAM_ABILITY_SLOT.투구)
    expect(teamAbilitySlotFor(true, PITCHER_SLOT.변화)).toBe(TEAM_ABILITY_SLOT.투구)
    expect(teamAbilitySlotFor(true, PITCHER_SLOT.제구)).toBe(TEAM_ABILITY_SLOT.집중)
    expect(teamAbilitySlotFor(true, PITCHER_SLOT.체력)).toBe(TEAM_ABILITY_SLOT.근성)
    expect(teamAbilitySlotFor(false, BATTER_SLOT.히트)).toBe(TEAM_ABILITY_SLOT.타격)
    expect(teamAbilitySlotFor(false, BATTER_SLOT.파워)).toBe(TEAM_ABILITY_SLOT.타격)
    expect(teamAbilitySlotFor(false, BATTER_SLOT.수비)).toBe(TEAM_ABILITY_SLOT.집중)
    expect(teamAbilitySlotFor(false, BATTER_SLOT.주루)).toBe(TEAM_ABILITY_SLOT.근성)
  })

  it('팀 능력치가 붙는 모드는 비트마스크 0x306 = {1, 2, 8, 9} 다', () => {
    expect([1, 2, 8, 9].every(isTeamAbilityMode)).toBe(true)
    expect([0, 3, 4, 5, 6, 7, 10].some(isTeamAbilityMode)).toBe(false)
  })
})

describe('시즌 팀 상태 보정', () => {
  it('팀 사기는 **정액**으로 깎인다 — 나리의 비율 감소와 다르다 (0xb58ac)', () => {
    expect(moraleFlatPenaltyOf(100)).toBe(0)
    expect(moraleFlatPenaltyOf(51)).toBe(0)
    expect(moraleFlatPenaltyOf(50)).toBe(50)
    expect(moraleFlatPenaltyOf(31)).toBe(50)
    expect(moraleFlatPenaltyOf(30)).toBe(100)
    expect(moraleFlatPenaltyOf(11)).toBe(100)
    expect(moraleFlatPenaltyOf(10)).toBe(200)
    expect(moraleFlatPenaltyOf(0)).toBe(200)
  })

  it('팀 질병은 −30% 다', () => {
    const value = gameAbilityOf({
      mode: 2,
      base: 500,
      isPitcher: false,
      slot: BATTER_SLOT.히트,
      isMyTeam: true,
      season: { illness: 1, morale: 100, coach: -1 },
    })
    expect(value).toBe(500 - 150)
  })

  it('내 팀이 아니면 질병·사기 보정이 붙지 않는다 (0xb5804 의 팀 검사)', () => {
    const value = gameAbilityOf({
      mode: 2,
      base: 500,
      isPitcher: false,
      slot: BATTER_SLOT.히트,
      isMyTeam: false,
      season: { illness: 1, morale: 5, coach: -1 },
    })
    expect(value).toBe(500)
  })

  it('일반모드(1)에는 시즌 보정이 없다 — 보직 벌점도 시즌에만 있다', () => {
    const value = gameAbilityOf({
      mode: 1,
      base: 500,
      isPitcher: false,
      slot: BATTER_SLOT.수비,
      isMyTeam: true,
      season: { illness: 1, morale: 5, coach: 5 },
      assignment: { fieldPosition: 8, positionBar: 0 },
    })
    expect(value).toBe(500)
  })
})

describe('보직 불일치 −20% (0xb5844)', () => {
  it('내야 보직이 외야 자리에 서면 벌점을 받는다', () => {
    expect(hasPositionMismatch({ fieldPosition: 8, positionBar: 0 })).toBe(true)
    expect(positionMismatchPenaltyOf(500)).toBe(-100)
  })

  it('보직과 자리가 맞으면 면제다 (내야 2~6 · 외야 7~9)', () => {
    expect(hasPositionMismatch({ fieldPosition: 4, positionBar: 0 })).toBe(false)
    expect(hasPositionMismatch({ fieldPosition: 8, positionBar: 1 })).toBe(false)
  })

  it('자리 0·1·10 과 스킬 21, 마선수는 면제다', () => {
    expect(hasPositionMismatch({ fieldPosition: 0, positionBar: 1 })).toBe(false)
    expect(hasPositionMismatch({ fieldPosition: 1, positionBar: 1 })).toBe(false)
    expect(hasPositionMismatch({ fieldPosition: 10, positionBar: 1 })).toBe(false)
    expect(hasPositionMismatch({ fieldPosition: 8, positionBar: 0, hasAllPositionSkill: true })).toBe(false)
    expect(hasPositionMismatch({ fieldPosition: 8, positionBar: 0, isAce: true })).toBe(false)
  })

  it('수비 칸(2)에만 붙는다 — 히트 칸은 그대로다', () => {
    const 공통 = {
      mode: 2,
      base: 500,
      isPitcher: false,
      isMyTeam: true,
      season: { illness: 0, morale: 100, coach: -1 },
      assignment: { fieldPosition: 8, positionBar: 0 },
    } as const
    expect(gameAbilityOf({ ...공통, slot: BATTER_SLOT.수비 })).toBe(400)
    expect(gameAbilityOf({ ...공통, slot: BATTER_SLOT.히트 })).toBe(500)
  })
})

describe('코치 보너스 (0xb5a74, 모드 2)', () => {
  it('표는 [8, 9, 10, 6, 4, 8, 5, 10, 6, 7] 이다', () => {
    expect(COACH_BONUS).toEqual([8, 9, 10, 6, 4, 8, 5, 10, 6, 7])
  })

  it('코치 0~4 는 투수 칸, 5~9 는 타자 칸에만 붙는다', () => {
    expect(coachBonusOf(0, true, PITCHER_SLOT.변화)).toBe(8)
    expect(coachBonusOf(0, false, BATTER_SLOT.수비)).toBe(0)
    expect(coachBonusOf(4, true, PITCHER_SLOT.체력)).toBe(4)
    expect(coachBonusOf(6, false, BATTER_SLOT.수비)).toBe(5)
    expect(coachBonusOf(6, false, BATTER_SLOT.주루)).toBe(5)
    expect(coachBonusOf(9, false, BATTER_SLOT.파워)).toBe(7)
    expect(coachBonusOf(9, false, BATTER_SLOT.수비)).toBe(0)
  })

  it('⚠️ 팀 검사가 없어 **상대 팀 선수에게도** 붙는다 (원본 그대로, 유력)', () => {
    const 남의팀 = gameAbilityOf({
      mode: 2,
      base: 500,
      isPitcher: false,
      slot: BATTER_SLOT.히트,
      isMyTeam: false,
      season: { illness: 0, morale: 100, coach: 5 },
    })
    expect(남의팀).toBe(508)
  })
})

describe('경기용 능력치 전체 (0xb570c 의 시즌·팀 부분)', () => {
  it('질병 → 사기 → 팀 능력치 → 코치 차례로 먹인다', () => {
    // 500 → 질병 −150 = 350 → 사기 30 이면 −100 = 250 → 팀 타격 500 이면 +34 = 284 → 코치 5 이면 +8 = 292
    const value = gameAbilityOf({
      mode: 2,
      base: 500,
      isPitcher: false,
      slot: BATTER_SLOT.히트,
      isMyTeam: true,
      season: { illness: 2, morale: 30, coach: 5 },
      teamAbilities: [0, 500, 0, 0],
    })
    expect(value).toBe(292)
  })

  it('999 로 자른다 (0xb5b06)', () => {
    const value = gameAbilityOf({
      mode: 1,
      base: 990,
      isPitcher: true,
      slot: PITCHER_SLOT.구속,
      isMyTeam: false,
      teamAbilities: [666, 0, 0, 0],
    })
    expect(value).toBe(ABILITY_LIMIT)
  })
})
