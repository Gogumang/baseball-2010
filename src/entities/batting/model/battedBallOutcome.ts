import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 결과 코드 → 원본 타구 패턴 → 안타·아웃.
 * 원본은 패턴(a 수평각, b 속도, c 높이)으로 공을 굴리고 수비수가 실제로 잡는 시뮬레이션(0xa28c0)이라
 * 결과표가 없다. 아래 판정은 위치 분석 4차가 패턴 분포로 만든 **대체 근사이며 전부 추정**이다.
 *
 * **그라운드 룰 2루타(결과 10)와 장내 홈런(`state[0x25]`)은 여기서 만들 수 없다.**
 * 둘 다 이 파일에 없는 것을 본다:
 *   - 결과 10 = `state[0x20] > 0`(**담장 넘는 틱이 섰다**) **그리고** `state[0x1e]`(먼저 바운드했다)
 *     → 즉 **바운드해서 담장을 넘어간 공**이다 (0x9d5bc · E 1d · P2 211행).
 *     세기가 문턱에 못 미쳐 **애초에 담장에 못 미친 공**은 `state[0x20]` 이 서지도 않으므로
 *     결과 10 이 아니라 그냥 안타다 — 세기 문턱으로는 이 둘을 가를 수 없다.
 *   - `state[0x25]` = 타자주자가 플레이 도중 **실제로 홈을 밟는지**(수비 송구·중계·주루 다툼)
 *     를 시간 축으로 돌려 정한다 (E 1e).
 * 이 함수는 시간·수비수·주자가 아예 없는 (각도·속도) 정적 판정표라 둘 다 지어낼 수밖에 없다.
 * 붙인다면 시간 축을 가진 `features/defense-play/runDefensePlay` 쪽이다.
 */
export type BattedBallResult =
  | { readonly kind: '파울' }
  /** isBunt 는 번트 성공(코드 6~8) — 미션 번트 목표에 쓴다 */
  | {
      readonly kind: '타구'
      readonly outcome: AtBatOutcome
      readonly isBunt: boolean
      /**
       * **2스트라이크 번트 파울 아웃**(원본 판정 11)인가 — 아웃 콜을 가르는 데 쓴다.
       *
       * 원본은 판정 11 에서 **조건 없이 62** 를 낸다 (`0x51b20` → `0x51b2e movs r1,#0x3e`).
       * 판정 13(수비가 낸 아웃)만 `state[0x1f]`·`state[0x87]` 을 보고 62/20 을 가른다.
       * 웹은 이 아웃을 `직선타아웃` 으로 옮겨 두었는데(아래 `buntFoulOut` 주석) 그대로 두면
       * 수비 진행기 결과(`caughtOnTheFly`)에 끌려가 20 이 날 수 있어, 이 칸으로 따로 알린다.
       */
      readonly isBuntFoulOut?: boolean
    }

/**
 * 수평각은 생성기가 저장한 원시값(w >> 23)으로 본다. 원본은 저장할 때 a 를 음수로 뒤집고
 * plag 비트0 이면 높이 c 도 뒤집는다(0xb0614). 부호는 타구 연출(좌우·위아래)에만 필요하다.
 *
 * 페어/파울 문턱은 **원본과 같은 식이다** (S2 확정). 원본 `0x9d660` 은 각도 하나만 보고
 * `(unsigned)(a + 135) <= 90`, 즉 **−135 ≤ a ≤ −45 (양끝 포함)** 이다. 여기 45~135 는
 * 부호만 뒤집은 같은 범위이고 양끝도 똑같이 포함한다 — 좌표·거리·폴 접촉은 원본도 보지 않는다.
 * (양끝을 **제외**하는 쪽은 담장·필살 판정 `0x36140` 이라 이 함수와 무관하다.)
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

/**
 * 2스트라이크 번트 파울 아웃 (원본 판정 11).
 *
 * ⚠️ **detail 은 근사다.** 원본은 파울 = 죽은 공이라 주자가 그대로 서지만, 웹 `AtBatOutcome` 에는
 * 그런 아웃 갈래가 없다. 있는 셋 가운데 `직선타아웃` 을 골랐다 — 이유는 둘이다:
 *   1. 잡힌 타구로 쳐 주자를 움직이지 않는다 (`baseState.advanceForOut` 은 뜬공만 희생플라이로 본다).
 *   2. 아웃 콜이 원본과 같은 **62** 가 된다 (`atBatSounds.inPlayCallSoundIdOf` — 판정 11 도 62 다).
 * 갈래를 새로 만들려면 `entities/at-bat` · `features/defense-play` 를 같이 고쳐야 해서 두지 않았다.
 */
const buntFoulOut: BattedBallResult = {
  kind: '타구',
  outcome: { kind: '아웃', detail: '직선타아웃' },
  isBunt: false,
  // 원본 판정 11 은 조건 없이 62 를 낸다 — 아웃 콜이 수비 결과에 끌려가지 않게 표를 달아 보낸다
  isBuntFoulOut: true,
}

/**
 * 결과 코드·패턴 → 타석 결과. `situation` 을 주면 위 **2스트라이크 번트 파울 아웃** 규칙까지 본다.
 *
 * 원본 순서 그대로다 — 먼저 타구를 페어/파울로 가른 뒤(0x9d660 계열), 파울이면 0x9d5e2 가
 * 카운트와 번트 종류를 보고 아웃으로 뒤집는다. 아래 `battedBallResultOf` 의 식·문턱은 그대로다.
 */
export function outcomeOfPattern(
  code: number,
  pattern: BattedBallPattern,
  random: RandomPort,
  situation?: BuntFoulSituation,
): BattedBallResult {
  const result = battedBallResultOf(code, pattern, random)
  if (result.kind !== '파울' || situation === undefined) return result
  if (situation.strikes <= 1 || situation.buntKind === 0) return result
  return buntFoulOut
}

function battedBallResultOf(code: number, pattern: BattedBallPattern, random: RandomPort): BattedBallResult {
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
