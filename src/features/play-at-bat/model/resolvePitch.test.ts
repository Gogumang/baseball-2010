import { describe, expect, it } from 'vitest'
import { isHitByPitch, isStrikeZonePitch, plateErrorOf, resolvePitch, STRIKE_ZONE_BOXES, unjudgedSwingDetailOf } from '@/features/play-at-bat/model/resolvePitch'
import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import type { BattingContext } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck, lastDrawnPattern } from '@/entities/batting/model/battedBallOutcome'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom, createFractionRandom } from '@/shared/api/random/fractionRandom'

const 직구 = (overrides: Partial<Pitch> = {}): Pitch => ({
  type: 'FASTBALL',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 18 * 62,
  frameCount: 18,
  controlTier: 3,
  worldPath: null,
  stageSide: 1,
  ...overrides,
})

const 상황: BattingContext = {
  batter: { hit: 300, power: 300, run: 300, defense: 300 },
  pitcher: { control: 30, velocity: 30 },
  mode: '일반',
  batterSkillIds: [],
  situation: { inning: 1, isLosing: false, runnerCount: 0, hasSecondBaseRunner: false, pitcherSide: 0, batterSide: 0, balls: 0, strikes: 0, batterOrderIndex: 0, recentAtBatCodes: [] },
}

const 고정 = (value: number): RandomPort => createConstantRandom(value)

describe('plateErrorOf — 도착점 − 기준점 + 좌우 이동 (위치 분석 4차 2절)', () => {
  it('존 가운데 공은 오차 0, 오른쪽으로 옮기면 그만큼 더한다', () => {
    expect(plateErrorOf(직구(), 0)).toEqual({ horizontal: 0, vertical: 0 })
    expect(plateErrorOf(직구(), 6)).toEqual({ horizontal: 6, vertical: 0 })
  })

  it('원본 궤적이 있으면 마지막 점을 투영한다 — side1 존 중심은 (0, −1) (0x51226)', () => {
    const 중심 = { x: 20585, y: 1202, z: 29705 }
    const 원본공 = 직구({ worldPath: [{ x: 19501, y: 1110, z: 24500 }, 중심], stageSide: 1 })

    expect(plateErrorOf(원본공, 0)).toEqual({ horizontal: 0, vertical: -1 })
    expect(plateErrorOf(원본공, -9)).toEqual({ horizontal: -9, vertical: -1 })
  })

  it('존 1.0 = 16.5px, 위쪽 공은 세로 오차가 음수', () => {
    expect(plateErrorOf(직구({ plate: { x: 1, y: 1 } }), 0)).toEqual({ horizontal: 17, vertical: -17 })
  })
})

describe('resolvePitch — 스윙하지 않은 경우', () => {
  it('존 안 공을 보내면 루킹 스트라이크, 밖이면 볼', () => {
    const deck = createPatternDeck(고정(0))
    expect(resolvePitch(직구(), null, 상황, deck, 고정(0)).detail.resolution).toEqual({ kind: '스트라이크', isSwinging: false })
    expect(resolvePitch(직구({ plate: { x: 1.5, y: 0 } }), null, 상황, deck, 고정(0)).detail.resolution).toEqual({ kind: '볼' })
  })
})

describe('스트라이크 판정 — 0x3dfac 의 상자 0xcfb7c[side] (경계 포함)', () => {
  /** 판정 좌표 px 가 원하는 값이 되는 도착 x — side 1 존 중심(20585)에서 x 를 옮긴다 */
  const 공 = (x: number) => 직구({ worldPath: [{ x: 19501, y: 1110, z: 24500 }, { x, y: 1202, z: 29705 }], stageSide: 1 })

  it('궤적 마지막 점의 투영이 상자 (221, 310, 33, 33) 안이면 스트라이크', () => {
    expect(isStrikeZonePitch(공(20585))).toBe(true)
    const deck = createPatternDeck(고정(0))
    expect(resolvePitch(공(20585), null, 상황, deck, 고정(0)).detail.resolution).toEqual({ kind: '스트라이크', isSwinging: false })
  })

  it('상자 경계(x = 221 · 254)까지 스트라이크이고 한 칸 밖은 볼이다', () => {
    const pxOf = (x: number) => projectToPlate({ x, y: 1202, z: 29705 }, 1).x
    const 왼끝 = [...Array(4000).keys()].map((i) => 20585 - i).find((x) => pxOf(x) < 221)
    const 오른끝 = [...Array(4000).keys()].map((i) => 20585 + i).find((x) => pxOf(x) > 254)
    expect(왼끝).toBeDefined()
    expect(오른끝).toBeDefined()
    expect(isStrikeZonePitch(공(왼끝! + 1))).toBe(true)
    expect(isStrikeZonePitch(공(왼끝!))).toBe(false)
    expect(isStrikeZonePitch(공(오른끝!))).toBe(false)
    expect(isStrikeZonePitch(공(오른끝! - 1))).toBe(true)
  })

  it('상자는 side 마다 다르다 — side 0 은 (226, 310)', () => {
    expect(STRIKE_ZONE_BOXES[0]).toEqual({ x: 226, y: 310, width: 33, height: 33 })
    expect(STRIKE_ZONE_BOXES[1]).toEqual({ x: 221, y: 310, width: 33, height: 33 })
  })
})

describe('판정 없는 스윙 — 0x6aa 를 안 탄 스윙은 헛스윙 스트라이크 (0x3dfac st[0x10] = S+0xe)', () => {
  it('스윙 수에 들고 굴림 없이 헛스윙 스트라이크다', () => {
    expect(unjudgedSwingDetailOf(8)).toEqual({
      resolution: { kind: '스트라이크', isSwinging: true },
      hasSwung: true,
      isBunt: false,
      resultCode: null,
      contactSoundId: 8,
    })
    expect(unjudgedSwingDetailOf(null).contactSoundId).toBeNull()
  })
})

/** 도착점 하나짜리 궤적 — 판정 좌표는 궤적 마지막 점의 `projectToPlate` 다 (scene+0x10dc/+0x10e0) */
const 도착 = (x: number, y: number, stageSide: number) =>
  직구({ worldPath: [{ x: 19501, y: 1110, z: 24500 }, { x, y, z: 29705 }], stageSide })
const 안굴림: RandomPort = {
  rand: () => {
    throw new Error('사구 판정은 난수를 쓰지 않는다')
  },
  rand9d: () => {
    throw new Error('사구 판정은 난수를 쓰지 않는다')
  },
}

describe('isHitByPitch — 0x35a20 (사각형 0xcfd50 = 171, 240, 38, 130)', () => {
  it('우타(side 0): 판정 x 181 은 상자 [171, 209] 안이라 사구', () => {
    // (18400, 1202, 29705) → side 0 판정 좌표 (181, 325)
    expect(isHitByPitch(도착(18400, 1202, 0), 0)).toBe(true)
  })

  it('좌타(side 1)는 x 를 480 − 171 − 38 = 271 로 뒤집는다 — 같은 상자 [271, 309]', () => {
    // (21450, 1202, 29705) → side 1 판정 좌표 (289, 325)
    expect(isHitByPitch(도착(21450, 1202, 1), 1)).toBe(true)
    // 뒤집지 않은 자리(171~209)는 좌타에게는 사구가 아니다 — side 1 에서 19700 → (186, 325)
    expect(isHitByPitch(도착(19700, 1202, 1), 1)).toBe(false)
  })

  it('경계는 포함이다 (blt/bgt) — 좌타 x 271 은 사구, 268 은 아니다', () => {
    // side 1: 21150 → 271, 21100 → 268
    expect(isHitByPitch(도착(21150, 1202, 1), 1)).toBe(true)
    expect(isHitByPitch(도착(21100, 1202, 1), 1)).toBe(false)
  })

  it('존 한가운데 공은 사구가 아니다', () => {
    expect(isHitByPitch(도착(20585, 1202, 1), 1)).toBe(false)
  })

  it('궤적이 없으면 판정 좌표가 없어 사구도 없다', () => {
    expect(isHitByPitch(직구({ worldPath: null }), 1)).toBe(false)
  })
})

describe('resolvePitch — 사구', () => {
  const 좌타 = { ...상황, situation: { ...상황.situation, batterSide: 1 } }

  it('스윙하지 않았고 상자 안이면 사구 — 볼·스트라이크보다 먼저, 난수 안 씀', () => {
    const deck = createPatternDeck(고정(0))
    const { detail, deck: after } = resolvePitch(도착(21450, 1202, 1), null, 좌타, deck, 안굴림)

    expect(detail.resolution).toEqual({ kind: '사구' })
    expect(detail.hasSwung).toBe(false)
    expect(detail.resultCode).toBeNull()
    expect(after).toBe(deck)
  })

  it('스윙했으면 상자 안이어도 사구가 아니다 (스윙 +0xd · state[0x10])', () => {
    const deck = createPatternDeck(고정(0))
    const { detail } = resolvePitch(도착(21450, 1202, 1), { frame: 0, shift: 0, buntKind: 0 }, 좌타, deck, 고정(0))

    expect(detail.resolution.kind).not.toBe('사구')
  })
})

describe('resolvePitch — 스윙한 경우', () => {
  it('타이밍 0 이면 헛스윙 스트라이크', () => {
    const deck = createPatternDeck(고정(0))
    const { detail } = resolvePitch(직구(), { frame: 0, shift: 0, buntKind: 0 }, 상황, deck, 고정(0))

    expect(detail.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(detail.hasSwung).toBe(true)
    expect(detail.contactSoundId).toBe(8)
  })

  it('필살타법을 실은 헛스윙은 바람 소리가 27 이다 (스윙 +0x10 ≠ 0, 0x5132e) — 예전엔 늘 8', () => {
    const deck = createPatternDeck(고정(0))
    const { detail } = resolvePitch(직구(), { frame: 0, shift: 0, buntKind: 0, isSpecial: true }, 상황, deck, 고정(0))

    expect(detail.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(detail.contactSoundId).toBe(27)
  })

  it('제때(F = N−2) 한가운데를 치면 반드시 맞는다 — 결과는 파울·타구 중 하나', () => {
    const random = createSeededRandom(7)
    let deck = createPatternDeck(random)
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, 상황, deck, random)
      deck = result.deck
      expect(['파울', '타구']).toContain(result.detail.resolution.kind)
    }
  })

  it('맞은 공은 덱에서 실제로 뽑은 패턴을 detail.pattern 으로 싣는다 (0x51408 의 그 한 장)', () => {
    const random = createSeededRandom(7)
    let deck = createPatternDeck(random)
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, 상황, deck, random)
      deck = result.deck
      expect(result.detail.resultCode).not.toBeNull()
      expect(result.detail.pattern).toBe(lastDrawnPattern(result.deck, result.detail.resultCode!))
    }
  })

  it('헛스윙·볼에는 패턴이 없다', () => {
    const deck = createPatternDeck(고정(0))
    expect(resolvePitch(직구(), { frame: 0, shift: 0, buntKind: 0 }, 상황, deck, 고정(0)).detail.pattern).toBeUndefined()
    expect(resolvePitch(직구(), null, 상황, deck, 고정(0)).detail.pattern).toBeUndefined()
  })

  it('성공한 번트만 isBunt', () => {
    const deck = createPatternDeck(고정(0))
    // r100 = 0 → 번트 종류 1 성공(코드 6). 패턴 덱 첫 장은 수평각이 페어라 희생번트
    const { detail } = resolvePitch(직구(), { frame: 17, shift: 0, buntKind: 1 }, 상황, deck, 고정(0))
    if (detail.resolution.kind === '타구') expect(detail.isBunt).toBe(true)
    else expect(detail.resolution.kind).toBe('파울')
  })
})

describe('resolvePitch — 투수 체력%는 공에 실린 깎은 뒤 값 (0x3dec6 → 0xa5e14 가 놓기 · 스윙보다 앞)', () => {
  const 서른번 = (pitch: Pitch, context: BattingContext) => {
    const random = createSeededRandom(11)
    let deck = createPatternDeck(random)
    return Array.from({ length: 30 }, () => {
      const result = resolvePitch(pitch, { frame: 16, shift: 0, buntKind: 0 }, context, deck, random)
      deck = result.deck
      return result.detail
    })
  }
  const 체력 = (staminaPercent: number): BattingContext => ({ ...상황, pitcher: { ...상황.pitcher, staminaPercent } })

  it('공에 깎은 뒤 0% 가 실리면 화면이 넘긴 체력%(100)가 아니라 지친 투수로 판정한다 — ab838 의 +2000', () => {
    const 깎인공 = 서른번(직구({ pitcherStaminaPercent: 0 }), 체력(100))
    expect(깎인공).toEqual(서른번(직구(), 체력(0)))
    expect(깎인공).not.toEqual(서른번(직구(), 체력(100)))
  })
})

describe('resolvePitch — 보정 구조체 0x34d6c 를 판정에 싣는다', () => {
  /** 앞 몇 개만 정하고 나머지는 0.5 */
  const 앞값 = (values: readonly number[]): RandomPort => {
    let index = 0
    return createFractionRandom(() => {
      const value = values[index] ?? 0.5
      index += 1
      return value
    })
  }
  const 덱 = () => createPatternDeck(createSeededRandom(7))
  const 필살 = { batterHit: 220, batterPower: 220, pitcherVelocity: 0, pitcherControl: 0, solidPercent: 20, homeRunPercent: 9 }

  it('같은 난수에서 B 굴림이 보정 없이는 못 넘고 필살 보정으로는 넘는다 — 잘 맞은 타구(15·18·24 계열)가 된다', () => {
    // 번트 r100 → contact 0 → B 0.7 (7000 — 보통 5548 · 필살 7621) → C 0.99 → 15/18 경계
    const 보통 = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, 상황, 덱(), 앞값([0, 0, 0.7, 0.99]))
    const 보정 = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, { ...상황, swingBoost: 필살 }, 덱(), 앞값([0, 0, 0.7, 0.99]))
    expect(보통.detail.resultCode).not.toBeNull()
    expect(보통.detail.resultCode! < 15).toBe(true)
    expect(보정.detail.resultCode! >= 15).toBe(true)
  })
})

describe('resolvePitch — 필살 성공 굴림 0x34c74 → 0x517e6', () => {
  /** 뽑은 횟수를 센다. 값은 늘 같은 v */
  const 세는 = (value: number) => {
    let count = 0
    const random: RandomPort = createFractionRandom(() => {
      count += 1
      return value
    })
    return { random, count: () => count }
  }
  const 덱 = () => createPatternDeck(createSeededRandom(11))
  const 필살상황: BattingContext = { ...상황, specialSwing: { number: 1, isAceBatter: false } }

  it('맞은 페어 공이면 성공 굴림 0x517e6 의 재료를 쏜 공에 싣고 판 시작에 맡긴다 — 여기서는 안 굴린다', () => {
    // 원본 차례: 메시지 0x11(필살수비 · 표시 패턴 · 폴 굴림) 뒤 517e6 — 수비 판 시작(startDefensePlay)이 굴린다
    const 보통 = 세는(0)
    const 필살 = 세는(0)
    const a = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, 필살상황, 덱(), 보통.random)
    const b = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0, isSpecial: true }, 필살상황, 덱(), 필살.random)
    expect(a.detail.resultCode).not.toBeNull()
    expect(a.isUncatchable).toBe(false)
    expect(b.isUncatchable).toBe(false)
    if (b.detail.resolution.kind !== '타구') throw new Error('페어 타구가 아니다')
    expect(contactOfOutcome(b.detail.resolution.outcome)?.specialSwing).toEqual({ number: 1, isAceBatter: false })
    expect(필살.count()).toBe(보통.count())
  })

  it('헛스윙이면 굴리지 않는다 — 0xfd2 == 0 은 0x51840 으로 건너뛴다', () => {
    // 타이밍 54 → contact 6480 이라 0.9999 는 헛스윙
    const 보통 = 세는(0.9999)
    const 필살 = 세는(0.9999)
    const a = resolvePitch(직구(), { frame: 14, shift: 0, buntKind: 0 }, 필살상황, 덱(), 보통.random)
    const b = resolvePitch(직구(), { frame: 14, shift: 0, buntKind: 0, isSpecial: true }, 필살상황, 덱(), 필살.random)
    expect(a.detail.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(b.isUncatchable).toBe(false)
    expect(필살.count()).toBe(보통.count())
  })

  it('파울 각 공도 굴리지 않는다 — 판을 도는 쏜 공(`foulContact`)에 재료를 싣고 판 시작(필살수비 · 폴 굴림 뒤)에 맡긴다', () => {
    let 찾음 = false
    for (const value of [0, 0.3, 0.6, 0.9]) {
      for (let frame = 0; frame <= 30 && !찾음; frame += 1) {
        const 보통 = 세는(value)
        const 필살 = 세는(value)
        const a = resolvePitch(직구(), { frame, shift: 0, buntKind: 0 }, 필살상황, 덱(), 보통.random)
        if (a.detail.resolution.kind !== '파울') continue
        const b = resolvePitch(직구(), { frame, shift: 0, buntKind: 0, isSpecial: true }, 필살상황, 덱(), 필살.random)
        찾음 = true
        expect(b.detail.resolution).toEqual({ kind: '파울' })
        expect(b.isUncatchable).toBe(false)
        expect(필살.count()).toBe(보통.count())
        expect(a.detail.foulContact).toEqual({ pattern: a.detail.pattern, resultCode: a.detail.resultCode })
        expect(b.detail.foulContact?.specialSwing).toEqual({ number: 1, isAceBatter: false })
        expect(b.detail.foulContact?.pattern).toEqual(b.detail.pattern)
      }
    }
    expect(찾음).toBe(true)
  })

  it('보통 스윙은 굴리지 않는다', () => {
    const 필살 = 세는(0)
    expect(resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 0 }, 필살상황, 덱(), 필살.random).isUncatchable).toBe(false)
  })
})

describe('2스트라이크 번트 파울(판정 11)도 판을 도는 파울 각 공이다 — 원본은 판 끝 0x9d5bc 가 11 을 낸다(9d5e2~9d600)', () => {
  it('타석 판정은 아웃을 정하지 않는다 — 스트라이크 0 의 같은 공과 똑같이 쏜 공(`foulContact`)을 싣고 굴림 수도 같다', () => {
    const 이스트 = { ...상황, situation: { ...상황.situation, strikes: 2 } }
    const 센다 = (seed: number) => {
      const seeded = createSeededRandom(seed)
      let count = 0
      const random: RandomPort = {
        rand: (lo, hi) => {
          count += 1
          return seeded.rand(lo, hi)
        },
        rand9d: (n) => {
          count += 1
          return seeded.rand9d(n)
        },
      }
      return { random, count: () => count }
    }
    let 찾음 = false
    for (let seed = 1; seed <= 400 && !찾음; seed += 1) {
      const 앞 = 센다(seed)
      const a = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 1 }, 상황, createPatternDeck(createSeededRandom(seed)), 앞.random)
      if (a.detail.resolution.kind !== '파울') continue
      const 뒤 = 센다(seed)
      const b = resolvePitch(직구(), { frame: 16, shift: 0, buntKind: 1 }, 이스트, createPatternDeck(createSeededRandom(seed)), 뒤.random)
      찾음 = true
      expect(b.detail).toEqual(a.detail)
      expect(b.detail.foulContact).toEqual({ pattern: b.detail.pattern, resultCode: b.detail.resultCode })
      expect('isBuntFoulOut' in b.detail).toBe(false)
      expect(b.isUncatchable).toBe(false)
      expect(뒤.count()).toBe(앞.count())
    }
    expect(찾음).toBe(true)
  })
})
