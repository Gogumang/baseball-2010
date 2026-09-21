import { describe, expect, it } from 'vitest'
import {
  chooseReplacementPitcher,
  closerRollIndexOf,
  CLOSER_ROLL_PERCENTS,
  EMPTY_MOUND_COUNTERS,
  judgePitcherChange,
  replacementPitcherSlotOf,
  rollsCloser,
} from '@/entities/pitching/model/pitcherChange'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

const 기본 = {
  ...EMPTY_MOUND_COUNTERS,
  role: PITCHER_ROLE.starter,
  stamina: FULL_STAMINA,
  benchCount: 7,
  lead: 0,
  inningIndex: 0,
  runnerCount: 0,
}

describe('CPU 투수 교체 판정 0xac428', () => {
  it('벤치가 최소치 이하면 안 바꾼다', () => {
    expect(judgePitcherChange({ ...기본, benchCount: 1, stamina: 0 }).replace).toBe(false)
  })

  it('교체 직후 한 투구 동안은 다시 안 바꾼다 (state[0xd])', () => {
    expect(judgePitcherChange({ ...기본, stamina: 0, justChanged: true }).replace).toBe(false)
  })

  it('선발·중간은 이닝 3실점 또는 체력 ≤19% 면 언제든 내린다', () => {
    expect(judgePitcherChange({ ...기본, inningRunsAllowed: 3 }).replace).toBe(true)
    expect(judgePitcherChange({ ...기본, inningRunsAllowed: 2 }).replace).toBe(false)
    expect(judgePitcherChange({ ...기본, stamina: 1900 }).replace).toBe(true)
    expect(judgePitcherChange({ ...기본, stamina: 2000 }).replace).toBe(false)
  })

  it('이닝 구간은 0-기준이다 — 1~4회는 투수 5실점, 5회는 5실점 + 체력 ≤49%', () => {
    // 0-기준 0~3 = 1~4회
    expect(judgePitcherChange({ ...기본, inningIndex: 3, runsAllowed: 5 }).replace).toBe(true)
    expect(judgePitcherChange({ ...기본, inningIndex: 3, runsAllowed: 4 }).replace).toBe(false)
    // 0-기준 4 = 5회
    expect(
      judgePitcherChange({ ...기본, inningIndex: 4, runsAllowed: 5, stamina: 4900 }).replace,
    ).toBe(true)
    expect(
      judgePitcherChange({ ...기본, inningIndex: 4, runsAllowed: 5, stamina: 5000 }).replace,
    ).toBe(false)
  })

  it('7회(0-기준 6)는 3실점 + 체력 ≤29%, 6회·8회 이상은 이닝 2실점', () => {
    expect(
      judgePitcherChange({ ...기본, inningIndex: 6, runsAllowed: 3, stamina: 2900 }).replace,
    ).toBe(true)
    // 0-기준 5 = 6회, 0-기준 7 = 8회 — 둘 다 A>1
    expect(judgePitcherChange({ ...기본, inningIndex: 5, inningRunsAllowed: 2 }).replace).toBe(true)
    expect(judgePitcherChange({ ...기본, inningIndex: 7, inningRunsAllowed: 2 }).replace).toBe(true)
    expect(judgePitcherChange({ ...기본, inningIndex: 7, inningRunsAllowed: 1 }).replace).toBe(false)
  })

  it('9회 이후 0<리드≤5 이고 (리드≤3 또는 리드≤주자수+2) 면 마무리 상황이다', () => {
    const 상황 = (lead: number, runnerCount: number) =>
      judgePitcherChange({ ...기본, inningIndex: 8, inningRunsAllowed: 2, lead, runnerCount })
        .saveSituation
    expect(상황(3, 0)).toBe(true)
    expect(상황(5, 3)).toBe(true)
    expect(상황(5, 0)).toBe(false)
    expect(상황(6, 3)).toBe(false)
    expect(상황(0, 0)).toBe(false)
  })

  it('마무리(역할 2)는 이닝 실점이 있고 2점 이상 뒤질 때만 내린다', () => {
    const 마무리 = { ...기본, role: PITCHER_ROLE.relief, inningRunsAllowed: 1 }
    expect(judgePitcherChange({ ...마무리, lead: -2 }).replace).toBe(true)
    expect(judgePitcherChange({ ...마무리, lead: -1 }).replace).toBe(false)
    expect(judgePitcherChange({ ...마무리, inningRunsAllowed: 0, lead: -5 }).replace).toBe(false)
  })

  it('특수 투수는 이닝 3실점·투수 4실점·체력 ≤39% 중 하나면 내린다', () => {
    const 특수 = { ...기본, isSpecialPitcher: true }
    expect(judgePitcherChange({ ...특수, inningRunsAllowed: 3 }).replace).toBe(true)
    expect(judgePitcherChange({ ...특수, runsAllowed: 4 }).replace).toBe(true)
    expect(judgePitcherChange({ ...특수, stamina: 3900 }).replace).toBe(true)
    expect(judgePitcherChange(특수).replace).toBe(false)
  })
})

describe('마무리 투입 굴림 0xac360', () => {
  it('확률 표는 d_level.dat[0x36..0x3b] = 45·35·50·60·60·30 이다', () => {
    expect(CLOSER_ROLL_PERCENTS).toEqual([45, 35, 50, 60, 60, 30])
  })

  it('칸은 9회 → 1 · 8회 → 2 · 지는 중 → 3 · 주자 2명 이상 → 4 · 1점 차 리드 → 5 · 그 밖 0', () => {
    expect(closerRollIndexOf({ inningIndex: 8, lead: 0, runnerCount: 0 })).toBe(1)
    expect(closerRollIndexOf({ inningIndex: 7, lead: 0, runnerCount: 0 })).toBe(2)
    expect(closerRollIndexOf({ inningIndex: 2, lead: -1, runnerCount: 0 })).toBe(3)
    expect(closerRollIndexOf({ inningIndex: 2, lead: 2, runnerCount: 2 })).toBe(4)
    expect(closerRollIndexOf({ inningIndex: 2, lead: 1, runnerCount: 0 })).toBe(5)
    expect(closerRollIndexOf({ inningIndex: 2, lead: 3, runnerCount: 0 })).toBe(0)
  })

  it('두 팀 다 CPU 면 굴리지 않는다 (0xb6c20)', () => {
    const 굴림 = rollsCloser(
      { inningIndex: 8, lead: 1, runnerCount: 0, bothTeamsAreCpu: true },
      createSeededRandom(1),
    )
    expect(굴림).toBe(false)
  })
})

describe('새 투수 고르기 0xabfcc', () => {
  it('보직을 넘기면 평소에는 중간계투 중 스태미나 최고를 올린다', () => {
    const 고른칸 = chooseReplacementPitcher(
      [
        { index: 2, role: PITCHER_ROLE.starter, stamina: FULL_STAMINA },
        { index: 3, role: PITCHER_ROLE.unknown, stamina: 4000 },
        { index: 4, role: PITCHER_ROLE.unknown, stamina: 9000 },
        { index: 5, role: PITCHER_ROLE.relief, stamina: FULL_STAMINA },
      ],
      { inningIndex: 3, currentStamina: 5000 },
    )

    expect(고른칸).toBe(4)
  })

  it('늦은 이닝에 마무리 플래그가 서면 마무리부터 본다', () => {
    const 고른칸 = chooseReplacementPitcher(
      [
        { index: 3, role: PITCHER_ROLE.unknown, stamina: 9000 },
        { index: 5, role: PITCHER_ROLE.relief, stamina: 8000 },
      ],
      { inningIndex: 8, lateInningFlag: true, currentStamina: 1000 },
    )

    expect(고른칸).toBe(5)
  })

  it('보직이 하나도 없으면(웹 로스터) 스태미나 최고만 본다 — 같으면 작은 칸', () => {
    expect(
      chooseReplacementPitcher([{ index: 2 }, { index: 3 }, { index: 4 }], {
        inningIndex: 3,
        currentStamina: 0,
      }),
    ).toBe(2)
    expect(
      chooseReplacementPitcher([{ index: 2, stamina: 100 }, { index: 3, stamina: 9000 }], {
        inningIndex: 3,
        currentStamina: 0,
      }),
    ).toBe(3)
  })

  it('후보가 없으면 −1 이다', () => {
    expect(chooseReplacementPitcher([], { inningIndex: 3, currentStamina: 0 })).toBe(-1)
  })
})

/**
 * 판정 뒤의 자리 0xac5d8~0xac61c — **마무리 상황이 아닐 때만** 0xac360 을 굴린다
 * (CORRECTIONS 2절 "새 투수 고르기 방향이 반대").
 */
describe('새 투수 고르기 앞의 갈림길 0xac5d8', () => {
  const 후보 = [{ index: 2 }, { index: 3 }, { index: 5 }]
  const 기본상황 = { inningIndex: 8, lead: 1, runnerCount: 0, currentStamina: 5000 }

  it('마무리 상황이면 굴리지 않고 곧장 0xabfcc 로 간다', () => {
    // 굴렸다면 9회·1점 차라 벤치 마지막(5)이 나왔을 자리다
    expect(
      replacementPitcherSlotOf(후보, { ...기본상황, saveSituation: true }, 고정난수(0)),
    ).toBe(2)
  })

  it('마무리 상황이 아니고 굴림에 이기면 벤치 **마지막**을 올린다', () => {
    expect(
      replacementPitcherSlotOf(후보, { ...기본상황, saveSituation: false }, 고정난수(0)),
    ).toBe(5)
  })

  it('두 팀 다 CPU 면 굴림 자체가 없어 늘 0xabfcc 다 (0xb6c20 — 리그 CPU 경기)', () => {
    expect(
      replacementPitcherSlotOf(
        후보,
        { ...기본상황, saveSituation: false, bothTeamsAreCpu: true },
        고정난수(0),
      ),
    ).toBe(2)
  })

  it('벤치가 비면 −1 이다', () => {
    expect(replacementPitcherSlotOf([], { ...기본상황, saveSituation: true }, 고정난수(0))).toBe(-1)
  })
})
