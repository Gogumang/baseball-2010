import { describe, expect, it } from 'vitest'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import {
  pitcherGameOptionsOf,
  pitcherGameOutcomeOf,
  startsTodayFor,
  teamMoraleOf,
  todayAssignmentOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { DEFAULT_PLAYER_SIDE, startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { opponentOf, startPostseason } from '@/entities/league/model/league'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => {
  const base = createPitcherCareer('테스트')
  // 얻은 스킬은 자리가 있으면 자동 장착된다(0xa4bd8) — 따로 안 주면 보유 = 장착으로 둔다
  return { ...base, ...overrides, equippedSkillIds: overrides.equippedSkillIds ?? overrides.skillIds ?? base.equippedSkillIds }
}

const 난수: RandomPort = createConstantRandom(0.5)

describe('경기 옵션 조립 — 커리어 → PitcherGameOptions', () => {
  it('팀·상대·측을 채운다 — 상대는 일정표(0xd89cb)가 정한다', () => {
    const career = 투수({ teamId: 3, gamesPlayed: 4 })
    const options = pitcherGameOptionsOf(career)

    expect(options.ourTeamId).toBe(3)
    expect(options.opponentTeamId).toBe(opponentOf(4, 3))
    expect(options.playerSide).toBe(DEFAULT_PLAYER_SIDE)
  })

  it('정규시즌 측은 0xb7844 일정표 갈래 — 짝 중 번호가 큰 팀은 첫 9일 원정(선공)이다', () => {
    // 0일째 1 대 0 — 1 이 원정
    expect(pitcherGameOptionsOf(투수({ teamId: 1, gamesPlayed: 0 })).playerSide).toBe(PLAYER_SIDE_FIRST_BAT)
    expect(pitcherGameOptionsOf(투수({ teamId: 0, gamesPlayed: 0 })).playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    // 9일째부터는 뒤집혀 1 이 홈
    expect(pitcherGameOptionsOf(투수({ teamId: 1, gamesPlayed: 9 })).playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    // 직접 준 측이 이긴다
    expect(pitcherGameOptionsOf(투수({ teamId: 1 }), { playerSide: PLAYER_SIDE_LAST_BAT }).playerSide).toBe(PLAYER_SIDE_LAST_BAT)
  })

  it('날짜 카운터 g 는 지금까지 치른 경기 수다 (시즌+0xb2, 0xb818c 가 +1)', () => {
    expect(pitcherGameOptionsOf(투수({ gamesPlayed: 7 })).dayCounter).toBe(7)
  })

  it('포스트시즌 g 는 시리즈 안 경기 수, 측은 대진 시드 — 윗 시드 후공 · 아랫 시드 선공 (L+0x32 · 0xb7844)', () => {
    // 준PO 3위(2) 대 4위(3), 한 경기씩 나눠 가진 셋째 경기
    const series = { ...startPostseason([0, 1, 2, 3]), wins: [1, 1] as const }
    const 윗시드 = pitcherGameOptionsOf(투수({ teamId: 2, gamesPlayed: 47, postseason: series }))
    expect(윗시드.dayCounter).toBe(2)
    expect(윗시드.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    expect(윗시드.isPostseason).toBe(true)
    const 아랫시드 = pitcherGameOptionsOf(투수({ teamId: 3, gamesPlayed: 47, postseason: series }))
    expect(아랫시드.dayCounter).toBe(2)
    expect(아랫시드.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)
  })

  it('연차 idx 는 레코드 +0xb3 = 시즌 − 1 이다 (0xab214 내 투수 보너스 400 − 40×연차)', () => {
    expect(pitcherGameOptionsOf(투수({ season: 3 })).careerYearIndex).toBe(2)
  })

  it('능력치는 실효값이고 스태미나 용량의 바탕은 체력 칸이다 (0xb6415(P, 3, 1))', () => {
    const career = 투수({ ability: { control: 300, velocity: 400, breaking: 200, stamina: 500 } })
    const options = pitcherGameOptionsOf(career)

    expect(options.stats).toEqual({ control: 300, velocity: 400, breaking: 200, stamina: 500 })
    expect(options.staminaAbility).toBe(500)
  })

  it('stats 는 0xb570c 를 피로 앞까지 — 장착 스킬·부상이 붙고 999 로는 아직 자르지 않는다', () => {
    const career = 투수({
      ability: { control: 999, velocity: 400, breaking: 200, stamina: 500 },
      skillIds: [0, 8, 7, 22],
    })

    // 제구 999 → 7 +50 → 999 → 22 +99 = 1098. 끝 자르기는 피로 뒤 fatiguedStatsOf 가 한다
    expect(pitcherGameOptionsOf(career).stats).toEqual({ control: 1098, velocity: 450, breaking: 250, stamina: 550 })
  })

  it('staminaAbility 는 0xb6415(P, 3, 1) 이라 장착 스킬은 타고 부상·질병·사기는 안 탄다 (0x66e5c)', () => {
    const career = 투수({
      ability: { control: 300, velocity: 400, breaking: 200, stamina: 500 },
      skillIds: [0, 8, 7],
      isInjured: true,
      morale: 5,
    })
    const options = pitcherGameOptionsOf(career)

    expect(options.staminaAbility).toBe(550)
    // 경기 능력치 쪽은 부상 −60% → 사기 −50% : 550 → 220 → 110
    expect(options.stats.stamina).toBe(110)
  })

  /*
   * 예전에는 배운 수(magicLevel)를 그대로 레코드 +0x18 로 넘겼다. 원본은 123 창에서 **고른 번호**
   * (+0x18)만 경기에 싣고 배운 수는 고를 수 있는 번호의 상한일 뿐이라(H2 1-2) 고른 번호로 바꿨다.
   */
  it('마구는 123 창에서 고른 번호(+0x18)가 나가고 횟수는 표 0xd84ff 다 (1→4 · 2→5 · 3→6 · 4→7)', () => {
    expect(pitcherGameOptionsOf(투수()).magicCount).toBe(0)
    // 훈련만 하고 고르지 않았으면 마구가 나가지 않는다
    expect(pitcherGameOptionsOf(투수({ magicLevel: 2 })).repertoire.magicNumber).toBe(0)
    expect(pitcherGameOptionsOf(투수({ magicLevel: 2 })).magicCount).toBe(0)

    const 고름 = 투수({ magicLevel: 2, selectedMagicNumber: 2 })
    expect(pitcherGameOptionsOf(고름).repertoire.magicNumber).toBe(2)
    expect(pitcherGameOptionsOf(고름).magicCount).toBe(5)
    // 투수 스킬 23 혼신 +2
    expect(pitcherGameOptionsOf(투수({ magicLevel: 2, selectedMagicNumber: 2, skillIds: [23] })).magicCount).toBe(7)
  })

  it('투구 게이지는 넘기지 않으면 **꺼짐**이다 — 원본 기본값 (K 5-2)', () => {
    expect(pitcherGameOptionsOf(투수()).gaugeSettingOn).toBe(false)
    expect(pitcherGameOptionsOf(투수(), { gaugeSettingOn: true }).gaugeSettingOn).toBe(true)
  })

  it('스킬 18 비겁자 · 10 끈기 · 6 행운을 옵션 플래그로 옮긴다', () => {
    const options = pitcherGameOptionsOf(투수({ skillIds: [18, 10, 6] }))

    expect(options.pitcherIsCoward).toBe(true)
    expect(options.pitcherEndures).toBe(true)
    expect(options.hasLuckSkill).toBe(true)
  })

  it('경기 스킬은 **장착** 칸(+0x14)만 본다 — 가졌어도 장착이 아니면 꺼진다 (0xa5e14 · 0xaebe4 · 0x33cbc 는 0xb62b4, 0xa741c 는 0xa4bf8)', () => {
    const 보유만 = 투수({ skillIds: [18, 10, 6, 16, 17, 22, 23], equippedSkillIds: [], magicLevel: 2, selectedMagicNumber: 2 })
    const options = pitcherGameOptionsOf(보유만)

    expect(options.pitcherIsCoward).toBe(false)
    expect(options.pitcherEndures).toBe(false)
    expect(options.hasLuckSkill).toBe(false)
    expect(options.pitcherIsSteady).toBe(false)
    expect(options.pitcherIsTimid).toBe(false)
    expect(options.pitcherIsCool).toBe(false)
    // 혼신 23 의 +2 도 장착일 때만이다
    expect(options.magicCount).toBe(5)
    expect(pitcherGameOptionsOf({ ...보유만, equippedSkillIds: [23] }).magicCount).toBe(7)
  })

  it('팀 사기는 팀 레코드 s16 +2 — 전 팀 100 이다', () => {
    expect(teamMoraleOf(0)).toBe(100)
    expect(pitcherGameOptionsOf(투수()).teamMorale).toBe(100)
  })

  it('조립한 옵션으로 경기가 바로 시작된다', () => {
    const progress = startPitcherGame(pitcherGameOptionsOf(투수()), 난수)

    expect(progress.options.ourTeamId).toBe(0)
    expect(progress.stamina).toBe(투수().stamina)
  })
})

describe('오늘 등판', () => {
  it('선발은 날짜 카운터가 짝수인 날 등판한다 (0xa4f60 표)', () => {
    expect(startsTodayFor(투수({ gamesPlayed: 2 }))).toBe(true)
    expect(startsTodayFor(투수({ gamesPlayed: 3 }))).toBe(false)
    expect(todayAssignmentOf(투수({ gamesPlayed: 3 }))).toBe('대기')
  })

  it('구원은 선발로는 안 나가고 8회 교체로 올라온다', () => {
    const 구원 = 투수({ role: PITCHER_ROLE.relief, gamesPlayed: 2 })

    expect(startsTodayFor(구원)).toBe(false)
    expect(todayAssignmentOf(구원)).toBe('구원')
  })
})

describe('경기 결과 옮기기', () => {
  it('요약의 시즌 증분·스태미나를 그대로 넘기고 등판 여부는 투구 수로 가늠한다', () => {
    const options = pitcherGameOptionsOf(투수())
    const summary = {
      result: '승',
      seasonDelta: { outs: 3, runsAllowed: 0, strikeouts: 1, pitches: 12, wins: 1, losses: 0, saves: 0 },
      stamina: 8800,
      pitchCount: 12,
      record: { outsRecorded: 3 },
    } as unknown as Parameters<typeof pitcherGameOutcomeOf>[0]

    expect(pitcherGameOutcomeOf(summary, options)).toEqual({
      result: '승',
      ourTeamId: options.ourTeamId,
      opponentTeamId: options.opponentTeamId,
      seasonDelta: { outs: 3, runsAllowed: 0, strikeouts: 1, pitches: 12, wins: 1, losses: 0, saves: 0 },
      stamina: 8800,
      entered: true,
      gamePointReward: 0,
    })
  })
})
