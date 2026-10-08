import { describe, expect, it } from 'vitest'
import {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  PITCHER_TRAINING_MENUS,
  gamesUntilManagementOf,
  pitcherTrainingBlockReasonOf,
  pitchTypeTrainingLinesOf,
  runPitchTypeTraining,
  runPitcherTraining,
  seasonPitcherTrainingCountOf,
} from '@/entities/pitcher-career/model/pitcherManagement'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom, createFractionRandom } from '@/shared/api/random/fractionRandom'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
  // 얻은 스킬은 자리가 있으면 자동 장착된다(0xa4bd8) — 따로 안 주면 보유 = 장착으로 둔다
  equippedSkillIds: overrides.equippedSkillIds ?? overrides.skillIds ?? [],
})
const 메뉴 = (id: string) => PITCHER_TRAINING_MENUS.find((menu) => menu.id === id)!

function 고정난수(position: number): RandomPort {
  return createConstantRandom(position)
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

describe('능력 훈련 (0x17f5c → 0x186c4 · 0xa3bad, 모드 갈림은 디스어셈 확정)', () => {
  it('제구·구속·변화는 4~6, 체력만 5~7 오른다 (0x186f4 — 투수는 칸 3 만 bfa55(5,8))', () => {
    // 타입 1(사이드암)은 제구에만 보너스가 붙어 구속·변화·체력은 굴린 값 그대로다
    const before = 투수({ typeIndex: 1 })

    expect(runPitcherTraining(before, 메뉴('구속'), 최소).career.ability.velocity).toBe(before.ability.velocity + 4)
    expect(runPitcherTraining(before, 메뉴('구속'), 최대).career.ability.velocity).toBe(before.ability.velocity + 6)
    expect(runPitcherTraining(before, 메뉴('변화'), 최소).career.ability.breaking).toBe(before.ability.breaking + 4)
    expect(runPitcherTraining(before, 메뉴('변화'), 최대).career.ability.breaking).toBe(before.ability.breaking + 6)
    expect(runPitcherTraining(before, 메뉴('체력'), 최소).career.ability.stamina).toBe(before.ability.stamina + 5)
    expect(runPitcherTraining(before, 메뉴('체력'), 최대).career.ability.stamina).toBe(before.ability.stamina + 7)
  })

  it('사기 감소를 먼저, 상승을 다음에 굴린다 (0x186c4 → 0x18704)', () => {
    const 차례 = [0, 0.999]
    let index = 0
    const 순서난수: RandomPort = createFractionRandom(() => 차례[index++])
    const before = 투수({ typeIndex: 1 })
    const outcome = runPitcherTraining(before, 메뉴('구속'), 순서난수)

    // 첫 굴림(0) = 사기 5, 둘째 굴림(0.999) = 상승 6
    expect(outcome.rolledMoraleLoss).toBe(5)
    expect(outcome.rolledGain).toBe(6)
    expect(outcome.career.ability.velocity).toBe(before.ability.velocity + 6)
    expect(outcome.career.morale).toBe(50 - 5)
  })

  it('타입 보너스 +1 — 타입 0 구속 · 타입 1 제구 · 타입 2 변화 (0x18786~0x187a6)', () => {
    const 칸 = ['제구', '구속', '변화', '체력'] as const
    const 키 = ['control', 'velocity', 'breaking', 'stamina'] as const
    const 보너스 = (typeIndex: number) =>
      칸.map((id) => runPitcherTraining(투수({ typeIndex }), 메뉴(id), 최소).typeBonus)
    expect(보너스(0)).toEqual([0, 1, 0, 0])
    expect(보너스(1)).toEqual([1, 0, 0, 0])
    expect(보너스(2)).toEqual([0, 0, 1, 0])

    const before = 투수({ typeIndex: 2 })
    const outcome = runPitcherTraining(before, 메뉴('변화'), 최소)
    expect(outcome.career.ability[키[2]]).toBe(before.ability.breaking + 4 + 1)
    // 굴린 값(결과 창 변화량 칸)에는 보너스가 안 들어간다
    expect(outcome.rolledGain).toBe(4)
  })

  it('병아리(0)·몹쓸몸(3)은 **장착** 비트로 본다 — 가졌어도 장착이 아니면 보정이 없다 (0x17f5c → 0xa4bf8)', () => {
    const before = 투수()
    const 장착 = 투수({ skillIds: [0], equippedSkillIds: [0] })
    const 보유만 = 투수({ skillIds: [0], equippedSkillIds: [] })

    expect(runPitcherTraining(장착, 메뉴('제구'), 최소).career.ability.control).toBe(before.ability.control + 5)
    expect(runPitcherTraining(장착, 메뉴('제구'), 최소).moraleLoss).toBe(4)
    expect(runPitcherTraining(보유만, 메뉴('제구'), 최소).career.ability.control).toBe(before.ability.control + 4)
    expect(runPitcherTraining(보유만, 메뉴('제구'), 최소).moraleLoss).toBe(5)
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

describe('구질 훈련 (108 탭 2 → 0x17f5c 의 0x1836a 갈래)', () => {
  const 구질투수 = (overrides: Partial<PitcherCareer> = {}) =>
    투수({ gamePoint: 5000, pitchTrainingStages: [1, 1, 0, 0, 0, 0, 0, 0], ...overrides })

  it('사기는 bfa55(6,10) 만큼 — 병아리 −1 · 몹쓸몸 +2 를 더해 깎고, 행동함 · 훈련 칸 4 수를 남긴다 (0x18a5c · 0x18d70)', () => {
    const 최소결과 = runPitchTypeTraining(구질투수(), 0, 2, 최소)
    expect(최소결과.rolledMoraleLoss).toBe(6)
    expect(최소결과.career.morale).toBe(50 - 6)
    expect(최소결과.career.hasActedThisCycle).toBe(true)
    expect(최소결과.career.trainingCounts['마구']).toBe(1)
    expect(최소결과.career.gamePoint).toBe(5000 - 600)

    expect(runPitchTypeTraining(구질투수(), 0, 2, 최대).rolledMoraleLoss).toBe(9)
    const 몹쓸몸 = runPitchTypeTraining(구질투수({ skillIds: [3] }), 0, 2, 최소)
    expect(몹쓸몸.moraleLoss).toBe(8)
    expect(runPitchTypeTraining(구질투수({ skillIds: [0] }), 0, 2, 최소).moraleLoss).toBe(5)
  })

  it('알림 글 — 덜 찼으면 StrMODE[89] "%d/%d회", 차면 [88] "구질 훈련 완료!"', () => {
    const 한번 = runPitchTypeTraining(구질투수(), 0, 2, 최소)
    expect(pitchTypeTrainingLinesOf(한번)).toEqual(['해당 구질 1/4회 훈련', '사기 -6'])
    const 다른칸 = runPitchTypeTraining(구질투수({ pitchTrainingCounts: [1, 0, 0, 0, 0, 0, 0, 0] }), 2, 0, 최소)
    expect(pitchTypeTrainingLinesOf(다른칸)[0]).toBe('해당 구질 1/2회 훈련')
    const 마지막 = runPitchTypeTraining(구질투수({ pitchTrainingCounts: [3, 0, 0, 0, 0, 0, 0, 0] }), 0, 2, 최소)
    expect(pitchTypeTrainingLinesOf(마지막).slice(0, 1)).toEqual(['구질 훈련 완료!'])
  })
})

describe('관리 주기', () => {
  it('2경기마다 열린다 — 남은 경기 수를 센다', () => {
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 0 }))).toBe(0)
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 1 }))).toBe(1)
    expect(gamesUntilManagementOf(투수({ gamesPlayed: 2 }))).toBe(0)
  })
})

describe('서브 아이템 효과 (0x17f5c 모드 공용)', () => {
  it('서브 0~3 은 훈련 칸 k 로 `기록[0x58+k]` 를 본다 — 표적판 = 제구 +2 (0x187f6)', () => {
    const before = 투수({ typeIndex: 2, subItemIds: [0] })
    const outcome = runPitcherTraining(before, 메뉴('제구'), 최소)

    expect(outcome.career.ability.control).toBe(before.ability.control + 4 + 2)
    // 굴린 값에는 안 들어간다 (결과 창 [sp+0x34])
    expect(outcome.rolledGain).toBe(4)
    expect(runPitcherTraining(before, 메뉴('구속'), 최소).career.ability.velocity).toBe(before.ability.velocity + 4)
  })

  it('하드타이어(3)는 체력 훈련 +2', () => {
    const before = 투수({ typeIndex: 2, subItemIds: [3] })
    expect(runPitcherTraining(before, 메뉴('체력'), 최소).career.ability.stamina).toBe(before.ability.stamina + 5 + 2)
  })

  it('자동안마기(4)는 능력치·마구 훈련 모두 사기 감소 −1 (0x188cc · 0x18036)', () => {
    const 안마 = 투수({ subItemIds: [4], popularity: 200, gamePoint: 5000 })

    expect(runPitcherTraining(안마, 메뉴('제구'), 최소).moraleLoss).toBe(4)
    expect(runPitcherTraining(투수({ popularity: 200, gamePoint: 5000 }), 메뉴('마구'), 최소).moraleLoss).toBe(9)
    expect(runPitcherTraining(안마, 메뉴('마구'), 최소).moraleLoss).toBe(8)
  })
})
