import { describe, expect, it } from 'vitest'
import {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  PITCHER_TRAINING_MENUS,
  gamesUntilManagementOf,
  pitcherTrainingBlockReasonOf,
  runPitcherTraining,
  seasonPitcherTrainingCountOf,
} from '@/entities/pitcher-career/model/pitcherManagement'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
})
const 메뉴 = (id: string) => PITCHER_TRAINING_MENUS.find((menu) => menu.id === id)!

function 고정난수(position: number): RandomPort {
  return {
    next: () => position,
    nextInRange: (minimum, maximum) => minimum + position * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}
const 최소 = 고정난수(0)
const 최대 = 고정난수(0.999)

describe('투수 훈련 메뉴 — 타자편과 다른 점', () => {
  it('칸 0~3 이 제구·구속·변화·체력이고 칸 4 는 마구다 (StrMODE[40~43] · 상태 0x78)', () => {
    expect(PITCHER_TRAINING_MENUS.map((menu) => menu.id)).toEqual(['제구', '구속', '변화', '체력', '마구'])
  })

  it('능력 한계는 보직으로 고른다 — 구원의 체력은 600 에서 막힌다 (0xa44f4)', () => {
    const 구원 = 투수({
      role: PITCHER_ROLE.relief,
      ability: { control: 100, velocity: 100, breaking: 100, stamina: 600 },
    })

    expect(pitcherTrainingBlockReasonOf(구원, 메뉴('체력'))).toBe('능력치최대')
    expect(pitcherTrainingBlockReasonOf({ ...구원, role: PITCHER_ROLE.starter }, 메뉴('체력'))).toBeNull()
  })

  it('사기 0 과 이미 한 행동은 타자편과 같은 이유로 막는다', () => {
    expect(pitcherTrainingBlockReasonOf(투수({ morale: 0 }), 메뉴('제구'))).toBe('사기부족')
    expect(pitcherTrainingBlockReasonOf(투수({ hasActedThisCycle: true }), 메뉴('제구'))).toBe('이미행동함')
  })
})

describe('능력 훈련 (0x17f5c → 0xa3bac 종류 0~3, 칸 번호로만 갈린다 — 추정)', () => {
  it('제구·구속은 4~6, 변화·체력은 5~7 오른다', () => {
    const before = 투수()

    expect(runPitcherTraining(before, 메뉴('제구'), 최소).career.ability.control).toBe(before.ability.control + 4)
    expect(runPitcherTraining(before, 메뉴('제구'), 최대).career.ability.control).toBe(before.ability.control + 6)
    expect(runPitcherTraining(before, 메뉴('체력'), 최소).career.ability.stamina).toBe(before.ability.stamina + 5)
    expect(runPitcherTraining(before, 메뉴('체력'), 최대).career.ability.stamina).toBe(before.ability.stamina + 7)
  })

  it('훈련하면 사기가 떨어지고 이번 주기의 행동을 쓴다', () => {
    const after = runPitcherTraining(투수(), 메뉴('구속'), 최소).career

    expect(after.morale).toBe(50 - 5)
    expect(after.hasActedThisCycle).toBe(true)
  })

  it('훈련 횟수는 칸별로 세고 다른 칸을 하면 연속 수가 0 이 된다 (0x18a80)', () => {
    const 한번 = runPitcherTraining(투수(), 메뉴('제구'), 최소).career
    const 두번 = runPitcherTraining({ ...한번, hasActedThisCycle: false }, 메뉴('구속'), 최소).career

    expect(두번.trainingCounts).toEqual({ 제구: 1, 구속: 1 })
    expect(두번.consecutiveTrainingCounts).toEqual({ 구속: 1 })
    expect(seasonPitcherTrainingCountOf(두번, '제구')).toBe(1)
  })
})

describe('마구 훈련 (필살 창 0x17828 의 투수 탭)', () => {
  it('인기도가 모자라면 막힌다 — 레벨별 100 · 500 · 1000 · 1500 (표 0xcc3ea)', () => {
    expect(MAGIC_REQUIRED_POPULARITY).toEqual([100, 500, 1000, 1500])
    expect(pitcherTrainingBlockReasonOf(투수({ popularity: 50 }), 메뉴('마구'))).toBe('인기도부족')
  })

  it('4번 훈련하면 레벨이 1 오르고 G포인트 500 이 든다 (0xd7e92 · 0xd80e1)', () => {
    let career = 투수({ popularity: 200, gamePoint: 5000 })
    for (let round = 0; round < 4; round += 1) {
      career = runPitcherTraining({ ...career, hasActedThisCycle: false }, 메뉴('마구'), 최소).career
    }

    expect(career.magicLevel).toBe(1)
    expect(career.magicSessions).toBe(0)
    expect(career.gamePoint).toBe(5000 - 500 * 4)
  })

  it('최고 레벨이면 창이 모든 칸을 막는다 (StrMODE[63])', () => {
    const career = 투수({ popularity: 5000, magicLevel: MAGIC_MAXIMUM_LEVEL })

    expect(pitcherTrainingBlockReasonOf(career, 메뉴('마구'))).toBe('훈련완료')
  })
})

describe('관리 주기', () => {
  it('2경기마다 열린다 — 남은 경기 수를 센다', () => {
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 0 }))).toBe(0)
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 1 }))).toBe(1)
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 2 }))).toBe(0)
  })
})
