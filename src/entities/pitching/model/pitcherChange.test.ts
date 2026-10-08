import { describe, expect, it } from 'vitest'
import {
  chooseReplacementPitcher,
  pitcherAbilitySumOf,
  closerRollIndexOf,
  CLOSER_ROLL_PERCENTS,
  EMPTY_MOUND_COUNTERS,
  judgePitcherChange,
  replacementPitcherSlotOf,
  rollsCloser,
  ROSTER_PITCHER_ROLES,
  rosterPitcherRoleOf,
} from '@/entities/pitching/model/pitcherChange'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom, createFractionRandom } from '@/shared/api/random/fractionRandom'

const 고정난수 = (value: number): RandomPort => createConstantRandom(value)

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

  it('9회 이후 마무리 상황이면 **교체도 참**이다 — 실점·체력이 멀쩡해도 (ac5b4~ac5c2)', () => {
    const 멀쩡 = { ...기본, inningIndex: 8, lead: 1, runnerCount: 0 }
    expect(judgePitcherChange(멀쩡)).toEqual({ replace: true, saveSituation: true })
    // 연장(0-기준 9 이상)도 같다 — ac574 는 `inn > 7` 만 본다
    expect(judgePitcherChange({ ...멀쩡, inningIndex: 10 })).toEqual({ replace: true, saveSituation: true })
    // 8회(0-기준 7)는 마무리 상황을 안 센다
    expect(judgePitcherChange({ ...멀쩡, inningIndex: 7 })).toEqual({ replace: false, saveSituation: false })
    // 리드 5 · 주자 2 → 5 ≤ 2+2 가 아니고 5 > 3 이라 아니다
    expect(judgePitcherChange({ ...멀쩡, lead: 5, runnerCount: 2 })).toEqual({
      replace: false,
      saveSituation: false,
    })
  })

  it('A>2 · 체력 ≤19% 로 바꿀 때도 ac53a → ac574 에서 마무리 상황을 센다', () => {
    expect(judgePitcherChange({ ...기본, inningIndex: 8, lead: 2, inningRunsAllowed: 3 })).toEqual({
      replace: true,
      saveSituation: true,
    })
    expect(judgePitcherChange({ ...기본, inningIndex: 8, lead: 2, stamina: 1000 })).toEqual({
      replace: true,
      saveSituation: true,
    })
    // 9회 전이면 마무리 상황이 없다
    expect(judgePitcherChange({ ...기본, inningIndex: 6, lead: 2, inningRunsAllowed: 3 })).toEqual({
      replace: true,
      saveSituation: false,
    })
  })

  it('마선수·마무리(역할 2) 갈래는 ac574 를 안 지나 9회 마무리 상황이 없다', () => {
    const 늦음 = { ...기본, inningIndex: 8, lead: 1 }
    expect(judgePitcherChange({ ...늦음, isSpecialPitcher: true })).toEqual({ replace: false, saveSituation: false })
    expect(judgePitcherChange({ ...늦음, role: PITCHER_ROLE.relief })).toEqual({
      replace: false,
      saveSituation: false,
    })
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

  it('마선수는 어느 보직 목록에도 안 든다 — 보직을 몰라도 (ac084 0xb633c)', () => {
    expect(
      chooseReplacementPitcher(
        [{ index: 2, isSpecialPitcher: true }, { index: 3, stamina: 100 }],
        { inningIndex: 3, currentStamina: 0 },
      ),
    ).toBe(3)
    expect(
      chooseReplacementPitcher([{ index: 8, isSpecialPitcher: true }], { inningIndex: 3, currentStamina: 0 }),
    ).toBe(-1)
  })

  it('내 육성 선수(0xb6388)는 넷째 인자(모드 3)가 설 때만 거른다', () => {
    const 후보 = [{ index: 8, isOwnPlayer: true }, { index: 3, stamina: 100 }]
    expect(chooseReplacementPitcher(후보, { inningIndex: 3, currentStamina: 0 })).toBe(8)
    expect(chooseReplacementPitcher(후보, { inningIndex: 3, currentStamina: 0, excludeOwnPlayers: true })).toBe(3)
  })

  it('로스터 칸 표 [0,0,0,0,1,1,1,2] — 평소는 중간(4~6) 스태미나 최고, 중간이 없으면 마무리, 그다음 선발 끝', () => {
    expect(ROSTER_PITCHER_ROLES).toEqual([0, 0, 0, 0, 1, 1, 1, 2])
    const 벤치 = (slots: number[], stamina: (slot: number) => number = () => FULL_STAMINA) =>
      slots.map((index) => ({ index, role: rosterPitcherRoleOf(index), stamina: stamina(index) }))
    expect(
      chooseReplacementPitcher(벤치([1, 2, 3, 4, 5, 6, 7], (slot) => (slot === 5 ? FULL_STAMINA : 5000)), {
        inningIndex: 3,
        currentStamina: 5000,
      }),
    ).toBe(5)
    expect(chooseReplacementPitcher(벤치([1, 2, 3, 7]), { inningIndex: 3, currentStamina: 5000 })).toBe(7)
    // 마무리 스태미나 ≤ 30 이고 마운드 투수가 아직 남았으면 마무리를 건너뛰고 선발 끝
    expect(
      chooseReplacementPitcher(벤치([1, 2, 3, 7], (slot) => (slot === 7 ? 30 : FULL_STAMINA)), {
        inningIndex: 3,
        currentStamina: 5000,
      }),
    ).toBe(3)
    // 9회 이후 마무리 플래그면 마무리부터
    expect(
      chooseReplacementPitcher(벤치([1, 4, 7]), { inningIndex: 8, lateInningFlag: true, currentStamina: 5000 }),
    ).toBe(7)
    expect(chooseReplacementPitcher(벤치([1, 4, 7]), { inningIndex: 8, currentStamina: 5000 })).toBe(4)
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

  it('마무리 갈래는 능력 합 0xb5b50 큰 순이다 — 스태미나가 아니다 (ac0be)', () => {
    const 마무리 = (index: number, abilitySum: number, stamina: number) => ({
      index,
      role: PITCHER_ROLE.relief,
      abilitySum,
      stamina,
    })
    const 입력 = { inningIndex: 8, lateInningFlag: true, currentStamina: 5000 }
    expect(chooseReplacementPitcher([마무리(6, 2000, FULL_STAMINA), 마무리(7, 2400, 4000)], 입력)).toBe(7)
    // 능력 합이 가장 큰 후보가 스태미나 ≤ 30 이면 다음 후보
    expect(chooseReplacementPitcher([마무리(6, 2000, FULL_STAMINA), 마무리(7, 2400, 30)], 입력)).toBe(6)
    // 마운드 투수가 다 지쳤으면(+0x2c ≤ 0) 스태미나를 안 보고 능력 합 첫 후보
    expect(
      chooseReplacementPitcher([마무리(6, 2000, FULL_STAMINA), 마무리(7, 2400, 30)], { ...입력, currentStamina: 0 }),
    ).toBe(7)
    // 같은 합이면 벤치 차례 그대로 (거품 정렬은 `<` 일 때만 맞바꾼다)
    expect(chooseReplacementPitcher([마무리(7, 2400, 4000), 마무리(6, 2400, FULL_STAMINA)], 입력)).toBe(7)
  })

  it('마무리 후보 중 하나라도 능력 합이 없으면 예전 근사(스태미나 순)다', () => {
    expect(
      chooseReplacementPitcher(
        [
          { index: 6, role: PITCHER_ROLE.relief, stamina: FULL_STAMINA },
          { index: 7, role: PITCHER_ROLE.relief, abilitySum: 2400, stamina: 4000 },
        ],
        { inningIndex: 8, lateInningFlag: true, currentStamina: 5000 },
      ),
    ).toBe(6)
  })

  it('능력 합은 경기용 능력치 네 칸(체력 포함)의 합이다 (0xb5b50)', () => {
    expect(pitcherAbilitySumOf([520, 610, 480, 700])).toBe(2310)
    expect(pitcherAbilitySumOf([])).toBe(0)
  })
})

/**
 * 판정 뒤의 자리 0xac5d8~0xac61c — **마무리 상황이 아닐 때만** 0xac360 을 굴린다
 * (CORRECTIONS 2절 "새 투수 고르기 방향이 반대").
 */
describe('새 투수 고르기 앞의 갈림길 0xac5d8', () => {
  /** 벤치 끝(5)이 마선수 — 0xb8a8d(team, 0) 이 참인 벤치 */
  const 후보 = [{ index: 2 }, { index: 3 }, { index: 5, isSpecialPitcher: true }]
  const 기본상황 = { inningIndex: 8, lead: 1, runnerCount: 0, currentStamina: 5000 }
  /** 굴린 횟수를 세는 고정 난수 */
  const 세는 = (value: number) => {
    let calls = 0
    const random: RandomPort = createFractionRandom(() => {
      calls += 1
      return value
    })
    return { random, calls: () => calls }
  }

  it('마무리 상황이면 굴리지 않고 곧장 0xabfcc 로 간다', () => {
    // 굴렸다면 9회·1점 차라 벤치 마지막(5)이 나왔을 자리다
    const 굴림 = 세는(0)
    expect(replacementPitcherSlotOf(후보, { ...기본상황, saveSituation: true }, 굴림.random)).toBe(2)
    expect(굴림.calls()).toBe(0)
  })

  it('마무리 상황이 아니고 벤치에 마선수가 있고 굴림에 이기면 벤치 **마지막**을 올린다', () => {
    expect(
      replacementPitcherSlotOf(후보, { ...기본상황, saveSituation: false }, 고정난수(0)),
    ).toBe(5)
    // 굴림에 지면 0xabfcc — 마선수는 거른다
    expect(
      replacementPitcherSlotOf(후보, { ...기본상황, saveSituation: false }, 고정난수(0.99)),
    ).toBe(2)
  })

  it('벤치에 마선수가 없으면(0xb8a8d 거짓) 굴리지 않는다', () => {
    const 굴림 = 세는(0)
    expect(
      replacementPitcherSlotOf(
        [{ index: 2 }, { index: 3 }, { index: 5 }],
        { ...기본상황, saveSituation: false },
        굴림.random,
      ),
    ).toBe(2)
    expect(굴림.calls()).toBe(0)
  })

  it('굴림에 지고 벤치가 하나면 0xabfcc 없이 0번 — 그 하나가 마선수여도 (ac604)', () => {
    expect(
      replacementPitcherSlotOf(
        [{ index: 8, isSpecialPitcher: true }],
        { ...기본상황, saveSituation: false },
        고정난수(0.99),
      ),
    ).toBe(8)
  })

  it('두 팀 다 CPU 면 0xac360 이 난수 없이 거짓이라 늘 0xabfcc 다 (0xb6c20 — 리그 CPU 경기)', () => {
    const 굴림 = 세는(0)
    expect(
      replacementPitcherSlotOf(
        후보,
        { ...기본상황, saveSituation: false, bothTeamsAreCpu: true },
        굴림.random,
      ),
    ).toBe(2)
    expect(굴림.calls()).toBe(0)
  })

  it('모드 3 에서 벤치 마지막이 내 선수면 ac626 에서 ac5d8 로 돌아가 다시 굴린다', () => {
    // [2, 3, 나(마선수 아님)] + 마선수 하나 — 벤치 마지막을 내 선수로 둔 꼴 (원본 벤치 차례가 그럴 때)
    const 벤치 = [{ index: 2 }, { index: 4, isSpecialPitcher: true }, { index: 8, isOwnPlayer: true }]
    let 차례 = 0
    const 값 = [0, 0, 0.99]
    const random: RandomPort = createFractionRandom(() => 값[Math.min(차례++, 값.length - 1)])
    expect(
      replacementPitcherSlotOf(벤치, { ...기본상황, saveSituation: false, excludeOwnPlayers: true }, random),
    ).toBe(2)
    expect(차례).toBe(3)
  })

  it('벤치가 비면 −1 이다', () => {
    expect(replacementPitcherSlotOf([], { ...기본상황, saveSituation: true }, 고정난수(0))).toBe(-1)
  })
})
