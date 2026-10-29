import type { RandomPort } from '@/shared/api/random/randomPort'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome/deck'

/** 패턴 플래그 비트 0 — c 부호 반전 (0xb07b4) */
export const HEIGHT_SIGN_FLAG = 1
/** 패턴 플래그 비트 1 — 0xb07c8 이 덱 패턴에서 이미 +0x127 을 세운 뒤라 특수 표로 바꿔도 남는다 */
export const LANDING_CHASE_FLAG = 2

/**
 * **필살수비 표시 패턴 목록 두 개** — 덱을 섞은 바로 뒤(0xb08e8: 0xb0614 섞기 → 0xb086c → 0xb07ec) 섞인 차례로 모은다 (직접 뜬 것):
 * ```
 * b086c  목록 A(덱+0x28, 칸 8바이트 = (코드, 자리), 개수 덱+0xc8) — 코드 0..26 · 자리 0..n−1 차례로 플래그(0xb07dc) 비트 2(lsls #0x1d)면
 *        넣는다. 20 개(0x14)가 차면 두 겹 고리를 통째로 끝낸다
 * b07ec  목록 B(덱+0xcc, 개수 덱+0x1bc) — 같은 차례로 비트 3(lsls #0x1c), 30 개(0x1e)에서 끝
 * ```
 * 자리는 섞인 덱의 자리다 — 섞기 0xb0614 가 패턴 워드와 플래그 바이트를 함께 바꾸므로(b06d6~b0712) 웹 덱의 `order` 를 따라
 * 원본 표를 읽으면 같은 패턴이다. 원본 표에서 비트 2 는 7 개, 비트 3 은 18 개(파울 각 6 개 포함)라 둘 다 상한에 안 닿는다.
 */
const DISPLAY_LISTS = {
  jump: { flag: 4, limit: 20 },
  slide: { flag: 8, limit: 30 },
} as const
/** 덱 고리의 마지막 코드 (b0858 · b08d6 `cmp #0x1a ; ble`) */
const LAST_DECK_CODE = 26

export type DisplayPatternKind = keyof typeof DISPLAY_LISTS

/** 0xb086c(점프 · 비트 2) / 0xb07ec(슬라이딩 · 비트 3) 가 만든 목록 — 섞인 덱 차례의 패턴들 */
export function displayPatternListOf(deck: PatternDeck, kind: DisplayPatternKind): readonly BattedBallPattern[] {
  const { flag, limit } = DISPLAY_LISTS[kind]
  const list: BattedBallPattern[] = []
  for (let code = 0; code <= LAST_DECK_CODE; code += 1) {
    list.push(...flaggedPatternsOf(deck, code, flag))
    if (list.length >= limit) return list.slice(0, limit)
  }
  return list
}

/** 한 코드의 패턴을 섞인 덱 차례로 훑어 플래그 비트가 선 것만 */
function flaggedPatternsOf(deck: PatternDeck, code: number, flag: number): BattedBallPattern[] {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined) return []
  const order = deck.orders[code] ?? patterns.map((_pattern, index) => index)
  const flagged: BattedBallPattern[] = []
  for (let position = 0; position < patterns.length; position += 1) {
    const pattern = patterns[order[position]]
    if ((pattern[3] & flag) !== 0) flagged.push(pattern)
  }
  return flagged
}

/**
 * **필살수비가 열린 공의 표시 패턴** — 메시지 0x11 의 5107c(점프 → 0xb097c) · 5112c(슬라이딩 → 0xb09ac) (직접 뜬 것):
 * ```
 * b097c  i = rand(0, 개수 덱+0xc8) ; (코드, 자리) = 덱+0x28[i]        ; 0xb09ac 는 rand(0, 덱+0x1bc) · 덱+0xcc[i]
 * 51090  a = 0xb0b00(덱, 코드, 자리) · b = 0xb0ab8 · c = 0xb0a50(비트 0 이면 부호 반전) → 쏠 패턴 (sp+0x98) 을 덮는다
 * ```
 * 덮는 것은 (a, b, c) 셋뿐이다 — 플래그 비트 1(+0x127 낙구 쫓기)은 덱 패턴에서 514cc 가 이미 세웠고 커서도 그대로다.
 * c 의 부호는 바꿔 넣은 패턴의 비트 0 을 따른다(0xb0a50 → 0xb07b4). 목록이 비면 rand(0, 0) = 0 으로 지운 칸(코드 0 · 자리 0)을 읽는다.
 */
export function displayPatternOf(deck: PatternDeck, kind: DisplayPatternKind, shot: BattedBallPattern, random: RandomPort): BattedBallPattern {
  const list = displayPatternListOf(deck, kind)
  const index = random.rand(0, list.length)
  const shown = list[index] ?? BATTED_BALL_PATTERNS[0][(deck.orders[0] ?? [0])[0]]
  return [shown[0], shown[1], shown[2], (shown[3] & HEIGHT_SIGN_FLAG) | (shot[3] & LANDING_CHASE_FLAG)]
}
