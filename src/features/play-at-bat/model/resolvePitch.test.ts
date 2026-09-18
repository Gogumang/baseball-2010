import { describe, expect, it } from 'vitest'
import { plateErrorOf, resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
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

describe('resolvePitch — 스윙한 경우', () => {
  it('타이밍 0 이면 헛스윙 스트라이크', () => {
    const deck = createPatternDeck(고정(0))
    const { detail } = resolvePitch(직구(), { frame: 0, shift: 0, buntKind: 0 }, 상황, deck, 고정(0))

    expect(detail.resolution).toEqual({ kind: '스트라이크', isSwinging: true })
    expect(detail.hasSwung).toBe(true)
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
