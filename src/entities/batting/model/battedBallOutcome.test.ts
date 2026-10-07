import { describe, expect, it } from 'vitest'
import {
  contactOfPattern,
  createPatternDeck,
  displayPatternListOf,
  displayPatternOf,
  drawPattern,
  isFairAngle,
  launchPatternOf,
  openScenePatternDeck,
  rollSceneEffectInit,
  SCENE_EFFECT_INIT_ROLL_COUNT,
} from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const 고정 = (value: number): RandomPort => ({ next: () => value, nextInRange: () => 0, pick: (items) => items[0] })

/** rand(a, b) 를 차례대로 내주는 난수 — `randomIntegerBelow` 는 next() 를 [a, b) 로 늘인다 */
const 차례 = (...values: number[]): RandomPort & { readonly used: () => number } => {
  let index = 0
  return {
    next: () => values[index++] ?? 0,
    nextInRange: () => 0,
    pick: (items) => items[0],
    used: () => index,
  }
}

describe('contactOfPattern — 파울 각(0x9d660)만 가르고 결과는 판으로 넘긴다', () => {
  it('수평각 45~135 밖은 파울 — 양끝은 페어다', () => {
    expect(contactOfPattern(15, [30, 1200, 500, 0])).toEqual({ kind: '파울' })
    expect(contactOfPattern(9, [44, 1200, 500, 0])).toEqual({ kind: '파울' })
    expect(contactOfPattern(9, [45, 1200, 500, 0])).toEqual({ kind: '타구', isBunt: false })
    expect(contactOfPattern(9, [135, 1200, 500, 0])).toEqual({ kind: '타구', isBunt: false })
    expect(isFairAngle(136)).toBe(false)
  })

  it('페어 각이면 결과 코드와 상관없이 판으로 간다 — 안타·아웃·홈런을 여기서 정하지 않는다', () => {
    for (const code of [0, 3, 15, 18, 24]) {
      expect(contactOfPattern(code, [90, 1100, 1200, 0])).toEqual({ kind: '타구', isBunt: false })
    }
  })

  it('번트 성공 코드(6~8)의 페어 타구만 번트 표시가 선다', () => {
    expect(contactOfPattern(7, [90, 300, 0, 0])).toEqual({ kind: '타구', isBunt: true })
    expect(contactOfPattern(12, [90, 300, 0, 0])).toEqual({ kind: '타구', isBunt: false })
  })

  it('난수를 한 톨도 안 쓴다 — 예전 웹의 "뜬공 15% 안타" 굴림(원본에 없다)은 걷었다', () => {
    const random = 차례(0.5, 0.5)
    // 시그니처에 난수가 없다 — 판정만으로는 결과를 고르지 않는다
    expect(contactOfPattern(0, [90, 800, 1300, 0])).toEqual({ kind: '타구', isBunt: false })
    expect(random.used()).toBe(0)
  })
})

describe('2스트라이크 번트 파울 아웃 (0x9d5e2~0x9d600)', () => {
  /** 번트 코드에서 실제로 파울이 되는 패턴 — 표에서 그대로 골랐다 (각이 45~135 밖) */
  const 번트파울패턴 = BATTED_BALL_PATTERNS[6].find((pattern) => pattern[0] < 45 || pattern[0] > 135)!

  it('2스트라이크에서 낸 번트가 파울이면 판정 11 이다', () => {
    expect(contactOfPattern(6, 번트파울패턴, { strikes: 2, buntKind: 1 })).toEqual({ kind: '번트파울아웃' })
  })

  it('스트라이크가 1 이하이거나 번트가 아니면 그냥 파울이다 — 원본 두 조건 그대로', () => {
    expect(contactOfPattern(6, 번트파울패턴, { strikes: 1, buntKind: 1 })).toEqual({ kind: '파울' })
    expect(contactOfPattern(6, 번트파울패턴, { strikes: 2, buntKind: 0 })).toEqual({ kind: '파울' })
    expect(contactOfPattern(6, 번트파울패턴)).toEqual({ kind: '파울' })
  })

  it('페어로 간 번트는 2스트라이크여도 판으로 간다', () => {
    expect(contactOfPattern(6, [90, 300, 0, 0], { strikes: 2, buntKind: 1 })).toEqual({ kind: '타구', isBunt: true })
  })

  /**
   * 원본 패턴 표 전수 — 번트 코드에서 파울이 나오는 비율. 덱은 섞은 차례를 한 바퀴씩 돌리므로
   * 길게 보면 표의 비율 그대로다.
   */
  it('번트 코드 패턴 표 실측 — 성공 코드는 7.4%, 실패 코드는 62.5% 가 파울이다', () => {
    const 파울수 = (code: number) =>
      BATTED_BALL_PATTERNS[code].filter((pattern) => contactOfPattern(code, pattern).kind === '파울').length

    expect([6, 7, 8].map(파울수)).toEqual([3, 2, 3])
    expect([6, 7, 8].map((code) => BATTED_BALL_PATTERNS[code].length)).toEqual([40, 35, 33])
    expect([12, 13, 14].map(파울수)).toEqual([10, 20, 20])
    expect([12, 13, 14].map((code) => BATTED_BALL_PATTERNS[code].length)).toEqual([20, 30, 30])
  })
})

describe('패턴 덱 — 0xb0614 로 한 번 섞고 0xb0930 · 0xb0938 로 차례로 꺼낸다', () => {
  it('코드마다 원본 패턴을 하나씩 돌려준다', () => {
    const random = 고정(0)
    const deck = createPatternDeck(random)
    const first = drawPattern(deck, 24, random)
    expect(first.pattern).toHaveLength(4)
    expect(first.deck.cursors[24]).toBe(1)
  })

  it('다 쓰면 **다시 섞지 않고** 같은 차례를 처음부터 다시 돈다 — 0xb0938 은 커서를 0 으로 되돌릴 뿐이다', () => {
    const deck = createPatternDeck(고정(0.37))
    const size = BATTED_BALL_PATTERNS[25].length
    const random = 차례()
    let current = deck
    const 첫바퀴 = []
    for (let index = 0; index < size; index += 1) {
      const drawn = drawPattern(current, 25, random)
      첫바퀴.push(drawn.pattern)
      current = drawn.deck
    }
    const 둘째바퀴 = []
    for (let index = 0; index < size; index += 1) {
      const drawn = drawPattern(current, 25, random)
      둘째바퀴.push(drawn.pattern)
      current = drawn.deck
    }
    expect(둘째바퀴).toEqual(첫바퀴)
    // 꺼내기는 난수를 쓰지 않는다 (예전 웹은 다 쓴 코드를 다시 섞어 n 번 굴렸다)
    expect(random.used()).toBe(0)
  })
})

describe('특수 타구 표 0xcfb3c — 결과 코드 25 · 26 의 2% (0x514f2 ~ 0x5152c)', () => {
  const 덱패턴 = [90, 1300, 600, 2] as const

  it('rand(0,1000) ≤ 19 면 rand(0,4) 로 표의 한 줄을 쏜다 — 각은 파울선 위(45 · 135), 덱 패턴의 비트 1 은 남는다', () => {
    // 19/1000 → 19 ≤ 19 · 3/4 → 3번째 줄 (−45, 1200, 1200)
    expect(launchPatternOf(25, 덱패턴, 차례(0.0195, 0.75))).toEqual([45, 1200, 1200, 2])
    expect(launchPatternOf(26, [90, 1300, 600, 0], 차례(0, 0))).toEqual([135, 726, 1850, 0])
  })

  it('20 이상이면 덱 패턴 그대로 — 굴림은 하나만 먹는다', () => {
    const random = 차례(0.02)
    expect(launchPatternOf(25, 덱패턴, random)).toBe(덱패턴)
    expect(random.used()).toBe(1)
  })

  it('다른 코드는 굴리지 않는다', () => {
    const random = 차례(0)
    expect(launchPatternOf(24, 덱패턴, random)).toBe(덱패턴)
    expect(random.used()).toBe(0)
  })
})

describe('필살수비 표시 패턴 — 덱 목록 0xb086c(비트 2) · 0xb07ec(비트 3) · 바꿔 쏘기 0xb097c · 0xb09ac', () => {
  const 덱 = createPatternDeck(createSeededRandom(7))

  it('섞인 덱 차례(코드 0→26, 자리 0→n−1)로 비트 2 · 비트 3 패턴만 모은다 — 원본 표는 7 개 · 18 개', () => {
    const 점프 = displayPatternListOf(덱, 'jump')
    const 슬라이딩 = displayPatternListOf(덱, 'slide')
    expect(점프).toHaveLength(7)
    expect(슬라이딩).toHaveLength(18)
    expect(점프.every((pattern) => (pattern[3] & 4) !== 0)).toBe(true)
    expect(슬라이딩.every((pattern) => (pattern[3] & 8) !== 0)).toBe(true)
    // 차례는 섞인 자리를 따른다 — 같은 코드 안의 두 비트 2 패턴(코드 18 · 19)은 덱 order 의 앞뒤대로 놓인다
    const 자리 = (code: number, pattern: readonly number[]) =>
      덱.orders[code].findIndex((index) => BATTED_BALL_PATTERNS[code][index] === pattern)
    for (const code of [18, 19]) {
      const 이코드 = 점프.filter((pattern) => BATTED_BALL_PATTERNS[code].includes(pattern))
      expect(이코드).toHaveLength(2)
      expect(자리(code, 이코드[0])).toBeLessThan(자리(code, 이코드[1]))
    }
  })

  it('rand(0, 개수) 로 한 장을 골라 (a, b, c) 만 덮는다 — 높이 부호 비트 0 은 바꾼 패턴 것, 낙구 쫓기 비트 1 은 쏜 패턴 것', () => {
    const 점프 = displayPatternListOf(덱, 'jump')
    const 쏜 = [90, 900, 350, 2] as const
    const 첫 = displayPatternOf(덱, 'jump', 쏜, 고정(0))
    expect(첫.slice(0, 3)).toEqual(점프[0].slice(0, 3))
    expect(첫[3]).toBe((점프[0][3] & 1) | 2)
    const 끝 = displayPatternOf(덱, 'jump', [90, 900, 350, 0], 고정(0.999))
    expect(끝.slice(0, 3)).toEqual(점프[점프.length - 1].slice(0, 3))
    expect(끝[3] & 2).toBe(0)
  })
})

describe('장면 초기화 0x3e340 — 덱 섞기 3ed76 뒤 효과 객체 3ef6e 0x90190(종류 0)', () => {
  it('rand 2 + 200 × 6 = 1202 번을 덱 섞기 바로 뒤에 굴린다 — 값은 버려진다', () => {
    let 수 = 0
    const 씨 = createSeededRandom(5)
    const random: RandomPort = { ...씨, next: () => { 수 += 1; return 씨.next() } }
    rollSceneEffectInit(random)
    expect(SCENE_EFFECT_INIT_ROLL_COUNT).toBe(1202)
    expect(수).toBe(1202)

    수 = 0
    openScenePatternDeck(random)
    const 덱굴림 = Object.values(BATTED_BALL_PATTERNS).reduce((sum, patterns) => sum + patterns.length, 0)
    expect(수).toBe(덱굴림 + 1202)
  })
})
