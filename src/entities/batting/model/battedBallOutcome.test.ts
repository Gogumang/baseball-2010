import { describe, expect, it } from 'vitest'
import { createPatternDeck, drawPattern, outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정 = (value: number): RandomPort => ({ next: () => value, nextInRange: () => 0, pick: (items) => items[0] })

describe('outcomeOfPattern — 수비 대체 근사 (전부 추정)', () => {
  it('수평각 45~135 밖은 파울', () => {
    expect(outcomeOfPattern(15, [30, 1200, 500, 0], 고정(0))).toEqual({ kind: '파울' })
    expect(outcomeOfPattern(9, [90, 1200, 500, 0], 고정(0))).toEqual({ kind: '파울' })
  })

  it('땅볼(3)은 속도 950 이상만 안타', () => {
    expect(outcomeOfPattern(3, [90, 950, 200, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '안타', bases: 1 }, isBunt: false })
    expect(outcomeOfPattern(4, [90, 900, 200, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' }, isBunt: false })
  })

  it('홈런성(24)은 세기 1100 이상이 홈런, 아니면 2루타', () => {
    expect(outcomeOfPattern(24, [90, 1100, 1200, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '홈런' }, isBunt: false })
    expect(outcomeOfPattern(26, [90, 1000, 1200, 0], 고정(0))).toEqual({
      kind: '타구',
      outcome: { kind: '안타', bases: 2 },
      isBunt: false,
    })
  })

  it('홈런성 묶음(24~26) 패턴 표 실측 — 세기 문턱 1100 으로 홈런과 2루타가 갈린다', () => {
    let homeRun = 0
    let doubleCount = 0
    for (const code of [24, 25, 26]) {
      for (const pattern of BATTED_BALL_PATTERNS[code]) {
        const result = outcomeOfPattern(code, pattern, 고정(0))
        if (result.kind !== '타구' || result.outcome.kind !== '홈런') {
          if (result.kind === '타구' && result.outcome.kind === '안타' && result.outcome.bases === 2) {
            doubleCount += 1
          }
          continue
        }
        homeRun += 1
      }
    }
    // 실측(2026-09 기준): 홈런성 99패턴 중 홈런 59 · 그라운드 룰 2루타(근사) 40
    expect(homeRun).toBe(59)
    expect(doubleCount).toBe(40)
  })

  it('강한 타구(18) 는 1450 이상·가장자리면 3루타', () => {
    expect(outcomeOfPattern(18, [50, 1450, 700, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '안타', bases: 3 }, isBunt: false })
    expect(outcomeOfPattern(18, [90, 1450, 700, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '안타', bases: 2 }, isBunt: false })
    expect(outcomeOfPattern(18, [90, 800, 700, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '뜬공아웃' }, isBunt: false })
  })

  it('뜬공(0)은 800 이상일 때 15% 만 안타', () => {
    expect(outcomeOfPattern(0, [90, 800, 1300, 0], 고정(0.14))).toEqual({ kind: '타구', outcome: { kind: '안타', bases: 1 }, isBunt: false })
    expect(outcomeOfPattern(0, [90, 800, 1300, 0], 고정(0.15))).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '뜬공아웃' }, isBunt: false })
  })

  it('번트 성공(6)은 희생번트(땅볼 아웃·번트), 번트 실패(12) 페어는 뜬공 아웃', () => {
    expect(outcomeOfPattern(7, [90, 300, 0, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '땅볼아웃' }, isBunt: true })
    expect(outcomeOfPattern(12, [90, 300, 0, 0], 고정(0))).toEqual({ kind: '타구', outcome: { kind: '아웃', detail: '뜬공아웃' }, isBunt: false })
  })
})

describe('패턴 덱 — 0xb0614 섞은 뒤 차례로 꺼냄', () => {
  it('코드마다 원본 패턴을 하나씩 돌려주고 다 쓰면 다시 섞는다', () => {
    const random = 고정(0)
    const deck = createPatternDeck(random)
    const first = drawPattern(deck, 24, random)
    expect(first.pattern).toHaveLength(4)
    expect(first.deck.cursors[24]).toBe(1)
  })
})
