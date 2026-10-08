import { describe, expect, it } from 'vitest'
import {
  cpuBuntKindOf,
  cpuSpecialSwingNumberOf,
  cpuSwingChoiceOf,
  cpuSwingTimingOffsetOf,
  pitchAgainstBatter,
  pitchAgainstBatterDetailed,
  willSwing,
} from '@/entities/pitching/model/simulateBatter'
import type { BatterSituation } from '@/entities/pitching/model/simulateBatter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

/** 정해 둔 값을 차례로 내주고, 몇 번 굴렸는지 센다 */
function 각본(values: readonly number[]): RandomPort & { readonly used: () => number } {
  let used = 0
  const inner = createFractionRandom(() => {
    const value = values[Math.min(used, values.length - 1)]
    used += 1
    return value
  })
  return { ...inner, used: () => used }
}

const 한가운데: Pitch = {
  type: '직구',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 18 * 62,
  frameCount: 18,
  controlTier: 3,
  worldPath: null,
  stageSide: 1,
}
const 크게빠진공: Pitch = { ...한가운데, plate: { x: 1.7, y: -1.6 } }

function 타자(hit: number): BatterAbility {
  return { hit, power: 500, run: 500, defense: 500 }
}

const 무사주자없음 = { strikes: 0, balls: 0, outs: 0, hasRunner: false }

function 비율(
  pitch: Pitch,
  ability: BatterAbility,
  situation: BatterSituation = 무사주자없음,
  attempts = 2000,
): number {
  const random = createSeededRandom(20100901)
  let swings = 0
  for (let i = 0; i < attempts; i += 1) {
    if (willSwing(pitch, ability, random, situation)) swings += 1
  }
  return swings / attempts
}

describe('willSwing — 상대 타자의 판단', () => {
  it('존 안 공은 대체로 휘두른다', () => {
    expect(비율(한가운데, 타자(500))).toBeGreaterThan(0.5)
  })

  it('크게 빠진 공은 거의 쫓지 않는다', () => {
    expect(비율(크게빠진공, 타자(500))).toBeLessThan(0.2)
  })

  it('히트가 높을수록 존 밖 공을 덜 쫓는다 — 선구안', () => {
    const 조금빠진공: Pitch = { ...한가운데, plate: { x: 1.2, y: 0 } }

    expect(비율(조금빠진공, 타자(950))).toBeLessThan(비율(조금빠진공, 타자(100)))
  })

  it('존 안 공은 원본 표의 치기+번트 칸만큼 휘두른다 (battingPattern.arr)', () => {
    // 주자 없음·0사 0-0 = [60, 10, 30] → 70%
    expect(비율(한가운데, 타자(500), 무사주자없음)).toBeCloseTo(0.7, 1)
    // 주자 없음·0사 2스트라이크 0볼 = [95, 0, 5] → 95%
    expect(비율(한가운데, 타자(500), { ...무사주자없음, strikes: 2 })).toBeCloseTo(0.95, 1)
    // 주자 없음·0사 0스트라이크 3볼 = [30, 5, 65] → 35%
    expect(비율(한가운데, 타자(500), { ...무사주자없음, balls: 3 })).toBeCloseTo(0.35, 1)
  })

  it('주자가 있으면 다른 열을 쓴다 — 0-0 은 65+3 = 68%', () => {
    expect(비율(한가운데, 타자(500), { ...무사주자없음, hasRunner: true })).toBeCloseTo(0.68, 1)
  })

  it('존 밖 띠(20px)와 그 밖은 문턱이 다르다 — 2000 − 3h/2 · 250 − h/4', () => {
    // 히트 500 → 띠 (2000 − 750)/10000 = 12.5% · 그 밖 (250 − 125)/10000 = 1.25%
    // 둘 다 표의 70% 를 먼저 통과해야 한다
    const 띠: Pitch = { ...한가운데, plate: { x: 2.0, y: 0 } }
    const 저멀리: Pitch = { ...한가운데, plate: { x: 3.0, y: 0 } }

    expect(비율(띠, 타자(500))).toBeCloseTo(0.7 * 0.125, 1)
    expect(비율(저멀리, 타자(500))).toBeLessThan(0.03)
  })
})

/**
 * 난수 차례 — 원본 0x34334 는 표 뽑기 `rand(0,100)` 를 **늘 한 번**,
 * 쫓아가기 `rand(0,10000)` 를 **존 밖이고 휘두를 마음이 있을 때만 한 번 더** 돈다.
 * (옛 지어낸 규칙은 어느 경우에도 딱 한 번이었다.)
 */
describe('willSwing — 난수 굴림 차례', () => {
  function 굴림수(pitch: Pitch, situation: BatterSituation, values: readonly number[]): number {
    let used = 0
    const random = createFractionRandom(() => {
      const value = values[Math.min(used, values.length - 1)]
      used += 1
      return value
    })
    willSwing(pitch, 타자(500), random, situation)
    return used
  }
  const 존밖: Pitch = { ...한가운데, plate: { x: 2.0, y: 0 } }

  it('지켜보기로 끝나면 한 번만 돈다', () => {
    // 0-0 주자 없음 = [60, 10, 30] → 0.99 는 지켜보기
    expect(굴림수(존밖, 무사주자없음, [0.99])).toBe(1)
  })

  it('존 안이면 쫓아가기를 굴리지 않는다', () => {
    expect(굴림수(한가운데, 무사주자없음, [0.0])).toBe(1)
  })

  it('존 밖에서 휘두를 마음이 있으면 한 번 더 돈다', () => {
    expect(굴림수(존밖, 무사주자없음, [0.0])).toBe(2)
  })
})

/**
 * 타이밍 0x340f8 — K = h/4 + 2900. 첫 굴림 rand(0,10000) < K 면 [0,0] 표(굴림 2번),
 * 아니면 둘째 굴림 < K·19/10 이면 [0,1] 표, 그 밖 [0,1,−1] 표 (둘 다 굴림 3번).
 */
describe('cpuSwingTimingOffsetOf — 원본 0x340f8', () => {
  it('첫 굴림이 K 밑이면 늘 0 이고 굴림은 두 번이다', () => {
    // 히트 0 → K = 2900. 0.2899 → 2899 < 2900
    const random = 각본([0.2899, 0.99])
    expect(cpuSwingTimingOffsetOf(0, random)).toBe(0)
    expect(random.used()).toBe(2)
  })

  it('첫 굴림이 K 와 같으면 둘째 갈래로 간다 — 비교는 `<` 다', () => {
    // 2900 은 K=2900 을 못 넘는다 → 둘째 rand 0 < 5510 → [0,1][1] = +1
    const random = 각본([0.29, 0, 0.99])
    expect(cpuSwingTimingOffsetOf(0, random)).toBe(1)
    expect(random.used()).toBe(3)
  })

  it('둘째 문턱은 K·19/10 이다 — 히트 0 이면 5510', () => {
    expect(cpuSwingTimingOffsetOf(0, 각본([0.5, 0.5509, 0]))).toBe(0)
    // 5510 은 못 넘는다 → 셋째 표 [0,1,−1], rand(0,3)=2 → −1
    const random = 각본([0.5, 0.551, 0.9])
    expect(cpuSwingTimingOffsetOf(0, random)).toBe(-1)
    expect(random.used()).toBe(3)
  })

  it('히트는 K 를 h/4 만큼 올린다 — 999 면 K = 3149', () => {
    expect(cpuSwingTimingOffsetOf(999, 각본([0.3148, 0.99]))).toBe(0)
    // 3149 는 못 넘는다 → 둘째 rand 0 < 5983 → [0,1][0] = 0, 굴림 3번
    const random = 각본([0.3149, 0, 0])
    expect(cpuSwingTimingOffsetOf(999, random)).toBe(0)
    expect(random.used()).toBe(3)
  })

  it('실투면 K = 10000 — 늘 첫 갈래라 d = 0, 굴림 두 번', () => {
    const random = 각본([0.9999, 0.99])
    expect(cpuSwingTimingOffsetOf(0, random, true)).toBe(0)
    expect(random.used()).toBe(2)
  })

  it('히트 0 분포는 d=0 59.2% · +1 30.2% · −1 10.6% 이다', () => {
    const random = createSeededRandom(20101005)
    const counts = new Map<number, number>()
    const attempts = 40000
    for (let i = 0; i < attempts; i += 1) {
      const d = cpuSwingTimingOffsetOf(0, random)
      counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    expect((counts.get(0) ?? 0) / attempts).toBeCloseTo(0.592, 1)
    expect((counts.get(1) ?? 0) / attempts).toBeCloseTo(0.302, 1)
    expect((counts.get(-1) ?? 0) / attempts).toBeCloseTo(0.106, 1)
    expect([...counts.keys()].sort()).toEqual([-1, 0, 1])
  })
})

/**
 * 번트 0x34446~0x34464 — 표에서 번트 칸(choice 1)이 뽑히고 마선수가 아니면 rand(1,4) 로 종류 1~3.
 * 타이밍 0x340f8 **다음**에 굴린다.
 */
describe('CPU 번트 — 원본 0x3445a', () => {
  it('표의 번트 칸을 뽑으면 번트를 고른다', () => {
    // 0-0 주자 없음 = [60, 10, 30] → rand 65 는 번트
    expect(cpuSwingChoiceOf(한가운데, 타자(500), 각본([0.65]), 무사주자없음)).toBe('번트')
    expect(cpuSwingChoiceOf(한가운데, 타자(500), 각본([0.59]), 무사주자없음)).toBe('치기')
    expect(cpuSwingChoiceOf(한가운데, 타자(500), 각본([0.7]), 무사주자없음)).toBeNull()
  })

  it('번트 종류는 rand(1,4) — 1·2·3 이고 한 번 굴린다', () => {
    const kinds = [0, 0.34, 0.67, 0.9999].map((v) => cpuBuntKindOf('번트', false, 각본([v])))
    expect(kinds).toEqual([1, 2, 3, 3])
    const random = 각본([0.5])
    cpuBuntKindOf('번트', false, random)
    expect(random.used()).toBe(1)
  })

  it('치기거나 마선수면 번트하지 않고 굴리지도 않는다', () => {
    const random = 각본([0.5])
    expect(cpuBuntKindOf('치기', false, random)).toBe(0)
    expect(cpuBuntKindOf('번트', true, random)).toBe(0)
    expect(random.used()).toBe(0)
  })

  it('번트 칸이 뽑힌 공은 번트 결과(성공 6~8 · 실패 12~14 → 희생번트 등)로 끝난다', () => {
    // 표 65(번트) → 타이밍 첫 갈래 2번 → 번트 종류 rand(1,4) 0 → 1 → 0xab214 번트 굴림 0 → 성공 코드 6
    const random = 각본([0.65, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const result = pitchAgainstBatter(한가운데, 타자(500), random, undefined, 무사주자없음)
    expect(result).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' } })
  })

  it('페어 번트 타구도 번트 종류(장면 +0xfdc)를 싣는다 — 판 시작 리드 · 필살수비 관문 · 정산이 본다', () => {
    const random = 각본([0.65, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const thrown = pitchAgainstBatterDetailed(한가운데, 타자(500), random, undefined, 무사주자없음)
    expect(thrown.resolution.kind).toBe('타구')
    expect(thrown.buntKind).toBe(1)
    // 휘두른 타구는 0
    const 굴림 = [0.65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(
      pitchAgainstBatterDetailed(한가운데, 타자(500), 각본(굴림), undefined, 무사주자없음, { isMagicBatter: true }).buntKind,
    ).toBe(0)
  })

  it('안 휘두른 공은 장면 +0xfdc 에 앞 공의 번트 종류가 남는다 — 0x34436 은 휘두를 때만 쓴다', () => {
    const 지켜봄 = Array.from({ length: 40 }, (_unused, index) =>
      pitchAgainstBatterDetailed(크게빠진공, 타자(500), createSeededRandom(index + 1), undefined, 무사주자없음, { previousBuntKind: 2 }),
    ).filter((thrown) => thrown.resolution.kind === '볼')
    expect(지켜봄.length).toBeGreaterThan(0)
    expect(지켜봄.every((thrown) => thrown.buntKind === 2)).toBe(true)
  })

  it('번트 헛스윙도 그 공의 번트 종류를 낸다 (0x3445a)', () => {
    // 높은 공(y 1.2)에 힘 1 타자 · 주자 있음 — 씨앗 40 은 번트 칸을 뽑고 0xab214 가 헛스윙을 낸다
    const 높은공: Pitch = { ...한가운데, plate: { x: 0, y: 1.2 }, controlTier: 0 }
    const thrown = pitchAgainstBatterDetailed(
      높은공,
      { hit: 1, power: 1, run: 500, defense: 500 },
      createSeededRandom(40),
      { control: 999, velocity: 999 },
      { ...무사주자없음, hasRunner: true },
      { previousBuntKind: 0 },
    )
    expect(thrown.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(thrown.buntKind).toBeGreaterThan(0)
  })

  it('마선수는 번트 칸을 뽑아도 휘두른다', () => {
    // 같은 굴림으로 보통 타자는 희생번트, 마선수는 0xab214 보통 스윙(첫 굴림들이 0 이라 강타)이다.
    // 결과는 판이 정하므로 타석에 실리는 것은 임시 값이다 — 희생번트 패턴은 땅볼아웃, 강타(코드 24)는 담장을 먼저 넘는 궤적이라 홈런
    // (`battedContact.provisionalOutcomeOf`)
    const 굴림 = [0.65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(pitchAgainstBatter(한가운데, 타자(500), 각본(굴림), undefined, 무사주자없음)).toEqual({
      kind: '타구',
      outcome: { kind: '아웃', detail: '땅볼아웃' },
    })
    expect(
      pitchAgainstBatter(한가운데, 타자(500), 각본(굴림), undefined, 무사주자없음, { isMagicBatter: true }),
    ).toEqual({ kind: '타구', outcome: { kind: '홈런' } })
  })
})

/**
 * 실투 0x34376 — 표 굴림 뒤에 choice 를 0(치기)으로 덮고, 타이밍 K = 10000 으로 d = 0.
 */
describe('실투면 CPU 타자는 치기로 간다 — 0x34376 · 0x34162', () => {
  it('표에서 지켜보기를 뽑아도 친다 (표 굴림은 그대로 한다)', () => {
    const random = 각본([0.99])
    expect(cpuSwingChoiceOf(한가운데, 타자(500), random, 무사주자없음, true)).toBe('치기')
    expect(random.used()).toBe(1)
  })

  it('번트 칸을 뽑아도 치기다', () => {
    expect(cpuSwingChoiceOf(한가운데, 타자(500), 각본([0.65]), 무사주자없음, true)).toBe('치기')
  })

  it('존 밖이면 쫓아가기 굴림은 그대로 한다 — 실투가 무조건 스윙은 아니다', () => {
    const 저멀리: Pitch = { ...한가운데, plate: { x: 3.0, y: 0 } }
    const random = 각본([0.99, 0.5])
    expect(cpuSwingChoiceOf(저멀리, 타자(500), random, 무사주자없음, true)).toBeNull()
    expect(random.used()).toBe(2)
  })

  it('pitchAgainstBatter 는 실투면 지켜볼 공도 휘두르고 타이밍이 정확하다', () => {
    // 표 0.99(지켜보기) → 실투로 치기 → 타이밍 0.9999 도 K=10000 밑 → d=0
    const 굴림 = [0.99, 0.9999, 0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    expect(pitchAgainstBatter(한가운데, 타자(500), 각본(굴림), undefined, 무사주자없음).kind).toBe('스트라이크')
    expect(
      pitchAgainstBatter(한가운데, 타자(500), 각본(굴림), undefined, 무사주자없음, { isMistakePitch: true }).kind,
    ).not.toBe('스트라이크')
  })
})

describe('CPU 마타자 필살 — 원본 0x34468~0x34488', () => {
  const 마타자 = { isMagicBatter: true, swingNumber: 3, remaining: 2 }

  it('마타자는 번호가 있고 남은 횟수가 있으면 늘 필살이다', () => {
    expect(cpuSpecialSwingNumberOf(마타자)).toBe(3)
  })

  it('남은 횟수가 0 이거나 번호가 없으면 보통 스윙', () => {
    expect(cpuSpecialSwingNumberOf({ ...마타자, remaining: 0 })).toBe(0)
    expect(cpuSpecialSwingNumberOf({ ...마타자, swingNumber: 0 })).toBe(0)
  })

  it('남은 횟수는 s8 이라 0 이 아니기만 하면 된다 (원본 `cmp r0,#0 ; beq`)', () => {
    expect(cpuSpecialSwingNumberOf({ ...마타자, remaining: -1 })).toBe(3)
  })

  it('일반 CPU 타자는 번호가 있어도 절대 쓰지 않는다', () => {
    expect(cpuSpecialSwingNumberOf({ ...마타자, isMagicBatter: false })).toBe(0)
  })
})

describe('pitchAgainstBatter', () => {
  it('존 밖 공을 안 휘두르면 볼이다', () => {
    const random = createSeededRandom(20100901)
    const results = Array.from({ length: 200 }, () =>
      pitchAgainstBatter(크게빠진공, 타자(900), random),
    )

    expect(results.filter((r) => r.kind === '볼').length).toBeGreaterThan(100)
  })

  it('존 안 공은 스트라이크나 타구로 이어진다', () => {
    const random = createSeededRandom(20100901)
    const results = Array.from({ length: 200 }, () =>
      pitchAgainstBatter(한가운데, 타자(500), random),
    )

    expect(results.some((r) => r.kind === '스트라이크')).toBe(true)
    expect(results.some((r) => r.kind === '타구')).toBe(true)
  })

  it('약한 타자는 강한 타자보다 헛스윙이 많다', () => {
    function 헛스윙수(hit: number): number {
      const random = createSeededRandom(777)
      let count = 0
      for (let i = 0; i < 400; i += 1) {
        const r = pitchAgainstBatter(한가운데, 타자(hit), random)
        if (r.kind === '스트라이크' && r.isSwinging) count += 1
      }
      return count
    }

    expect(헛스윙수(100)).toBeGreaterThan(헛스윙수(950))
  })

  it('강한 타자는 약한 타자보다 타구를 많이 만든다', () => {
    function 타구수(hit: number): number {
      const random = createSeededRandom(777)
      let count = 0
      for (let i = 0; i < 400; i += 1) {
        if (pitchAgainstBatter(한가운데, 타자(hit), random).kind === '타구') count += 1
      }
      return count
    }

    expect(타구수(950)).toBeGreaterThan(타구수(100))
  })

  it('같은 시드는 같은 결과를 낸다', () => {
    const a = pitchAgainstBatter(한가운데, 타자(600), createSeededRandom(42))
    const b = pitchAgainstBatter(한가운데, 타자(600), createSeededRandom(42))

    expect(a).toEqual(b)
  })

  it('던진 투수의 깎은 뒤 체력%가 0 이면 ab838 이 B · C 에 +2000 — 같은 씨앗에서 결과가 갈리고 1% 면 예전과 같다', () => {
    const 백번 = (pitcherStaminaPercent?: number) => {
      const random = createSeededRandom(20100901)
      return Array.from({ length: 100 }, () =>
        pitchAgainstBatter(한가운데, 타자(500), random, undefined, undefined, { pitcherStaminaPercent }),
      )
    }
    expect(백번(1)).toEqual(백번())
    expect(백번(0)).not.toEqual(백번())
  })
})

/**
 * CPU 타자도 사람 타석과 같은 상태 0x12 진입 0x3dfac → 0x35a20 을 지난다.
 * 지켜본 공(0x34334 가 스윙 예약을 안 한 공)이 사각형 0xcfd50 안에 닿으면 사구다.
 */
describe('pitchAgainstBatter — 사구 0x35a20', () => {
  /** 도착점 하나짜리 궤적 — 판정 좌표는 궤적 마지막 점의 `projectToPlate` 다 */
  const 도착 = (x: number, stageSide: number, plate = { x: -2.5, y: 0 }): Pitch => ({
    ...한가운데,
    plate,
    worldPath: [
      { x: 19501, y: 1110, z: 24500 },
      { x, y: 1202, z: 29705 },
    ],
    stageSide,
  })

  it('지켜본 공이 좌타 상자 [271, 309] 안이면 사구 — 표 굴림 한 번 뒤 난수를 더 안 쓴다', () => {
    // side 1: (21450, 1202, 29705) → 판정 좌표 (289, 325). 표 굴림 99 → 지켜보기
    const random = 각본([0.99])
    expect(pitchAgainstBatter(도착(21450, 1), 타자(500), random, undefined, 무사주자없음)).toEqual({ kind: '사구' })
    expect(random.used()).toBe(1)
  })

  it('우타(side 0)는 뒤집지 않은 상자 [171, 209] — (18400 → 181) 이 사구', () => {
    expect(pitchAgainstBatter(도착(18400, 0), 타자(500), 각본([0.99]), undefined, 무사주자없음)).toEqual({
      kind: '사구',
    })
    // 같은 월드 점을 좌타 배치(side 1)로 보면 (186) 상자 밖이라 볼이다
    expect(pitchAgainstBatter(도착(19700, 1), 타자(500), 각본([0.99]), undefined, 무사주자없음)).toEqual({
      kind: '볼',
    })
  })

  it('치기를 뽑았어도 존 밖 공을 안 쫓으면(스윙 예약 없음) 상자 판정까지 간다', () => {
    // 표 0 → 치기 · 존 밖(구역 3) 쫓기 굴림 9999 > 250 − h/4 → 지켜봄
    const random = 각본([0, 0.9999])
    expect(pitchAgainstBatter(도착(21450, 1), 타자(500), random, undefined, 무사주자없음)).toEqual({ kind: '사구' })
    expect(random.used()).toBe(2)
  })

  it('휘두르면 상자 안이어도 사구가 아니다 (스윙 객체 +0xd ≠ 0)', () => {
    // 표 0 → 치기 · 쫓기 굴림 0 → 휘두른다
    const result = pitchAgainstBatter(도착(21450, 1), 타자(500), 각본([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), undefined, 무사주자없음)
    expect(result.kind).not.toBe('사구')
  })

  it('궤적이 없는 공은 판정 좌표가 없어 사구가 없다', () => {
    expect(pitchAgainstBatter(크게빠진공, 타자(500), 각본([0.99]), undefined, 무사주자없음)).toEqual({ kind: '볼' })
  })
})

describe('pitchAgainstBatterDetailed — CPU 마타자 필살 (0x34488 → 0x4e136 → 0x34d6c → 0x517e6)', () => {
  const 마타자 = { isMagicBatter: true, specialSwing: { swingNumber: 7, remaining: 2, aceOrder: 2, aceLevel: 4 } }

  it('맞은 페어 공이면 성공 굴림 0x517e6 의 재료(마타자 30%)를 쏜 공에 싣고 판 시작에 맡긴다 — 여기서는 안 굴리고 남은 횟수만 1 줄인다', () => {
    // 원본 차례: 메시지 0x11(필살수비 · 표시 패턴 · 폴 굴림) 뒤 517e6 — 수비 판 시작(startDefensePlay)이 굴린다
    const 보통 = 각본([0])
    const 필살 = 각본([0])
    const a = pitchAgainstBatterDetailed(한가운데, 타자(500), 보통, undefined, undefined, { isMagicBatter: true })
    const b = pitchAgainstBatterDetailed(한가운데, 타자(500), 필살, undefined, undefined, 마타자)
    expect(a.resolution.kind).toBe('타구')
    expect(b.resolution.kind).toBe('타구')
    expect(a).toMatchObject({ isSpecialSwing: false, specialSwingRemaining: null, isUncatchable: false })
    expect(b).toMatchObject({ isSpecialSwing: true, specialSwingRemaining: 1, isUncatchable: false })
    if (a.resolution.kind !== '타구' || b.resolution.kind !== '타구') throw new Error('타구가 아니다')
    expect(contactOfOutcome(a.resolution.outcome)?.specialSwing).toBeUndefined()
    expect(contactOfOutcome(b.resolution.outcome)?.specialSwing?.isAceBatter).toBe(true)
    expect(contactOfOutcome(b.resolution.outcome)?.specialSwing?.number).toBeGreaterThan(0)
    expect(필살.used()).toBe(보통.used())
  })

  it('헛스윙이면 굴리지 않지만 횟수는 준다 — 소모는 스윙 틱(0x4e136)이라 결과와 무관', () => {
    // 표 0 · 타이밍 0·0 · 번트 r100 0 · contact 0.9 (hit 0 vs 구속 1300 → contact 6250 미만)
    const 값 = [0, 0, 0, 0, 0.9]
    const 보통 = 각본(값)
    const 필살 = 각본(값)
    const 강투수 = { control: 1300, velocity: 1300 }
    const a = pitchAgainstBatterDetailed(한가운데, 타자(0), 보통, 강투수, undefined, { ...마타자, specialSwing: undefined })
    const b = pitchAgainstBatterDetailed(한가운데, 타자(0), 필살, 강투수, undefined, 마타자)
    expect(a.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(b.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(b).toMatchObject({ isSpecialSwing: true, specialSwingRemaining: 1, isUncatchable: false })
    expect(필살.used()).toBe(보통.used())
  })

  it('남은 횟수 0 이거나 일반 타자면 필살이 없다 — 굴림 차례도 그대로', () => {
    const 기준 = 각본([0])
    pitchAgainstBatterDetailed(한가운데, 타자(500), 기준)
    const 없음 = 각본([0])
    const 일반 = 각본([0])
    expect(
      pitchAgainstBatterDetailed(한가운데, 타자(500), 없음, undefined, undefined, { ...마타자, specialSwing: { swingNumber: 7, remaining: 0 } }),
    ).toMatchObject({ isSpecialSwing: false, specialSwingRemaining: 0 })
    expect(
      pitchAgainstBatterDetailed(한가운데, 타자(500), 일반, undefined, undefined, { ...마타자, isMagicBatter: false }),
    ).toMatchObject({ isSpecialSwing: false, specialSwingRemaining: 2 })
    expect(없음.used()).toBe(기준.used())
    expect(일반.used()).toBe(기준.used())
  })

  it('pitchAgainstBatter 는 판정만 돌려준다 (같은 난수 차례)', () => {
    const a = pitchAgainstBatter(한가운데, 타자(600), createSeededRandom(42), undefined, undefined, 마타자)
    const b = pitchAgainstBatterDetailed(한가운데, 타자(600), createSeededRandom(42), undefined, undefined, 마타자)
    expect(a).toEqual(b.resolution)
  })
})
