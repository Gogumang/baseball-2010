import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * **타격 순간 불꽃이 어느 `.ptc` 를 쓰는가** — 스윙 그리기 `0x49e64` 의 `0x49fd2~0x4a0ce` (확정).
 *
 * 원본은 스윙 단계 `s`(0xb905d) 가 **7 인 틱에 딱 한 번** 타격점에
 * `0xbbc84(x, y, id, 10, loop=0, total=−1, relCam=0, followCam=0)` 을 쏜다 (0x4a0ca: `r3 = 0xa`).
 * 고르는 순서는 타격음 분기(0x515de~0x5164a)와 같다 (R2 3-3):
 *
 * | 판정 | id → 파일 |
 * |---|---|
 * | 감상 플래그 0x392ac 참 (큰 타구) | 없음 — 여기선 안 쏜다 (상태 19 쪽에서 016 을 쏜다) |
 * | 0x357e0 참 = 결과 코드 24~26 | 5 → `006.ptc` |
 * | 0x35988 참 = 강한 타구 | 5 → `006.ptc` |
 * | 0x39304 참 = 약한 타구 | 없음 |
 * | 그 밖 (보통 타구) | 6 → `007.ptc` |
 *
 * (원본은 여기에 "스윙 객체 `[+0xf9c]+8 ≠ 0` 이면 연출 없음" 가지도 있지만 웹 타석에는 그 칸이 없다.)
 *
 * 판정에 쓰는 a·b·c 는 타구 패턴 세 값 그대로다 (원본 `+0xfcc`·`+0xfce`·`+0xfd0`).
 * 원본은 **a 를 부호 뒤집어** 저장하므로(0xb0614) 웹 패턴의 각 45~135 는 원본 −135~−45 다.
 */

/** 타격 불꽃이 쓰는 ptcimg 프레임 (0x4a0ca `r3 = 0xa`) */
export const HIT_PARTICLE_IMAGE = 10

/** 큰 타구 감상 뒤 상태 19 가 쏘는 파티클 — id 15 → `016.ptc`, 프레임 10 (0x4cd14) */
export const BIG_HIT_PARTICLE = { id: 15, img: HIT_PARTICLE_IMAGE } as const

/** id 5 → `006.ptc` (홈런성·강한 타구) */
export const STRONG_HIT_PARTICLE_ID = 5
/** id 6 → `007.ptc` (보통 타구) */
export const NORMAL_HIT_PARTICLE_ID = 6

/** 0x357e0 — 결과 코드가 홈런성(24~26)인가 */
const BIG_HIT_CODES: ReadonlySet<number> = new Set([24, 25, 26])

export interface HitParticleInput {
  /** 방향까지 붙인 결과 코드 (원본 `+0xfd4`). 스윙하지 않았으면 null */
  readonly resultCode: number | null
  /** 웹 패턴의 수평각 (45 = 1루선 · 90 = 가운데 · 135 = 3루선) */
  readonly angle: number
  /** 타구 속도 b (`+0xfce`) */
  readonly speed: number
  /** 부호까지 붙인 높이 c (`+0xfd0`) — 패턴 플래그 비트0 이면 뒤집힌 값 */
  readonly height: number
  /** 감상 플래그 `+0x199a` (0x392ac). 켜졌으면 타격 순간엔 안 쏜다 */
  readonly isBigHit: boolean
}

/** 웹 패턴에서 원본 `+0xfcc` 를 만든다 — 원본은 각을 음수로 뒤집어 넣는다 */
function originalAngleOf(angle: number): number {
  return -angle
}

/**
 * **강한 타구 0x35988** (확정 — 디스어셈 그대로).
 * `−145 < a < −35` 이고, `b > 1200` 이거나 `1000 < b ≤ 1200 이고 c > 600` 이거나
 * `b > 800 이고 b + |c| > 1599`.
 */
export function isStrongHit({ angle, speed, height }: Pick<HitParticleInput, 'angle' | 'speed' | 'height'>): boolean {
  const a = originalAngleOf(angle)
  if (a + 145 <= 0) return false
  if (a + 35 >= 0) return false
  if (speed > 1200) return true
  if (speed > 1000 && height > 600) return true
  return speed + Math.abs(height) > 1599 && speed > 800
}

/**
 * **약한 타구 0x39304** (확정 — 디스어셈 그대로).
 * `−165 < a < −75` 면 `b ≤ 449 이고 |c| ≤ 449`,
 * 그 밖이면 `b ≤ 349 이고 |c| ≤ 899` 이거나 `b ≤ 549 이고 |c| ≤ 549`.
 */
export function isWeakHit({ angle, speed, height }: Pick<HitParticleInput, 'angle' | 'speed' | 'height'>): boolean {
  const a = originalAngleOf(angle)
  const absoluteHeight = Math.abs(height)
  if (a + 165 > 0 && a + 75 < 0) return speed <= 449 && absoluteHeight <= 449
  if (speed <= 349 && absoluteHeight <= 899) return true
  return speed <= 549 && absoluteHeight <= 549
}

/** 타격 순간 쏠 `.ptc` 의 id. 안 쏘는 가지면 null */
export function hitParticleIdOf(input: HitParticleInput): number | null {
  if (input.isBigHit) return null
  if (input.resultCode !== null && BIG_HIT_CODES.has(input.resultCode)) return STRONG_HIT_PARTICLE_ID
  if (isStrongHit(input)) return STRONG_HIT_PARTICLE_ID
  if (isWeakHit(input)) return null
  return NORMAL_HIT_PARTICLE_ID
}

/** 타구 패턴에서 판정에 쓸 a·b·c 를 꺼낸다 — 높이는 플래그 비트0 으로 부호를 붙인다 (0xb0614) */
export function hitParticleInputOf(
  pattern: BattedBallPattern,
  resultCode: number | null,
  isBigHit: boolean,
): HitParticleInput {
  const [angle, speed, height, flags] = pattern
  return { resultCode, angle, speed, height: (flags & 1) !== 0 ? -height : height, isBigHit }
}

/**
 * **필살타법 연출이 쓰는 `.ptc`** — 스윙 중 그리기 `0x49aec` (H2 2-3 · 0x49c30 `ldrb r2,[r6,#0x18]`).
 * 필살 번호(선수 레코드 `+0x18`, 1~4) 로 고르고, 한 타석에 **한 번만** 쏜다 (경기 `+0x196b`).
 *
 * | 번호 | id → 파일 | 프레임 | y 보정 |
 * |---|---|---|---|
 * | 1 파워 스윙 | 1 → `002.ptc` | 6 | — |
 * | 2 플레임 스윙 | 11 → `012.ptc` | 3 | — |
 * | 3 토네이도 스윙 | 9 → `010.ptc` | 5 | +25 (0x49c84 `adds r3,#0x19`) |
 *
 * ⚠️ **번호 4(미라지/메테오)는 뺐다.** 원본은 `0xb8e6d(타자)` 로 `013.ptc`(id 12) 와
 * `021.ptc`(id 20) 를 가르는데 그 함수가 무엇을 보는지 **아직 못 밝혔다** (H2 2-3 미해결).
 * 아무 번호나 꽂지 않는다.
 * ⚠️ **마타자(순번 0~4)도 뺐다.** 점프표 0xd01e4 로 010/019+020/014+002/021/018 을 고르는데
 * 웹 타석은 마타자 **순번**을 넘겨받지 않아 어느 줄인지 고를 수 없다.
 */
export interface SpecialSwingParticle {
  /** 0xbbc84 의 id — 파일은 `ptc/(id+1).ptc` */
  readonly id: number
  /** ptcimg 프레임 (호출 인자 n) */
  readonly img: number
  /** 쏘는 자리의 y 보정 */
  readonly offsetY: number
}

export const SPECIAL_SWING_PARTICLES: Readonly<Record<number, SpecialSwingParticle>> = {
  1: { id: 1, img: 6, offsetY: 0 },
  2: { id: 11, img: 3, offsetY: 0 },
  3: { id: 9, img: 5, offsetY: 25 },
}

/** 필살 번호로 고른 파티클. 못 밝힌 번호(4·마타자)면 null */
export function specialSwingParticleOf(swingNumber: number, isAceBatter: boolean): SpecialSwingParticle | null {
  if (isAceBatter) return null
  return SPECIAL_SWING_PARTICLES[swingNumber] ?? null
}
