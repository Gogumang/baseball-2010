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

/**
 * ⚠️ 웹 전용 — 덱 없이 한 장. 장면 덱(`openScenePatternDeck`)을 열지 않은 호출(시험 · 장면 없는 옛 길)만 쓴다.
 * 원본에는 이 굴림이 없다 — 사람 · CPU 타자 모두 장면 덱(장면 +0x19cc)에서 꺼낸다(0x51490).
 */
export function randomPattern(code: number, random: RandomPort): BattedBallPattern {
  const patterns = BATTED_BALL_PATTERNS[code]
  if (patterns === undefined || patterns.length === 0) throw new Error(`타구 패턴이 없는 결과 코드입니다: ${code}`)
  return patterns[randomIntegerBelow(random, 0, patterns.length)]
}

/**
 * **경기 장면 하나의 패턴 덱** (장면 +0x19cc) — 장면 초기화 `0x3e340` 의 `3ed76` 이 `0xb08e8` 로 **한 번** 만들고(섞기 0xb0614),
 * 그 장면의 모든 타석 — 사람 타석 · CPU 타자(투수편 · 팀경기 수비 · 투수 미션) — 이 같은 덱에서 꺼낸다(0x51490 · 커서 0xb0938).
 * 상태 7(0x3e340)은 경기 시작마다 한 번이고 상태 9 의 시뮬 초기화 rand(0, 2)(`rollSimulatorInit`)보다 앞이다.
 *
 * 웹은 장면 상태를 한 객체로 들고 다니지 않아(세션 · 진행기 · 타석 화면이 따로 돈다) 장면 덱을 **그 장면의 난수 객체에 묶어** 둔다 —
 * 경기를 여는 진행기가 `openScenePatternDeck(random)` 을 부르고, 같은 난수로 도는 타석 화면 · CPU 타자가 `scenePatternDeckOf(random)`
 * 로 되찾는다. 덱은 원본처럼 고쳐 쓰는 한 칸이다(`deck` 을 갈아 끼운다).
 *
 * ⚠️ **안 옮긴 굴림 (확정 — 직접 뜬 것)**: 같은 0x3e340 의 3ef6e 가 덱 섞기(3ed76) 뒤 곧은 길(갈래 없음)에서
 * `0x90190([0x1400064], 0, 0)` 을 부른다 → 객체+4 = 0 · 0x8fe58: 종류 0 갈래(8fe8c) rand(1, 3) · rand(−3, 4) 두 번,
 * 9005c 에서 칸 수 [sp+0x18] = 200(8fe6c) 만큼 0x8f63c 를 돌리고 종류 0 갈래(8f65e)가 칸마다 rand 여섯 번(8f6e0 · 8f6ec ·
 * 8f6fc · 8f728 · 8f734 · 8f740 — 조건 없음). rand 0xbfa54 는 범위와 무관하게 LCG 를 한 번씩 돌린다 → **경기 시작마다 1202 번**.
 * (인자는 화면 크기 0x14008b8 · 0x14008c8 를 쓴다 — 효과 알갱이 초기화로 보인다.) 옮기면 경기 시작 굴림 차례가 모두 밀려
 * app 세션 시험(useMissionSession 등 — 이 일의 구역 밖)의 씨앗을 다시 골라야 해 아직 안 넣었다.
 */
export interface ScenePatternDeck {
  deck: PatternDeck
}

const SCENE_DECKS = new WeakMap<RandomPort, ScenePatternDeck>()

/** 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 새 덱을 섞어 이 난수의 장면 덱으로 둔다(앞 장면의 덱은 버린다) */
export function openScenePatternDeck(random: RandomPort): ScenePatternDeck {
  const scene: ScenePatternDeck = { deck: createPatternDeck(random) }
  SCENE_DECKS.set(random, scene)
  return scene
}

/** 이 난수로 연 장면 덱 — 장면을 열지 않았으면 undefined */
export function scenePatternDeckOf(random: RandomPort): ScenePatternDeck | undefined {
  return SCENE_DECKS.get(random)
}

/**
 * 장면 덱에서 다음 패턴 (0x51490 · 0xb0938) — 장면 덱이 없으면 웹 전용 `randomPattern`(굴림 하나)으로 대신한다.
 */
export function drawScenePattern(code: number, random: RandomPort): BattedBallPattern {
  const scene = scenePatternDeckOf(random)
  if (scene === undefined) return randomPattern(code, random)
  const drawn = drawPattern(scene.deck, code)
  scene.deck = drawn.deck
  return drawn.pattern
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
    const patterns = BATTED_BALL_PATTERNS[code]
    if (patterns === undefined) continue
    const order = deck.orders[code] ?? patterns.map((_pattern, index) => index)
    for (let position = 0; position < patterns.length; position += 1) {
      const pattern = patterns[order[position]]
      if ((pattern[3] & flag) === 0) continue
      list.push(pattern)
      if (list.length === limit) return list
    }
  }
  return list
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
export function displayPatternOf(
  deck: PatternDeck,
  kind: DisplayPatternKind,
  shot: BattedBallPattern,
  random: RandomPort,
): BattedBallPattern {
  const list = displayPatternListOf(deck, kind)
  const index = randomIntegerBelow(random, 0, list.length)
  const shown = list[index] ?? BATTED_BALL_PATTERNS[0][(deck.orders[0] ?? [0])[0]]
  return [shown[0], shown[1], shown[2], (shown[3] & HEIGHT_SIGN_FLAG) | (shot[3] & LANDING_CHASE_FLAG)]
}
/** 패턴 플래그 비트 0 — c 부호 반전 (0xb07b4) */
const HEIGHT_SIGN_FLAG = 1

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
