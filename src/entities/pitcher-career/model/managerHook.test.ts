import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  EMPTY_MANAGER_HOOK_FLAGS,
  HOOK_PERCENT_TABLE,
  HOOK_USER_EVENT_BASE,
  applyHook,
  judgeManagerHook,
  managerToneOf,
} from '@/entities/pitcher-career/model/managerHook'

/** 0xbfa54 의 `rand(0,10000)` 이 늘 같은 값을 내도록 고정한다 */
const fixedRandom = (roll: number): RandomPort => ({
  next: () => roll / 10_000,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

const alwaysHits = fixedRandom(0)
const neverHits = fixedRandom(9_999)

const healthy = {
  mode: PITCHER_EDITION_MODE,
  role: PITCHER_ROLE.starter,
  staminaPercent: 100,
  reputation: 0,
  runsAllowedThisInning: 0,
  basesLoaded: false,
} as const

describe('표 0xcfa58', () => {
  it('평판이 높을수록 덜 내린다', () => {
    for (const row of HOOK_PERCENT_TABLE) {
      expect(row).toHaveLength(10)
      expect(row[0]).toBeGreaterThanOrEqual(row[9])
    }
  })

  it('평판 900 이상이면 만루·대량실점으로는 내리지 않는다', () => {
    expect(HOOK_PERCENT_TABLE[2][9]).toBe(0)
    expect(HOOK_PERCENT_TABLE[3][9]).toBe(0)
  })
})

describe('감독 말투 단계', () => {
  it('평판 ≤399 → 0 · 400~699 → 1 · ≥700 → 2', () => {
    expect([0, 399, 400, 699, 700, 999].map(managerToneOf)).toEqual([0, 0, 1, 1, 2, 2])
  })
})

describe('강판이 아예 없는 경우', () => {
  it('투수편이 아니면 판정하지 않는다', () => {
    const result = judgeManagerHook(
      { ...healthy, mode: 4, staminaPercent: 0 },
      EMPTY_MANAGER_HOOK_FLAGS,
      alwaysHits,
    )
    expect(result.hooked).toBe(false)
    expect(result.flags).toBe(EMPTY_MANAGER_HOOK_FLAGS)
  })

  it('구원은 감독 강판이 없다', () => {
    const result = judgeManagerHook(
      { ...healthy, role: PITCHER_ROLE.relief, staminaPercent: 0 },
      EMPTY_MANAGER_HOOK_FLAGS,
      alwaysHits,
    )
    expect(result.hooked).toBe(false)
  })
})

describe('체력 사유 (한 경기에 한 번씩만 굴린다)', () => {
  it('체력 0% · 평판 0 이면 표가 100% 라 반드시 내려간다', () => {
    const result = judgeManagerHook({ ...healthy, staminaPercent: 0 }, EMPTY_MANAGER_HOOK_FLAGS, neverHits)
    expect(result.hooked).toBe(true)
    expect(result.userEventIndex).toBe(HOOK_USER_EVENT_BASE.zeroStamina)
  })

  it('평판이 높으면 같은 조건에서도 살아남는다 (평판 900 → 10%)', () => {
    const result = judgeManagerHook(
      { ...healthy, staminaPercent: 0, reputation: 900 },
      EMPTY_MANAGER_HOOK_FLAGS,
      neverHits,
    )
    expect(result.hooked).toBe(false)
    expect(result.flags.rolledAtZeroStamina).toBe(true)
  })

  it('한 번 굴린 체력 0% 주사위는 다시 굴리지 않고 체력 ≤20% 쪽으로 넘어간다', () => {
    const first = judgeManagerHook(
      { ...healthy, staminaPercent: 0, reputation: 900 },
      EMPTY_MANAGER_HOOK_FLAGS,
      neverHits,
    )
    const second = judgeManagerHook({ ...healthy, staminaPercent: 0, reputation: 0 }, first.flags, alwaysHits)
    expect(second.hooked).toBe(true)
    expect(second.userEventIndex).toBe(HOOK_USER_EVENT_BASE.lowStamina)
    expect(second.flags).toEqual({ rolledAtZeroStamina: true, rolledAtLowStamina: true })
  })

  it('두 주사위를 다 굴린 뒤에는 체력만으로는 내려가지 않는다', () => {
    const flags = { rolledAtZeroStamina: true, rolledAtLowStamina: true }
    const result = judgeManagerHook({ ...healthy, staminaPercent: 0 }, flags, alwaysHits)
    expect(result.hooked).toBe(false)
  })

  it('체력 0% 주사위가 빗나가면 그 판정에서는 ≤20% 를 건너뛴다', () => {
    const result = judgeManagerHook({ ...healthy, staminaPercent: 0, reputation: 900 }, EMPTY_MANAGER_HOOK_FLAGS, neverHits)
    expect(result.flags.rolledAtLowStamina).toBe(false)
  })

  it('체력 ≤20% 는 평판 900 이면 표가 0% 라 절대 걸리지 않는다', () => {
    const result = judgeManagerHook(
      { ...healthy, staminaPercent: 20, reputation: 900 },
      EMPTY_MANAGER_HOOK_FLAGS,
      alwaysHits,
    )
    expect(result.hooked).toBe(false)
    expect(result.flags.rolledAtLowStamina).toBe(true)
  })
})

describe('이닝 사유 (조건이 설 때마다 다시 굴린다)', () => {
  it('한 이닝 4실점부터 걸린다', () => {
    expect(
      judgeManagerHook({ ...healthy, runsAllowedThisInning: 3 }, EMPTY_MANAGER_HOOK_FLAGS, alwaysHits).hooked,
    ).toBe(false)
    const result = judgeManagerHook(
      { ...healthy, runsAllowedThisInning: 4 },
      EMPTY_MANAGER_HOOK_FLAGS,
      alwaysHits,
    )
    expect(result.userEventIndex).toBe(HOOK_USER_EVENT_BASE.bigInning)
  })

  it('만루면 만루 사유가 선다', () => {
    const result = judgeManagerHook({ ...healthy, basesLoaded: true }, EMPTY_MANAGER_HOOK_FLAGS, alwaysHits)
    expect(result.userEventIndex).toBe(HOOK_USER_EVENT_BASE.basesLoaded)
  })

  it('플래그를 다 쓴 뒤에도 4실점·만루로는 계속 내려갈 수 있다', () => {
    const flags = { rolledAtZeroStamina: true, rolledAtLowStamina: true }
    const result = judgeManagerHook(
      { ...healthy, staminaPercent: 0, runsAllowedThisInning: 5 },
      flags,
      alwaysHits,
    )
    expect(result.hooked).toBe(true)
    expect(result.userEventIndex).toBe(HOOK_USER_EVENT_BASE.bigInning)
  })

  it('말투 단계가 글 번호에 더해진다', () => {
    const result = judgeManagerHook(
      { ...healthy, reputation: 700, basesLoaded: true },
      EMPTY_MANAGER_HOOK_FLAGS,
      alwaysHits,
    )
    // 평판 700 → 칸 7 → 만루 2%, 굴림 0 이라 걸린다
    expect(result.userEventIndex).toBe(HOOK_USER_EVENT_BASE.basesLoaded + 2)
  })
})

describe('강판 뒤 마운드 상태', () => {
  it('내 투수가 내려가고 남은 경기는 간이 엔진이 돈다', () => {
    expect(applyHook(PITCHER_EDITION_MODE)).toEqual({
      myPitcherOnMound: false,
      simpleEngineRunning: true,
      excludesMyPitcherFromReplacement: true,
    })
  })
})
