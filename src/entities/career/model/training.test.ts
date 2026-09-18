import { describe, expect, it } from 'vitest'
import { blockReasonOf, runTraining, SPECIAL_SWING_MAXIMUM_LEVEL } from '@/entities/career/model/training'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { RandomPort } from '@/shared/api/random/randomPort'

// 신인은 병아리(0)·의외성(8) 을 갖고 시작한다. 기본 규칙만 볼 때는 스킬을 비워 둔다
const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
  ...createCareer('테스트'),
  morale: 50,
  skillIds: [],
  ...overrides,
})
const 메뉴 = (id: string) => TRAINING_MENUS.find((menu) => menu.id === id)!

/** nextInRange 를 [최소, 최대) 안의 같은 위치로 고정한다 — 0 이면 최솟값, 0.999 면 최댓값 */
function 고정난수(position: number): RandomPort {
  return {
    next: () => position,
    nextInRange: (minimum, maximum) => minimum + position * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}
const 최소 = 고정난수(0)
const 최대 = 고정난수(0.999)

describe('능력치 훈련 — 0x17f5c (원본 규칙)', () => {
  it('타자편 메뉴는 히트·파워·수비·주루·필살타법 다섯 칸이다 (0x17f5c 선택 4 = 0xa3bac 종류 4)', () => {
    expect(TRAINING_MENUS.map((menu) => menu.id)).toEqual(['히트', '파워', '수비', '주루', '필살타법'])
  })

  it('히트·파워는 bfa55(4,7) = 4~6 오른다 — 원본 난수는 끝값을 뺀다', () => {
    const before = 선수({ battingTypeIndex: 1 })

    expect(runTraining(before, 메뉴('히트'), 최소).career.ability.hit).toBe(before.ability.hit + 4)
    expect(runTraining(before, 메뉴('히트'), 최대).career.ability.hit).toBe(before.ability.hit + 6)
  })

  it('수비·주루는 5~7 오른다 (0x18704)', () => {
    const before = 선수()

    expect(runTraining(before, 메뉴('수비'), 최소).career.ability.defense).toBe(before.ability.defense + 5)
    expect(runTraining(before, 메뉴('주루'), 최대).career.ability.run).toBe(before.ability.run + 7)
  })

  it('배팅 타입 0 은 히트, 1 은 파워 훈련에 타입 보너스 +1 (StrMODE[194])', () => {
    const 교타 = runTraining(선수({ battingTypeIndex: 0 }), 메뉴('히트'), 최소)
    const 장타 = runTraining(선수({ battingTypeIndex: 1 }), 메뉴('파워'), 최소)
    const 보너스없음 = runTraining(선수({ battingTypeIndex: 0 }), 메뉴('파워'), 최소)

    expect([교타.typeBonus, 장타.typeBonus, 보너스없음.typeBonus]).toEqual([1, 1, 0])
    expect(교타.gains.hit).toBe(5)
  })

  it('표적판이 있으면 히트 훈련 +2, 자동안마기가 있으면 사기 감소 −1', () => {
    const outcome = runTraining(선수({ battingTypeIndex: 1, subItemIds: [0, 4] }), 메뉴('히트'), 최소)

    expect(outcome.gains.hit).toBe(4 + 2)
    expect(outcome.moraleLoss).toBe(5 - 1)
  })

  it('병아리(0)는 상승 +1·사기 −1, 몹쓸몸(3)은 상승 −2·사기 +2 (StrMODE[201]·[202], 0x1891c·0x1898e)', () => {
    const 기본 = runTraining(선수({ battingTypeIndex: 1, skillIds: [] }), 메뉴('히트'), 최소)

    const 병아리 = runTraining(선수({ battingTypeIndex: 1, skillIds: [0] }), 메뉴('히트'), 최소)
    expect([병아리.gains.hit, 병아리.moraleLoss]).toEqual([5, 4])

    const 몹쓸몸 = runTraining(선수({ battingTypeIndex: 1, skillIds: [3] }), 메뉴('히트'), 최소)
    expect([몹쓸몸.gains.hit, 몹쓸몸.moraleLoss]).toEqual([2, 7])

    expect([기본.gains.hit, 기본.moraleLoss]).toEqual([4, 5])
  })

  it('사기는 5~7 떨어지고 G포인트는 들지 않는다', () => {
    const before = 선수({ morale: 50, gamePoint: 0 })

    const 적게 = runTraining(before, 메뉴('히트'), 최소).career
    const 많이 = runTraining(before, 메뉴('히트'), 최대).career

    expect([적게.morale, 많이.morale]).toEqual([45, 43])
    expect(적게.gamePoint).toBe(0)
  })

  it('사기가 0 이면 막고, 능력치가 타입 한계치 이상이면 막는다 (StrMODE[193][192], 0x12e40)', () => {
    expect(blockReasonOf(선수({ morale: 0 }), 메뉴('히트'))).toBe('사기부족')
    const 한계 = 선수({ battingTypeIndex: 1, ability: { hit: 800, power: 849, run: 10, defense: 750 } })
    expect(blockReasonOf(한계, 메뉴('히트'))).toBe('능력치최대')
    expect(blockReasonOf(한계, 메뉴('수비'))).toBe('능력치최대')
    expect(blockReasonOf(한계, 메뉴('파워'))).toBeNull()
  })

  it('한계 직전이면 한 번은 넘을 수 있다 — 실제 상승은 999 로만 자른다', () => {
    const 직전 = 선수({ battingTypeIndex: 1, ability: { hit: 799, power: 10, run: 10, defense: 10 } })

    expect(runTraining(직전, 메뉴('히트'), 최대).career.ability.hit).toBe(799 + 6)
  })

  it('실행할 수 없는 상태에서 부르면 예외를 던진다', () => {
    expect(() => runTraining(선수({ morale: 0 }), 메뉴('히트'), 최소)).toThrow('사기부족')
  })

  it('입력 커리어를 바꾸지 않는다', () => {
    const before = 선수()
    const hit = before.ability.hit

    runTraining(before, 메뉴('히트'), 최대)

    expect(before.ability.hit).toBe(hit)
  })
})

describe('필살타법 훈련 — 0xa3bac 종류 4', () => {
  const 필살 = () => 메뉴('필살타법')

  it('레벨 0 은 한 번에 500 G포인트를 쓰고 사기가 9~12 떨어지며 누적 1/4 회가 된다', () => {
    const outcome = runTraining(선수({ gamePoint: 600, skillIds: [] }), 필살(), 최소)

    expect(outcome.career.gamePoint).toBe(100)
    expect(outcome.moraleLoss).toBe(9)
    expect(outcome.specialSwing).toEqual({ sessions: 1, required: 4, isLevelUp: false })
  })

  it('필요 횟수(4/5/6/7)를 채우면 레벨이 오르고 누적이 0 으로 돌아간다', () => {
    const outcome = runTraining(선수({ gamePoint: 5000, specialSwingLevel: 1, specialSwingSessions: 4, skillIds: [] }), 필살(), 최대)

    expect(outcome.career.gamePoint).toBe(5000 - 700)
    expect(outcome.moraleLoss).toBe(12)
    expect(outcome.specialSwing).toEqual({ sessions: 5, required: 5, isLevelUp: true })
    expect([outcome.career.specialSwingLevel, outcome.career.specialSwingSessions]).toEqual([2, 0])
  })

  it('병아리(0)는 사기 감소 −1, 몹쓸몸(3)은 +2', () => {
    expect(runTraining(선수({ gamePoint: 999, skillIds: [0] }), 필살(), 최소).moraleLoss).toBe(8)
    expect(runTraining(선수({ gamePoint: 999, skillIds: [3] }), 필살(), 최소).moraleLoss).toBe(11)
  })

  it('G포인트가 모자라도 원본은 막지 않는다 — 0 에서 바닥을 친다 (0xa3c84)', () => {
    expect(blockReasonOf(선수({ gamePoint: 0 }), 필살())).toBeNull()
    expect(runTraining(선수({ gamePoint: 100, skillIds: [] }), 필살(), 최소).career.gamePoint).toBe(0)
  })

  it('최고 레벨이면 막는다 — 원본 가드는 못 찾았고 표를 넘어 읽는 것을 막으려는 것이다 (추정)', () => {
    expect(blockReasonOf(선수({ gamePoint: 9999, specialSwingLevel: SPECIAL_SWING_MAXIMUM_LEVEL }), 필살())).toBe('훈련완료')
  })

  it('능력치 훈련에는 필살타법 기록이 없다', () => {
    expect(runTraining(선수(), 메뉴('히트'), 최소).specialSwing).toBeNull()
  })
})

/**
 * 신인은 병아리(0)·의외성(8) 을 갖고 시작하므로 `createCareer` 를 그대로 쓰면 기본 규칙과 결과가 다르다.
 * 이 파일의 `선수()` 는 그래서 skillIds 를 비운다 — 새 테스트가 같은 함정에 빠지지 않도록 차이를 못박아 둔다.
 */
describe('createCareer 신인은 병아리를 갖고 있다 — 기본 규칙과 결과가 다르다', () => {
  const 신인 = (): PlayerCareer => ({ ...createCareer('신인'), morale: 50, battingTypeIndex: 1 })

  it('신인 그대로 훈련하면 기본보다 상승 +1·사기 감소 −1 이다', () => {
    const 기본 = runTraining(선수({ battingTypeIndex: 1 }), 메뉴('히트'), 최소)
    const 신인훈련 = runTraining(신인(), 메뉴('히트'), 최소)

    expect(신인().skillIds, '신인 시작 스킬이 바뀌면 이 파일의 선수() 기준도 다시 봐야 한다').toEqual([0, 8])
    expect(신인훈련.gains.hit).toBe((기본.gains.hit ?? 0) + 1)
    expect(신인훈련.moraleLoss).toBe(기본.moraleLoss - 1)
  })

  it('의외성(8)은 훈련 결과를 바꾸지 않는다 — 보정은 병아리(0)·몹쓸몸(3)뿐이다', () => {
    const 의외성만 = runTraining(선수({ battingTypeIndex: 1, skillIds: [8] }), 메뉴('히트'), 최소)
    const 스킬없음 = runTraining(선수({ battingTypeIndex: 1, skillIds: [] }), 메뉴('히트'), 최소)

    expect([의외성만.gains.hit, 의외성만.moraleLoss]).toEqual([스킬없음.gains.hit, 스킬없음.moraleLoss])
  })
})

describe('훈련 횟수 — 칭호 23·24 의 조건', () => {
  // 훈련은 행동권을 쓰므로, 이어서 훈련하려면 다음 관리 주기가 열려야 한다
  const 주기열기 = (career: PlayerCareer): PlayerCareer => ({ ...career, hasActedThisCycle: false, morale: 9999 })

  it('훈련할 때마다 메뉴별로 한 번씩 센다', () => {
    const 한번 = runTraining(선수(), 메뉴('히트'), 최소).career
    expect(한번.trainingCounts).toEqual({ 히트: 1 })

    const 두번 = runTraining(주기열기(한번), 메뉴('히트'), 최소).career
    const 다른메뉴 = runTraining(주기열기(두번), 메뉴('파워'), 최소).career
    expect(다른메뉴.trainingCounts).toEqual({ 히트: 2, 파워: 1 })
  })

  it('필살타법 훈련도 센다', () => {
    expect(runTraining(선수({ gamePoint: 999 }), 메뉴('필살타법'), 최소).career.trainingCounts).toEqual({
      필살타법: 1,
    })
  })

  it('훈련을 100번 하면 칭호 조건인 합계 100 에 닿는다 — 읽기만 하고 쓰지 않던 버그를 막는다', () => {
    let career = 선수({ morale: 9999 })
    for (let count = 0; count < 100; count += 1) {
      career = 주기열기(runTraining(career, 메뉴('히트'), 최소).career)
    }
    const total = Object.values(career.trainingCounts).reduce((sum, count) => sum + count, 0)

    expect(total, `trainingCounts was: ${JSON.stringify(career.trainingCounts)}`).toBe(100)
  })
})
