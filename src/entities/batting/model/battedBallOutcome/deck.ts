import type { RandomPort } from '@/shared/api/random/randomPort'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/** 코드마다 섞어 둔 패턴 순서와 다음에 꺼낼 위치 */
export interface PatternDeck {
  readonly orders: Readonly<Record<number, readonly number[]>>
  readonly cursors: Readonly<Record<number, number>>
}

/** 0xb0614 — i 마다 j = rand(0, n) 을 뽑아 i ≠ j 면 바꾼다 */
function rollShuffledOrder(size: number, random: RandomPort): number[] {
  const order = Array.from({ length: size }, (_unused, index) => index)
  for (let index = 0; index < size; index += 1) {
    const other = random.rand(0, size)
    if (other !== index) [order[index], order[other]] = [order[other], order[index]]
  }
  return order
}

export function createPatternDeck(random: RandomPort): PatternDeck {
  const orders: Record<number, number[]> = {}
  const cursors: Record<number, number> = {}
  for (const [code, patterns] of Object.entries(BATTED_BALL_PATTERNS)) {
    orders[Number(code)] = rollShuffledOrder(patterns.length, random)
    cursors[Number(code)] = 0
  }
  return { orders, cursors }
}

/**
 * ⚠️ 웹 전용 — 덱 없이 한 장. 장면 덱(`openScenePatternDeck`)을 열지 않은 호출(시험 · 장면 없는 옛 길)만 쓴다.
 * 원본에는 이 굴림이 없다 — 사람 · CPU 타자 모두 장면 덱(장면 +0x19cc)에서 꺼낸다(0x51490).
 */
export function randomPattern(code: number, random: RandomPort): BattedBallPattern {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined || patterns.length === 0) throw new Error(`타구 패턴이 없는 결과 코드입니다: ${code}`)
  return patterns[random.rand(0, patterns.length)]
}

/**
 * 방금 뽑은 패턴 — `drawPattern` 이 돌려준 덱에서 되읽는다.
 *
 * 타석 화면이 큰 타구 판정(0x392ac)에 쓸 (각·세기·높이) 를 알아야 하는데 `resolvePitch` 는
 * 패턴을 밖으로 내보내지 않는다. 덱의 커서가 **방금 쓴 칸의 바로 뒤**를 가리키므로
 * 난수를 더 쓰지 않고 그대로 되읽을 수 있다.
 */
export function lastDrawnPattern(deck: PatternDeck, code: number): BattedBallPattern | null {
  const patterns = BATTED_BALL_PATTERNS[code]
  const order = deck.orders[code]
  const cursor = deck.cursors[code] ?? 0
  if (patterns === undefined || order === undefined || cursor <= 0) return null
  return patterns[order[cursor - 1]] ?? null
}

/**
 * 다음 패턴 — 타구 시작 `0x51408` 의 덱 꺼내기 (직접 뜬 것):
 * ```
 * 51490  i = 0xb0930(덱, 코드)              ; 커서 [덱 + 코드 + 0xc]
 * 5149e  a = 0xb0b00(덱, 코드, i) · b = 0xb0ab8 · c = 0xb0a50 · 514cc 0xb07c8 (플래그 비트 1 → +0x127)
 * 514e8  0xb0938(덱, 코드)                   ; 커서 + 1, 개수 이상이면 0 — **다시 섞지 않는다**
 * ```
 * 섞기 `0xb0614` 는 덱을 만들 때(장면 초기화 0x3e340 → 0xb08e8) 한 번뿐이다 — 다 쓴 코드는 같은 순서를 처음부터 다시 돈다.
 * (예전 웹은 다 쓰면 그 코드만 다시 섞었다 — 원본에 없는 굴림이었다.)
 */
export function drawPattern(
  deck: PatternDeck,
  code: number,
  _random?: RandomPort,
): { readonly pattern: BattedBallPattern; readonly deck: PatternDeck } {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined || patterns.length === 0) throw new Error(`타구 패턴이 없는 결과 코드입니다: ${code}`)
  const order = deck.orders[code] ?? Array.from({ length: patterns.length }, (_unused, index) => index)
  const cursor = deck.cursors[code] ?? 0
  const position = cursor < order.length ? cursor : 0
  const next = position + 1
  return {
    pattern: patterns[order[position]],
    deck: {
      orders: deck.orders[code] === undefined ? { ...deck.orders, [code]: order } : deck.orders,
      // 0xb0938 — `+1` 이 개수 이상이면 0 (lastDrawnPattern 이 되읽도록 커서는 "방금 쓴 칸 + 1" 로 둔다)
      cursors: { ...deck.cursors, [code]: next },
    },
  }
}
