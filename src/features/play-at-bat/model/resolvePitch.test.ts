import { describe, expect, it } from 'vitest'
import { isHitByPitch, plateErrorOf, resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingContext } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

const 고정 = (value: number): RandomPort => ({ next: () => value, nextInRange: () => 0, pick: (items) => items[0] })

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

/** 도착점 하나짜리 궤적 — 판정 좌표는 궤적 마지막 점의 `projectToPlate` 다 (scene+0x10dc/+0x10e0) */
const 도착 = (x: number, y: number, stageSide: number) =>
  직구({ worldPath: [{ x: 19501, y: 1110, z: 24500 }, { x, y, z: 29705 }], stageSide })
const 안굴림: RandomPort = {
  next: () => {
    throw new Error('사구 판정은 난수를 쓰지 않는다')
  },
  nextInRange: () => {
    throw new Error('사구 판정은 난수를 쓰지 않는다')
  },
  pick: () => {
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

  it('성공한 번트만 isBunt', () => {
    const deck = createPatternDeck(고정(0))
    // r100 = 0 → 번트 종류 1 성공(코드 6). 패턴 덱 첫 장은 수평각이 페어라 희생번트
    const { detail } = resolvePitch(직구(), { frame: 17, shift: 0, buntKind: 1 }, 상황, deck, 고정(0))
    if (detail.resolution.kind === '타구') expect(detail.isBunt).toBe(true)
    else expect(detail.resolution.kind).toBe('파울')
  })
})

describe('resolvePitch — 보정 구조체 0x34d6c 를 판정에 싣는다', () => {
  /** 앞 몇 개만 정하고 나머지는 0.5 */
  const 앞값 = (values: readonly number[]): RandomPort => {
    let index = 0
    return {
      next: () => {
        const value = values[index] ?? 0.5
        index += 1
        return value
      },
      nextInRange: () => 0,
      pick: (items) => items[0],
    }
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
