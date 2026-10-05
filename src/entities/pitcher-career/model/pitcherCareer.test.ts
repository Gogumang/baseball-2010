import { describe, expect, it } from 'vitest'
import {
  GAMES_PER_SEASON,
  applyPitcherGameResult,
  createPitcherCareer,
  effectivePitcherAbilityOf,
  equippedPitcherAbilityOf,
  isPitcherManagementCycleOpen,
  pitcherAbilityLimitsOf,
  pitcherFormOfCareer,
  pitcherSkillTableIdOf,
  seasonEarnedRunAverageOf,
  setPitcherSkillEquipped,
  startNextPitcherSeason,
  unclampedGamePitcherAbilityOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherGameOutcome } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  ...overrides,
})

const 경기결과 = (overrides: Partial<PitcherGameOutcome> = {}): PitcherGameOutcome => ({
  result: '승',
  ourTeamId: 0,
  opponentTeamId: 1,
  seasonDelta: { outs: 21, runsAllowed: 2, strikeouts: 5, pitches: 90, wins: 1, losses: 0, saves: 0 },
  stamina: 3000,
  entered: true,
  gamePointReward: 0,
  ...overrides,
})

describe('투수 커리어 레코드 — 타자편과 같은 칸·다른 칸', () => {
  it('능력치는 제구·구속·변화·체력 네 칸이고 신인은 표 0xcc3f2 값으로 시작한다', () => {
    expect(투수().ability).toEqual({ control: 100, velocity: 130, breaking: 100, stamina: 200 })
  })

  it('스태미나 +0x2c 는 10000 에서 시작한다 (시즌 시작 0xb6cc4)', () => {
    expect(투수().stamina).toBe(FULL_STAMINA)
  })

  it('등록 셋업이 rec[+0xa] 에 0x80 을 써 포지션 코드가 0 이다 — 평가가 선발형으로 본다', () => {
    expect(투수().positionCode).toBe(0)
  })

  it('능력 한계는 배팅 타입이 아니라 **보직**으로 고른다 (0xa44f4)', () => {
    expect(pitcherAbilityLimitsOf(투수({ role: PITCHER_ROLE.starter })).stamina).toBe(800)
    expect(pitcherAbilityLimitsOf(투수({ role: PITCHER_ROLE.relief })).stamina).toBe(600)
  })

  it('폼은 2 × 타입 + 손 이다', () => {
    expect(pitcherFormOfCareer(투수({ typeIndex: 2, handIndex: 1 }))).toBe(5)
  })

  it('등록에서 고른 변화구 두 개가 단계 1 로 적힌다 (커리어+0x208)', () => {
    const career = createPitcherCareer('테스트', {
      ...DEFAULT_PITCHER_ROOKIE_PROFILE,
      breakingPitchSlots: [2, 5],
    })

    expect(career.pitchTrainingStages).toEqual([0, 0, 1, 0, 0, 1, 0, 0])
  })
})

describe('실효 능력치 — 0xb6414 → 0xb570c (G-1 차례)', () => {
  it('장착 레벨 보너스가 먼저 붙는다', () => {
    const career =투수({ equipmentLevels: { control: 1, velocity: 0, breaking: 0, stamina: 0 } })

    expect(equippedPitcherAbilityOf(career).control).toBeGreaterThan(career.ability.control)
  })

  it('질병 −30% → 부상 −60% → 사기 감소 차례로 깎는다 (0xb5784 · 0xb57b4)', () => {
    const career = 투수({ ability: { control: 100, velocity: 100, breaking: 100, stamina: 100 }, isInjured: true })

    // 부상: 100 + trunc(−60×100/100) = 40
    expect(effectivePitcherAbilityOf(career).control).toBe(40)
    // 질병 먼저(70), 부상 다음(70 − trunc(70×60/100) = 28)
    expect(effectivePitcherAbilityOf({ ...career, isSick: true }).control).toBe(28)
  })

  it('질병 −30% 에 사기 감소가 이어 붙는다', () => {
    const career =투수({ ability: { control: 100, velocity: 100, breaking: 100, stamina: 100 }, isSick: true })

    // 100 − trunc(100×30/100) = 70
    expect(effectivePitcherAbilityOf(career).control).toBe(70)
    // 사기 10 이하면 −50% 가 더 붙는다: 70 − 35 = 35
    expect(effectivePitcherAbilityOf({ ...career, morale: 5 }).control).toBe(35)
  })
})

describe('실효 능력치 스킬 보정 — 0xb6414 (장착 비트 0xb62b4)', () => {
  const 능력 = { control: 500, velocity: 400, breaking: 300, stamina: 200 }
  const 장착 = (...ids: number[]) => 투수({ ability: 능력, skillIds: [0, 8, ...ids], equippedSkillIds: [0, 8, ...ids] })

  it('5 는 네 칸 모두 −100, 0 아래면 0 (0xb64b0)', () => {
    expect(equippedPitcherAbilityOf(장착(5))).toEqual({ control: 400, velocity: 300, breaking: 200, stamina: 100 })
    expect(equippedPitcherAbilityOf({ ...장착(5), ability: { ...능력, stamina: 60 } }).stamina).toBe(0)
  })

  it('7 은 네 칸 모두 +50, 999 로 자른다 (0xb64ca)', () => {
    expect(equippedPitcherAbilityOf(장착(7))).toEqual({ control: 550, velocity: 450, breaking: 350, stamina: 250 })
    expect(equippedPitcherAbilityOf({ ...장착(7), ability: { ...능력, velocity: 980 } }).velocity).toBe(999)
  })

  it('22 냉정은 제구(칸 0)만 +trunc(v/10) 이고 999 로 자르지 않는다 (0xb64e6~0xb6510)', () => {
    expect(equippedPitcherAbilityOf(장착(22))).toEqual({ control: 550, velocity: 400, breaking: 300, stamina: 200 })
    expect(equippedPitcherAbilityOf({ ...장착(22), ability: { ...능력, control: 507 } }).control).toBe(557)
    expect(equippedPitcherAbilityOf({ ...장착(22), ability: { ...능력, control: 999 } }).control).toBe(1098)
  })

  it('타자 스킬 20(수비 −100)은 투수 레코드(0xb6278 참)에 붙지 않는다', () => {
    expect(equippedPitcherAbilityOf(장착(20))).toEqual(능력)
  })

  it('차례는 장비(999 자름) → 5 → 7 → 22 다', () => {
    const career = { ...장착(5, 7, 22), ability: { ...능력, control: 980 }, equipmentLevels: { control: 1, velocity: 0, breaking: 0, stamina: 0 } }

    // 980 + 30 → 999 → 899 → 949 → 949 + 94 = 1043
    expect(equippedPitcherAbilityOf(career).control).toBe(1043)
  })

  it('보유만 하고 장착하지 않으면 보정이 없다', () => {
    const career = 투수({ ability: 능력, skillIds: [0, 8, 5, 7, 22], equippedSkillIds: [0, 8] })

    expect(equippedPitcherAbilityOf(career)).toEqual(능력)
    expect(effectivePitcherAbilityOf(career)).toEqual(능력)
  })

  it('0xb570c 는 맨 끝에서만 0..999 로 자른다 — 999 를 넘은 제구에 질병이 먼저 붙는다', () => {
    const career = { ...장착(22), ability: { ...능력, control: 999 }, isSick: true }

    // 1098 − trunc(1098×30/100) = 769 (먼저 999 로 잘랐다면 700)
    expect(unclampedGamePitcherAbilityOf(career).control).toBe(769)
    expect(effectivePitcherAbilityOf(career).control).toBe(769)
    expect(unclampedGamePitcherAbilityOf({ ...career, isSick: false }).control).toBe(1098)
    expect(effectivePitcherAbilityOf({ ...career, isSick: false }).control).toBe(999)
  })
})

describe('경기 뒤 반영', () => {
  it('시즌 성적에 아웃·실점·탈삼진·투구 수·승패가 쌓인다 (레코드 +0x20~+0x2f)', () => {
    const after = applyPitcherGameResult(투수(), 경기결과())

    expect(after.stats).toEqual({
      games: 1,
      outs: 21,
      runsAllowed: 2,
      saves: 0,
      strikeouts: 5,
      pitches: 90,
      wins: 1,
      losses: 0,
    })
    expect(after.careerStats.outs).toBe(21)
  })

  it('등판하지 않은 경기는 등판 수를 세지 않는다', () => {
    const 미등판 = 경기결과({
      entered: false,
      seasonDelta: { outs: 0, runsAllowed: 0, strikeouts: 0, pitches: 0, wins: 0, losses: 0, saves: 0 },
    })

    expect(applyPitcherGameResult(투수(), 미등판).stats.games).toBe(0)
  })

  it('하루가 끝나면 스태미나가 회복된다 — 선발 40% · 구원 80% (0x66ed0)', () => {
    expect(applyPitcherGameResult(투수({ role: PITCHER_ROLE.starter }), 경기결과()).stamina).toBe(3000 + 4000)
    // 구원은 8000 이 붙지만 10000 에서 잘린다
    expect(applyPitcherGameResult(투수({ role: PITCHER_ROLE.relief }), 경기결과()).stamina).toBe(FULL_STAMINA)
  })

  it('⚠️ 관리 주기 행동 플래그는 **경기마다** 풀린다 (0x4f158, 원본 기준 그대로)', () => {
    const acted = 투수({ hasActedThisCycle: true })

    expect(applyPitcherGameResult(acted, 경기결과()).hasActedThisCycle).toBe(false)
  })

  it('관리 화면은 2경기마다 열린다', () => {
    expect(isPitcherManagementCycleOpen(투수({ gamesPlayed: 1 }))).toBe(false)
    expect(isPitcherManagementCycleOpen(투수({ gamesPlayed: 2 }))).toBe(true)
  })
})

describe('시즌 넘기기 · 방어율', () => {
  it('새 시즌은 스태미나를 10000 으로 되돌린다 (0xb6cc4) — 타자편에 없는 한 줄이다', () => {
    const next = startNextPitcherSeason(투수({ stamina: 1200, gamesPlayed: GAMES_PER_SEASON }))

    expect(next.stamina).toBe(FULL_STAMINA)
    expect(next.gamesPlayed).toBe(0)
    expect(next.season).toBe(2)
  })

  it('방어율 = min(9999, trunc(실점 × 2700 / 아웃)) (0xb6ce8)', () => {
    expect(seasonEarnedRunAverageOf({ ...투수().stats, outs: 27, runsAllowed: 3 })).toBe(300)
    expect(seasonEarnedRunAverageOf({ ...투수().stats, outs: 0, runsAllowed: 1 })).toBe(9999)
    expect(seasonEarnedRunAverageOf(투수().stats)).toBe(0)
  })
})

describe('스킬 장착 칸 (선수기록 +0x14) — 모드 3 도 장착 동작 0xa4b04 를 탄다', () => {
  it('신인 스킬 0·8 은 얻는 자리(0x11230 → 0xa4bd9)에서 자동 장착되고 슬롯 단계는 0 이다', () => {
    const career = createPitcherCareer('테스트')

    expect(career.equippedSkillIds).toEqual(career.skillIds)
    expect(career.skillSlotLevel).toBe(0)
  })

  it('플러스 스킬은 상한 [6,8,10][+0x1c6] 에서 못 끼고, 마이너스(18 비겁자)는 상한을 안 본다', () => {
    const plus = [0, 1, 6, 7, 8, 9]
    const full = 투수({ skillIds: [...plus, 10, 18], equippedSkillIds: plus })

    expect(setPitcherSkillEquipped(full, 10, true).equippedSkillIds).toEqual(plus)
    expect(setPitcherSkillEquipped(full, 18, true).equippedSkillIds).toEqual([...plus, 18])
    expect(setPitcherSkillEquipped({ ...full, skillSlotLevel: 1 }, 10, true).equippedSkillIds).toEqual([...plus, 10])
    // 해제는 장착만 끈다 — 보유는 그대로다 (0xb66dc)
    const off = setPitcherSkillEquipped(full, 6, false)
    expect(off.equippedSkillIds).toEqual([0, 1, 7, 8, 9])
    expect(off.skillIds).toEqual(full.skillIds)
  })

  it('이름 칸은 0x8457c 대로 비트 ≤ 7 은 그대로, 8 부터는 표 번호 비트+16 이다 (모드 3)', () => {
    expect(pitcherSkillTableIdOf(6)).toBe(6)
    expect(pitcherSkillTableIdOf(8)).toBe(24)
    expect(pitcherSkillTableIdOf(18)).toBe(34)
    expect(pitcherSkillTableIdOf(23)).toBe(39)
  })
})
