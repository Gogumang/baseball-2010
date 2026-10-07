import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * ============================================================================
 * **맞은 공 하나 — 파울인가, 판(상태 0x17)으로 갈 타구인가** (원본 흐름, 직접 뜬 것)
 * ============================================================================
 *
 * 원본은 결과(안타·아웃·홈런)를 타석 쪽에서 **정하지 않는다**. 맞은 공은 이렇게 간다:
 * ```
 * 51308  0xab214 스윙 판정 → 결과 코드(+0xfd4) · 맞음(+0xfd2)            ; 못 맞히면 0x51840 (헛스윙)
 * 51366  코드 ∈ {0,3,9,15,18,21,24} 이면 + 방향 0x9d728                     ; `hitDirectionOf`
 * 51490  덱에서 패턴 (a, b, c) · +0x127 · 커서 + 1                          ; `drawPattern`
 * 514f2  코드 25 · 26 의 2% 특수 타구 표 0xcfb3c                              ; `launchPatternOf`
 * 515c6  메시지 0x11 → 0x50faa: 필살수비 굴림 · (열리면 표시 패턴으로 바꿔 쏨) · 51188 공.vt44(b, c, a) 쏘기 ·
 *        511b8 state[0x1c] = 0x9d660(a) (파울 각) · state[7] = 0x9d640(a)
 * 517e6  필살타법 성공 굴림 0x34c74 → 0xaf180(공, 4) "송구공" 표시
 * …      상태 0x13(감상) → 0x17 수비 판 — 안타·아웃·홈런·파울 뜬공 아웃은 **판이** 낸다(`features/defense-play`)
 * ```
 * 그래서 여기서 정하는 것은 **각 하나로 갈리는 파울**(state[0x1c], 0x9d660)과 2스트라이크 번트 파울 아웃(판정 11)뿐이다.
 * 페어 각의 공은 `'타구'` 로 넘기고, 결과는 진행기의 판 끝 정산(`features/defense-play/model/playOutcome`)이 낸다.
 *
 * ⚠️ 남은 어긋남(웹): 파울 각의 공도 원본은 판을 돈다 — 낙구·담장선 틱에 0x9d5bc 가 7(파울)을 내기 **전에** 야수가 쥐면
 * 뜬공 아웃(13)이다. 웹은 파울 각을 여기서 곧장 파울로 끝내 **파울 뜬공 아웃이 없다**(타석 화면이 파울을 판 없이 넘기므로).
 */
export type BattedBallContact =
  | { readonly kind: '파울' }
  /** 2스트라이크 번트 파울 아웃 — 원본 판정 11 (`buntFoulOut`) */
  | { readonly kind: '번트파울아웃' }
  /** 페어 각의 타구 — 판으로 간다. isBunt 는 번트 성공 코드(6~8)다 (미션 번트 목표) */
  | { readonly kind: '타구'; readonly isBunt: boolean }

/**
 * 페어/파울 문턱은 **원본과 같은 식이다** (S2 확정). 원본 `0x9d660` 은 각도 하나만 보고
 * `(unsigned)(a + 135) <= 90`, 즉 **−135 ≤ a ≤ −45 (양끝 포함)** 이다. 여기 45~135 는
 * 부호만 뒤집은 같은 범위이고 양끝도 똑같이 포함한다 — 좌표·거리·폴 접촉은 원본도 보지 않는다.
 * (양끝을 **제외**하는 쪽은 담장·필살 판정 `0x36140` 이라 이 함수와 무관하다.)
 */
const FAIR_ANGLE = { minimum: 45, maximum: 135 }
/** 번트 성공 코드 6~8 (0xab214 의 번트 갈래) */
const BUNT_CODES = { minimum: 6, maximum: 8 }

/**
 * 원본 `0x9d5bc` 가 **파울을 아웃으로 뒤집을 때** 보는 두 칸 (0x9d5e2~0x9d600, 디스어셈 재확인).
 *
 * ```
 * 0009d5d4: bl 0xb68dc            ; 파울인가 (state[0x1c])
 * 0009d5e2: ldrsb r3,[r2,#4]      ; (s8)state[4]  = 스트라이크 수
 * 0009d5e6: cmp r3,#1 ; ble 0x9d5fe   ; 1 이하면 그냥 파울(판정 7)
 * 0009d5ea: ldrsb r3,[r2,#0x13]   ; (s8)state[0x13] = 번트 종류
 * 0009d5f2: beq 0x9d5fe           ; 0 이면 그냥 파울
 * 0009d5fa: movs r2,#0xb          ; 판정 11 = 아웃
 * ```
 *
 * 즉 **2스트라이크에서 낸 번트가 파울이 되면 아웃**이다. 스트라이크 수는 이 공을 먹이기
 * **전**의 값이다 (원본도 타구 판정이 카운트를 올리기 전에 돈다).
 */
export interface BuntFoulSituation {
  /** 이 공을 먹이기 전의 스트라이크 수 — 원본 `(s8)state[4] > 1` */
  readonly strikes: number
  /** 0 스윙 · 1~3 번트 종류 — 원본 `(s8)state[0x13] != 0` */
  readonly buntKind: number
}

/** 0x9d660 — 웹 패턴 각(원본 a 의 부호를 뒤집은 값)이 페어인가 */
export function isFairAngle(angle: number): boolean {
  return angle >= FAIR_ANGLE.minimum && angle <= FAIR_ANGLE.maximum
}

/**
 * 맞은 공을 가른다 — 난수를 쓰지 않는다. 결과 코드는 번트 성공 표시(isBunt)에만 쓴다 — 원본도 쏜 뒤로는
 * 코드를 보지 않고 패턴(궤적)만 본다.
 */
export function contactOfPattern(
  code: number,
  pattern: BattedBallPattern,
  situation?: BuntFoulSituation,
): BattedBallContact {
  if (!isFairAngle(pattern[0])) {
    if (situation !== undefined && situation.strikes > 1 && situation.buntKind !== 0) return { kind: '번트파울아웃' }
    return { kind: '파울' }
  }
  return { kind: '타구', isBunt: code >= BUNT_CODES.minimum && code <= BUNT_CODES.maximum }
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

/**
 * **특수 타구 표 `0xcfb3c`** (s16 × 3 × 4 — 원본 각 · 속도 · 높이) — 바이트 그대로:
 * `79 ff d6 02 3a 07 | 79 ff b0 04 b0 04 | d3 ff d6 02 3a 07 | d3 ff b0 04 b0 04`
 * = (−135, 726, 1850) · (−135, 1200, 1200) · (−45, 726, 1850) · (−45, 1200, 1200).
 * 각은 원본 부호(덱이 저장할 때 뒤집은 값)라 웹 패턴 각으로는 135 · 45 — 파울선 바로 위(페어 끝, 0x9d660 양끝 포함)다.
 */
const SPECIAL_LAUNCHES: readonly (readonly [angle: number, speed: number, height: number])[] = [
  [135, 726, 1850],
  [135, 1200, 1200],
  [45, 726, 1850],
  [45, 1200, 1200],
]
/** 0x514f2 — 결과 코드 25 · 26 (`subs #0x19 ; cmp #1 ; bhi`) */
const SPECIAL_LAUNCH_CODES = [25, 26]
/** 0x51502 — rand(0, 1000) ≤ 19 (`cmp #0x13 ; bgt`) */
const SPECIAL_LAUNCH_LIMIT = 19
const SPECIAL_LAUNCH_ROLL = 1000
/** 패턴 플래그 비트 1 — 0xb07c8 이 덱 패턴에서 이미 +0x127 을 세운 뒤라 특수 표로 바꿔도 남는다 */
const LANDING_CHASE_FLAG = 2

/**
 * 덱에서 꺼낸 패턴을 **실제로 쏠 패턴**으로 — 꺼내기 바로 뒤 `0x514f2 ~ 0x5152c` (직접 뜬 것):
 * ```
 * 514f2  코드 ∈ {25, 26} 이고 rand(0, 1000) ≤ 19 이면 e = 0xcfb3c[rand(0, 4)] 로 (a, b, c) 를 덮는다
 * 5152e  b(+0xfce) == 0 이면 a = rand(−140, −40) · b = rand(300, 1300) · c = rand(300, 1300), 코드가 6~8 · 12~14 면
 *        (마스크 0x71c0) a = rand(−110, −70) · b = rand(100, 480) · c = rand(200, 500)
 * ```
 * 둘째 갈래는 패턴이 없는 코드(21~23)에서만 서는데 스윙 판정 0xab214 가 그 코드를 내지 않아 웹에는 두지 않는다.
 * 플래그는 덱 패턴 것이 남는다 — 비트 1(+0x127, 514cc)은 이미 섰고, 비트 0(높이 부호)은 덱이 저장할 때 c 에 먹였으므로
 * 특수 표의 c 는 그대로 양수다.
 */
export function launchPatternOf(code: number, drawn: BattedBallPattern, random: RandomPort): BattedBallPattern {
  if (!SPECIAL_LAUNCH_CODES.includes(code)) return drawn
  if (randomIntegerBelow(random, 0, SPECIAL_LAUNCH_ROLL) > SPECIAL_LAUNCH_LIMIT) return drawn
  const [angle, speed, height] = SPECIAL_LAUNCHES[randomIntegerBelow(random, 0, SPECIAL_LAUNCHES.length)]
  return [angle, speed, height, drawn[3] & LANDING_CHASE_FLAG]
}
