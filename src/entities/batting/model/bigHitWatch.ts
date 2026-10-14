/**
 * **큰 타구 감상 플래그 경기 +0x199a** — 0x392ac 전문 (R15 9-1, 직접 뜬 것):
 * ```
 * 392b6  B = [경기+0x204](공) ; B+0xab0(폴 맞은 틱) != −1 → +0x199a = 0
 * 392c2  [경기+0xfd4](결과 코드) − 24 > 2(부호 없음) → +0x199a = 0
 * 392ce  +0x199a = B+0xac0(낙구 거리 눈금) > 111
 * ```
 * 같은 판정이 타구음 7 · 상태 0x13 붙잡기(`widgets/batting-stage/lib/hitPause`) · 수비 화면 공 그리기 0x36dfc 의
 * 큰 타구 파티클(0x36f76)을 고른다. 세우는 곳은 0x13 (그리고 0x17 끝 0x528b0 의 52ad0 이 한 번 더 부른다 — 판이 닫힌 뒤라
 * 0x17 그림에는 영향이 없다), 끄는 곳은 타석 준비 0xf 진입 0x3d978.
 */

/** 0x392ac 이 보는 결과 코드 — 홈런성(가운데·좌·우) */
const BIG_HIT_CODES: ReadonlySet<number> = new Set([24, 25, 26])
/** 0x392ac 의 `> 111` */
export const BIG_HIT_CARRY_THRESHOLD = 111

export interface BigHitWatchInput {
  /** 방향까지 붙인 결과 코드 (원본 경기 +0xfd4). 스윙하지 않았으면 null */
  readonly resultCode: number | null
  /** 폴 맞은 틱 (원본 공 +0xab0). −1 이면 아직 아무 데도 안 닿았다 */
  readonly poleTick: number
  /** 낙구 거리 눈금 (원본 공 +0xac0) */
  readonly carryScale: number
}

export function isBigHitWatch({ resultCode, poleTick, carryScale }: BigHitWatchInput): boolean {
  if (poleTick >= 0) return false
  if (resultCode === null || !BIG_HIT_CODES.has(resultCode)) return false
  return carryScale > BIG_HIT_CARRY_THRESHOLD
}
