import { describe, expect, it } from 'vitest'
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
import { opponentOf } from '@/entities/league/model/league'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  ...overrides,
})

const 난수: RandomPort = {
  next: () => 0.5,
  nextInRange: (minimum, maximum) => (minimum + maximum) / 2,
  pick: (candidates) => candidates[0],
}

describe('경기 옵션 조립 — 커리어 → PitcherGameOptions', () => {
  it('팀·상대·측을 채운다 — 상대는 일정표(0xd89cb)가 정한다', () => {
    const career = 투수({ teamId: 3, gamesPlayed: 4 })
    const options = pitcherGameOptionsOf(career)

    expect(options.ourTeamId).toBe(3)
    expect(options.opponentTeamId).toBe(opponentOf(4, 3))
    expect(options.playerSide).toBe(DEFAULT_PLAYER_SIDE)
  })

  it('날짜 카운터 g 는 지금까지 치른 경기 수다 (시즌+0xb2, 0xb818c 가 +1)', () => {
    expect(pitcherGameOptionsOf(투수({ gamesPlayed: 7 })).dayCounter).toBe(7)
  })

  it('능력치는 실효값이고 스태미나 용량의 바탕은 체력 칸이다 (0xb6415(P, 3, 1))', () => {
    const career = 투수({ ability: { control: 300, velocity: 400, breaking: 200, stamina: 500 } })
    const options = pitcherGameOptionsOf(career)

    expect(options.stats).toEqual({ control: 300, velocity: 400, breaking: 200, stamina: 500 })
    expect(options.staminaAbility).toBe(500)
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
