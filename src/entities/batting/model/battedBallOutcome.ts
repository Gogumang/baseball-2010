import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 결과 코드 → 원본 타구 패턴 → 안타·아웃.
 * 원본은 패턴(a 수평각, b 속도, c 높이)으로 공을 굴리고 수비수가 실제로 잡는 시뮬레이션(0xa28c0)이라
 * 결과표가 없다. 아래 판정은 위치 분석 4차가 패턴 분포로 만든 **대체 근사이며 전부 추정**이다.
 */
export type BattedBallResult =
  | { readonly kind: '파울' }
  /** isBunt 는 번트 성공(코드 6~8) — 미션 번트 목표에 쓴다 */
  | { readonly kind: '타구'; readonly outcome: AtBatOutcome; readonly isBunt: boolean }

/**
 * 수평각은 생성기가 저장한 원시값(w >> 23)으로 본다. 원본은 저장할 때 a 를 음수로 뒤집고
 * plag 비트0 이면 높이 c 도 뒤집지만(0xb0614), 페어 범위 45~135 는 원시값 분포로 확인한 것이라 그대로 둔다.
 * 부호는 타구 연출(좌우·위아래)에만 필요하다 — 타구 비행 연출은 아직 없다.
 */
const FAIR_ANGLE = { minimum: 45, maximum: 135 }
const EDGE_ANGLE = { left: 60, right: 120 }
const FLY_HIT_PERCENT = 15
const GROUP_SIZE = 3

const fair = (outcome: AtBatOutcome, isBunt = false): BattedBallResult => ({ kind: '타구', outcome, isBunt })
const single = fair({ kind: '안타', bases: 1 })
const double = fair({ kind: '안타', bases: 2 })
const groundOut = fair({ kind: '아웃', detail: '땅볼아웃' })
const flyOut = fair({ kind: '아웃', detail: '뜬공아웃' })
const lineOut = fair({ kind: '아웃', detail: '직선타아웃' })

export function outcomeOfPattern(code: number, pattern: BattedBallPattern, random: RandomPort): BattedBallResult {
  const [angle, speed] = pattern
  if (angle < FAIR_ANGLE.minimum || angle > FAIR_ANGLE.maximum) return { kind: '파울' }
  switch (code - (code % GROUP_SIZE)) {
    case 0:
      if (speed < 800) return flyOut
      return randomIntegerBelow(random, 0, 100) < FLY_HIT_PERCENT ? single : flyOut
    case 3:
      return speed >= 950 ? single : groundOut
    case 6:
      // 희생번트 — 타자는 죽고 주자는 한 베이스 간다 (땅볼 아웃 진루 규칙을 쓴다)
      return fair({ kind: '아웃', detail: '땅볼아웃' }, true)
    case 9:
      return { kind: '파울' }
    case 12:
      return flyOut
    case 15:
      return speed >= 1100 ? double : speed >= 800 ? single : lineOut
    case 18: {
      const isEdge = angle < EDGE_ANGLE.left || angle > EDGE_ANGLE.right
      if (speed >= 1450 && isEdge) return fair({ kind: '안타', bases: 3 })
      if (speed >= 1300) return double
      return speed >= 900 ? single : flyOut
    }
    default:
      return speed >= 1100 ? fair({ kind: '홈런' }) : double
  }
}

/** 코드마다 섞어 둔 패턴 순서와 다음에 꺼낼 위치 */
export interface PatternDeck {
  readonly orders: Readonly<Record<number, readonly number[]>>
  readonly cursors: Readonly<Record<number, number>>
}

/** 0xb0614 — i 마다 j = rand(0, n) 을 뽑아 i ≠ j 면 바꾼다 */
function shuffledOrder(size: number, random: RandomPort): number[] {
  const order = Array.from({ length: size }, (_unused, index) => index)
  for (let index = 0; index < size; index += 1) {
    const other = randomIntegerBelow(random, 0, size)
    if (other !== index) [order[index], order[other]] = [order[other], order[index]]
  }
  return order
}

export function createPatternDeck(random: RandomPort): PatternDeck {
  const orders: Record<number, number[]> = {}
  const cursors: Record<number, number> = {}
  for (const [code, patterns] of Object.entries(BATTED_BALL_PATTERNS)) {
    orders[Number(code)] = shuffledOrder(patterns.length, random)
    cursors[Number(code)] = 0
  }
  return { orders, cursors }
}

/** 덱 없이 한 장 — 투수편 CPU 타자처럼 덱을 들고 있지 않은 곳에서 쓴다 (추정) */
export function randomPattern(code: number, random: RandomPort): BattedBallPattern {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined || patterns.length === 0) throw new Error(`타구 패턴이 없는 결과 코드입니다: ${code}`)
  return patterns[randomIntegerBelow(random, 0, patterns.length)]
}

/** 다음 패턴. 다 쓰면 그 코드만 다시 섞는다 (다시 섞는 시점은 추정) */
export function drawPattern(
  deck: PatternDeck,
  code: number,
  random: RandomPort,
): { readonly pattern: BattedBallPattern; readonly deck: PatternDeck } {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined || patterns.length === 0) throw new Error(`타구 패턴이 없는 결과 코드입니다: ${code}`)
  const cursor = deck.cursors[code] ?? 0
  const order = cursor < (deck.orders[code]?.length ?? 0) ? deck.orders[code] : shuffledOrder(patterns.length, random)
  const position = cursor < (deck.orders[code]?.length ?? 0) ? cursor : 0
  return {
    pattern: patterns[order[position]],
    deck: {
      orders: { ...deck.orders, [code]: order },
      cursors: { ...deck.cursors, [code]: position + 1 },
    },
  }
}
