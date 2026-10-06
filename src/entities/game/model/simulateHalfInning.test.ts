import { describe, expect, it } from 'vitest'
import {
  changePitcherIfNeeded,
  drainPitcherForPitch,
  drainQuickPitcher,
  simulateHalfInning,
  startingMoundOf,
} from '@/entities/game/model/simulateHalfInning'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { recordLineupPlay, rosterLineupOf } from '@/entities/game/model/quickLineup'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const 타자 = (hit: number): QuickAtBatBatter => ({ hit, power: hit, run: hit, skillIds: [] })
const 투수 = (control: number): QuickAtBatPitcher => ({
  control,
  velocity: control,
  stamina: 90,
  skillIds: [],
})

/** 결정론적인 선형 합동 난수 — 같은 씨앗이면 항상 같은 경기가 나온다 */
function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return {
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    },
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

describe('simulateHalfInning — 3아웃까지 원본 타석 엔진을 돌린다', () => {
  it('반드시 끝나고 타순이 최소 세 명은 넘어간다', () => {
    const result = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(7))

    expect(result.runs).toBeGreaterThanOrEqual(0)
    expect(result.nextBattingOrderIndex).toBeGreaterThanOrEqual(3)
  })

  it('같은 씨앗이면 같은 결과가 나온다', () => {
    const 첫번째 = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(2010))
    const 두번째 = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(2010))

    expect(첫번째).toEqual(두번째)
  })

  it('강한 타선이 약한 투수를 만나면 약한 타선보다 많이 낸다 — 확률표가 아니라 능력치가 점수를 만든다', () => {
    const 합계 = (hit: number, control: number) => {
      const random = 씨앗난수(4242)
      let total = 0
      for (let inning = 1; inning <= 60; inning += 1) {
        total += simulateHalfInning(0, () => 타자(hit), 투수(control), 1, random).runs
      }
      return total
    }

    expect(합계(900, 200)).toBeGreaterThan(합계(200, 900))
  })

  it('타순은 이어받은 자리부터 시작한다', () => {
    const 받은타순: number[] = []
    simulateHalfInning(
      7,
      (index) => {
        받은타순.push(index)
        return 타자(500)
      },
      투수(500),
      1,
      씨앗난수(11),
    )

    expect(받은타순[0]).toBe(7)
    expect(받은타순[1]).toBe(8)
  })

  /**
   * 원본은 간이 엔진이 끝낸 타석도 사람 경기와 같은 기록 함수 0xa8024 로 흘려보낸다 (B-2).
   * **판정은 그대로 두고 결과만 내보내는 것**이라, 같은 씨앗의 점수는 전과 같아야 한다.
   */
  it('타석 결과를 타순과 함께 내준다 — 점수 합과 타점 합이 맞는다', () => {
    const result = simulateHalfInning(3, () => 타자(700), 투수(300), 1, 씨앗난수(123))
    const 타순들 = result.plateAppearances.map((appearance) => appearance.battingOrderIndex)

    // 첫 타자는 이어받은 자리, 그 뒤로 하나씩 올라간다
    expect(타순들[0]).toBe(3)
    expect(타순들).toEqual(타순들.map((_unused, index) => 3 + index))
    // 마지막 타석 다음이 다음 이닝의 시작 타순이다
    expect(result.nextBattingOrderIndex).toBe(3 + result.plateAppearances.length)
    // 타점 합 = 이닝 득점 (3아웃으로 지워진 득점은 양쪽 모두에서 빠진다)
    expect(result.plateAppearances.reduce((sum, at) => sum + at.runsBattedIn, 0)).toBe(result.runs)
  })
})

/**
 * 간이 타석 루프 0xc262c 는 **타석마다 먼저** 0xc1ba4 를 불러 수비 팀 투수 교체를 판정한다
 * (E-defense-rules E-6 · 3c, P7-leftovers E1·E2 · CORRECTIONS 2절).
 */
describe('반 이닝의 CPU 투수 교체·체력 소모 (0xc1ba4 → 0xac428 · 0xa5e14)', () => {
  const 마운드 = (덮어쓰기: Partial<HalfInningMound> = {}): HalfInningMound => ({
    ...startingMoundOf(0),
    ...덮어쓰기,
  })
  const 수비 = (mound: HalfInningMound, pitcherSlots: readonly number[] = [0, 1, 2, 3]) => ({
    mound,
    pitcherSlots,
    pitcherAt: () => 투수(500),
    staminaAbilityAt: () => 400,
    lead: 0,
    // 하루치 리그 경기는 양 팀 다 CPU 라 마무리 굴림(0xac360)을 아예 안 돌린다 (0xb6c20)
    bothTeamsAreCpu: true,
  })

  it('수비 쪽을 안 넘기면 예전처럼 투수 하나가 고정이다 — 줄도 마운드도 없다', () => {
    const result = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(7))

    expect(result.pitcherLines).toEqual([])
    expect(result.mound).toBeUndefined()
  })

  it('투수 실점이 5 를 넘으면(1~4회 B>4) 다음 타석 전에 내려간다', () => {
    const result = simulateHalfInning(
      0,
      () => 타자(500),
      투수(500),
      1,
      씨앗난수(3),
      undefined,
      undefined,
      수비(마운드({ runsAllowed: 5, pitches: 80 })),
    )

    // 벤치는 1·2·3 — 스태미나가 다 같으면 0xabfcc 가 번호가 작은 쪽을 집는다
    expect(result.mound?.pitcherSlot).toBe(1)
    // 교체 0xaec64 가 카운터를 한꺼번에 0 으로 민다 (그 뒤 이 이닝 실점만 다시 쌓인다)
    expect(result.mound?.usedSlots).toEqual([0])
    // 첫 타석 전에 바뀌었으니 내려간 투수 줄은 아예 없다
    expect(result.pitcherLines.map((줄) => 줄.pitcherSlot)).toEqual([1])
  })

  it('벤치가 없으면 아무리 맞아도 안 바꾼다 (`team+0x33` ≤ 인자)', () => {
    const result = simulateHalfInning(
      0,
      () => 타자(500),
      투수(500),
      1,
      씨앗난수(3),
      undefined,
      undefined,
      수비(마운드({ runsAllowed: 9, pitches: 120 }), [0]),
    )

    expect(result.mound?.pitcherSlot).toBe(0)
    expect(result.pitcherLines.map((줄) => 줄.pitcherSlot)).toEqual([0])
  })

  it('던진 만큼 체력이 깎인다 — 투구 수도 마운드에 쌓인다 (0xa5e14 → 0xaeb08)', () => {
    const result = simulateHalfInning(
      0,
      () => 타자(500),
      투수(500),
      1,
      씨앗난수(21),
      undefined,
      undefined,
      수비(마운드()),
    )

    expect(result.mound?.pitches).toBe(result.pitches)
    expect(result.mound?.stamina).toBeLessThan(FULL_STAMINA)
    // 줄의 합은 반 이닝 합과 같다
    const 합 = (고르기: (줄: (typeof result.pitcherLines)[number]) => number) =>
      result.pitcherLines.reduce((sum, 줄) => sum + 고르기(줄), 0)
    expect(합((줄) => 줄.outs)).toBe(result.outs)
    expect(합((줄) => 줄.runsAllowed)).toBe(result.runs)
    expect(합((줄) => 줄.pitches)).toBe(result.pitches)
  })

  it('벤치가 한 명만 남아도 바꾼다 — 간이 엔진의 최소 벤치 인자는 0 이다 (0xc1cd8 `max(r7, 0)`)', () => {
    const result = simulateHalfInning(
      0,
      () => 타자(500),
      투수(500),
      1,
      씨앗난수(3),
      undefined,
      undefined,
      수비(마운드({ runsAllowed: 5, pitches: 80 }), [0, 1]),
    )

    expect(result.mound?.pitcherSlot).toBe(1)
    expect(result.mound?.usedSlots).toEqual([0])
  })

  /** 도루는 투구 판정 경로(0xc1818) 뒤에만 굴린다 — 실패가 없어 주자를 잃지 않는다 (E-5) */
  it('발 빠른 타선은 도루를 만들어 낸다 — 실패가 없어 아웃이 늘지 않는다', () => {
    const random = 씨앗난수(4242)
    let steals = 0
    let outs = 0
    for (let inning = 1; inning <= 40; inning += 1) {
      const result = simulateHalfInning(0, () => 타자(900), 투수(300), inning, random)
      steals += result.steals
      outs += result.outs
    }

    expect(steals).toBeGreaterThan(0)
    expect(outs).toBe(40 * 3)
  })
})

describe('공 하나 소모 drainPitcherForPitch — 0xa5e14 의 0xa5f0e~ → 0xaeb08', () => {
  const 수비: HalfInningDefense = {
    mound: startingMoundOf(0),
    pitcherSlots: [0, 1, 2, 3, 4, 5, 6, 7],
    pitcherAt: () => {
      throw new Error('안 쓴다')
    },
    staminaAbilityAt: () => 500,
    lead: 0,
  }

  it('직구 다섯 개는 간이 엔진의 다섯 공(drainQuickPitcher)과 같다', () => {
    let mound = startingMoundOf(0)
    for (let index = 0; index < 5; index += 1) {
      mound = { ...mound, stamina: drainPitcherForPitch(수비, mound, 1, false) }
    }
    expect(mound.stamina).toBe(drainQuickPitcher(수비, startingMoundOf(0), 5))
  })

  it('구질별 소모 9 · 11 · 12 · 13 순으로 더 깎인다 (0x66ef0)', () => {
    const 남은 = [1, 2, 10, 18].map((type) => drainPitcherForPitch(수비, startingMoundOf(0), type, false))
    expect([...남은].sort((a, b) => b - a)).toEqual(남은)
    expect(new Set(남은).size).toBe(4)
  })

  it('타자 압도면 c ×2 — 직구 둘과 같다', () => {
    const 압도 = drainPitcherForPitch(수비, startingMoundOf(0), 1, true)
    expect(FULL_STAMINA - 압도).toBeGreaterThan(FULL_STAMINA - drainPitcherForPitch(수비, startingMoundOf(0), 1, false))
  })
})

describe('투수편(모드 3)의 0xac428 — [sp+4] 내 투수 건너뛰기 · [sp+8] 강제 (ac428~ac656)', () => {
  const 내투수 = 8
  /** 벤치 차례 [1, 2, 나] — 마운드 0 */
  const 수비: HalfInningDefense = {
    mound: startingMoundOf(0),
    pitcherSlots: [0, 1, 2, 내투수],
    pitcherAt: () => 투수(500),
    staminaAbilityAt: () => 500,
    lead: 0,
    bothTeamsAreCpu: false,
    isOwnPlayerAt: (slot) => slot === 내투수,
  }
  /** 차례대로 내주는 next() 값 — 다 쓰면 마지막 값을 되풀이 */
  const 차례 = (values: readonly number[]) => {
    let calls = 0
    const random: RandomPort = {
      next: () => values[Math.min(calls++, values.length - 1)],
      nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
      pick: (candidates) => candidates[0],
    }
    return { random, calls: () => calls }
  }
  const 상황 = (random: RandomPort) => ({
    inningIndex: 2,
    lead: 0,
    runnerCount: 0,
    inningRunsAllowed: 0,
    random,
  })

  it('강제(0xc1b48)면 판정이 거짓이어도 바꾼다 — 기운 넘치는 선발도 내린다', () => {
    const 굴림 = 차례([0.99])
    expect(changePitcherIfNeeded(수비, 수비.mound, 상황(굴림.random))).toBe(수비.mound)
    const 바뀜 = changePitcherIfNeeded(수비, 수비.mound, { ...상황(굴림.random), force: true })
    // 마무리 굴림 rand(0,100) = 99 → 45% 에 못 미쳐 0xabfcc — 다 가득이라 벤치 앞 번호
    expect(바뀜.pitcherSlot).toBe(1)
    expect(바뀜.usedSlots).toEqual([0])
    expect(바뀜.justChanged).toBe(true)
  })

  it('벤치에 마선수가 없으면 0xb8a8d 가 거짓이라 0xac360 을 안 굴린다 — 0xabfcc 가 내 투수를 걸러 1 (ac5d8)', () => {
    // 굴렸다면 0 → 벤치 마지막(나)이 나왔을 자리다. 투수편 로스터에는 마선수(+0xa 비트6)가 없다
    const 굴림 = 차례([0])
    const 바뀜 = changePitcherIfNeeded(수비, 수비.mound, { ...상황(굴림.random), force: true })
    expect(바뀜.pitcherSlot).toBe(1)
    expect(굴림.calls()).toBe(0)
  })

  it('벤치가 나 하나뿐이면 아예 안 바꾼다 (ac458) — 강제여도', () => {
    const 마운드: HalfInningMound = { ...startingMoundOf(2), usedSlots: [0, 1] }
    const 굴림 = 차례([0])
    expect(changePitcherIfNeeded(수비, 마운드, { ...상황(굴림.random), force: true })).toBe(마운드)
    expect(굴림.calls()).toBe(0)
  })

  it('최소 벤치 [sp+0x58] — 벤치가 그보다 많아야 본다 (ac44e)', () => {
    const 지친: HalfInningMound = { ...수비.mound, stamina: 0 }
    const 굴림 = 차례([0.99])
    expect(changePitcherIfNeeded(수비, 지친, { ...상황(굴림.random), minimumBench: 3 })).toBe(지친)
    expect(changePitcherIfNeeded(수비, 지친, { ...상황(굴림.random), minimumBench: 2 }).pitcherSlot).toBe(1)
  })

  it('교체 직후(state[0xd])면 강제도 막힌다 (ac486)', () => {
    const 막 = { ...수비.mound, justChanged: true }
    expect(changePitcherIfNeeded(수비, 막, { ...상황(차례([0.99]).random), force: true })).toBe(막)
  })
})

describe('CPU 대타 0xac228 은 마선수 타자를 바꾸지 않는다 (0xb633c)', () => {
  /** 아홉 타순이 모두 두 타석 범타 — 대타 막는 조건을 다 지난 명단 */
  const 범타명단 = () => {
    let lineup = rosterLineupOf(12)
    for (let order = 0; order < 9; order += 1) {
      lineup = recordLineupPlay(lineup, order, { kind: '삼진' }, 0)
      lineup = recordLineupPlay(lineup, order, { kind: '삼진' }, 0)
    }
    return lineup
  }

  it('모든 칸이 마선수면 대타가 하나도 안 나고, 아니면 나는 씨앗이 있다', () => {
    let 보통대타 = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const 보통 = simulateHalfInning(0, () => 타자(300), 투수(500), 5, createSeededRandom(seed), undefined, {}, undefined, {
        lineup: 범타명단(),
        batterOf: () => 타자(300),
        pinchHitUsed: false,
      })
      보통대타 += 보통.pinchHits.length
      const 마선수 = simulateHalfInning(0, () => 타자(300), 투수(500), 5, createSeededRandom(seed), undefined, {}, undefined, {
        lineup: 범타명단(),
        batterOf: () => 타자(300),
        pinchHitUsed: false,
        isAceRosterSlot: () => true,
      })
      expect(마선수.pinchHits).toEqual([])
    }
    expect(보통대타).toBeGreaterThan(0)
  })
})
