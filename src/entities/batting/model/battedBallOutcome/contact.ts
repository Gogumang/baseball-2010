import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

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
 * **0x9d640 — 넓은 페어 각** (직접 뜬 것): 원본 각 a(> 0 이면 a − 360)가 −145 ≤ a ≤ −35 면 1 — 페어 쐐기를 양쪽으로 10도씩 넓힌 것.
 * ```
 * 9d642  a > 0 → a += −360 ; 9d64c  (unsigned)(a + 0x91) ≤ 0x6e ? 1 : 0
 * ```
 * 타구 0x511ce · 사건 7(파울) b2c06 이 state[7] 에 적고, 커버 0xb1c90 머리(b1cc6)와 0xb1b88(b1b9e)가 0 이면 안 돈다.
 * 이 함수는 **원본 부호의 각**(궤적 점의 각 — `pointDetailAt(t).angle`)을 받는다
 */
export function isWideFairOriginalAngle(angle: number): boolean {
  const a = angle > 0 ? angle - 360 : angle
  return (a + 0x91) >>> 0 <= 0x6e
}

/** 0x9d640 을 웹 패턴 각(원본 a 의 부호를 뒤집은 값)으로 — 35 ≤ 각 ≤ 145 */
export function isWideFairAngle(angle: number): boolean {
  return isWideFairOriginalAngle(-angle)
}

/**
 * 맞은 공을 가른다 — 난수를 쓰지 않는다. 결과 코드는 번트 성공 표시(isBunt)에만 쓴다 — 원본도 쏜 뒤로는
 * 코드를 보지 않고 패턴(궤적)만 본다.
 */
export function contactOfPattern(code: number, pattern: BattedBallPattern, situation?: BuntFoulSituation): BattedBallContact {
  if (isFairAngle(pattern[0])) return { kind: '타구', isBunt: code >= BUNT_CODES.minimum && code <= BUNT_CODES.maximum }
  return isBuntFoulOut(situation) ? { kind: '번트파울아웃' } : { kind: '파울' }
}

/** 0x9d5e2~0x9d5fa — 2스트라이크(이 공 전) 번트가 파울이면 판정 11 */
function isBuntFoulOut(situation: BuntFoulSituation | undefined): boolean {
  return situation !== undefined && situation.strikes > 1 && situation.buntKind !== 0
}
