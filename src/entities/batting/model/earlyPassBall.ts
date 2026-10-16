import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/** 0x494b4 구역 — `(u16)(각 + 0xb9) ≤ 0x46` 이면 1, `(u16)(각 + 0x41) ≤ 0x46` 이면 2, 아니면 0 (각 = 원본 +0xfcc) */
export function earlyPassZoneOf(originalAngle: number): 0 | 1 | 2 {
  if (((originalAngle + 0xb9) & 0xffff) <= 0x46) return 1
  if (((originalAngle + 0x41) & 0xffff) <= 0x46) return 2
  return 0
}

/** d 의 크기 — 0x51690 `−5` · 0x51698 `5` */
const EARLY_PASS_ANGLE_STEP = 5

/**
 * **[경기+0xf2c] 공의 수평각 덧셈 d** (0x51408 51682~51712, 2026-10-16 직접 뜸):
 * ```
 * 5166e  z = 0x494b4(경기)                         ; 구역 (`earlyPassZoneOf`)
 * 51686  d = 0xb63c1(지금 타자) ? −5 : 5            ; 손 ≠ 0(좌타)이면 −5
 * 5169c  z == 0 · 3 → 그대로
 *        손 ≠ 0: z == 1 → d += 5 (= 0) · 그 밖 그대로     손 == 0: z == 2 → d −= 5 (= 0) · 그 밖 그대로
 * 5174c  [경기+0xf2c].vt44(+0xfce, +0xfd0, +0xfcc + d)
 * ```
 * 판 공 [경기+0x204] 는 메시지 0x11(515c0 → 0x50faa)의 51188 이 같은 세 칸을 **d 없이** 쏜다(+0xfcc 를 가리키는 인자, 50fb8 ·
 * 51172~51188). 두 공 모두 타격점 (20000, 1000, 30000)(0xcfb70 · 0xcfb64)에 놓이고 세계 0xbfed0 에 점을 깐다(511a4 · 517ce).
 * 그래서 0x406e8 이 보는 공은 판 공과 수평각만 d 만큼 다르다.
 */
export function earlyPassAngleOffsetOf(originalAngle: number, batterHand: number): number {
  const zone = earlyPassZoneOf(originalAngle)
  const isLeft = batterHand !== 0
  if (isLeft) return zone === 1 ? 0 : -EARLY_PASS_ANGLE_STEP
  return zone === 2 ? 0 : EARLY_PASS_ANGLE_STEP
}

/**
 * **[경기+0xf2c] 를 쏘는 패턴** — 판 패턴의 원본 각 +0xfcc = −a 에 d 를 더한 공이라 웹 패턴 각은 a − d 다(`battedBallTrajectory` 가
 * 각을 다시 뒤집는다). 515b0 의 `+0xfcc > 0 이면 −360` 은 패턴 각이 0~359 라 +0xfcc ≤ 0 이어서 서지 않는다.
 */
export function earlyPassPatternOf(pattern: BattedBallPattern, batterHand: number): BattedBallPattern {
  const [angle, speed, height, flags] = pattern
  return [angle - earlyPassAngleOffsetOf(-angle, batterHand), speed, height, flags]
}
