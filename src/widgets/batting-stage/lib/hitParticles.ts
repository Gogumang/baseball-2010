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
 * **필살타법 연출이 쓰는 `.ptc`** — 스윙 중 그리기 `0x49aec` (H2 2-3).
 * 한 타석에 **한 번만** 쏜다 (경기 `+0x196b`, 0x49da4·0x49dfc).
 *
 * 0x49b4e 가 `0xb633d(타자)` = **마선수인가**(`rec[0xa]` 비트 0x40) 로 두 갈래를 가른다.
 * - 거짓 → 0x49bfa: 필살 번호(선수 레코드 `+0x18`, 1~4) 로 고른다 (0x49c30 `ldrb r2,[r6,#0x18]`).
 * - 참 → 0x49b7c: `0xb63a1(타자)` = **마선수 순번**(0~4) 으로 점프표 `0xd01e4` 를 탄다.
 *
 * 한 줄이 파티클을 **두 개까지** 쏜다 — 원본은 `sp+0x4c`(첫 id)·`sp+0x48`(둘째 id) 두 칸을 채워 두고
 * 0x49dbc 와 0x49de0 에서 차례로 `0xbbc84(x, y, id, n, 0, −1, 0, 0)` 를 부른다. −1 인 칸은 건너뛴다.
 *
 * | 번호 | id → 파일 | 프레임 | y 보정 |
 * |---|---|---|---|
 * | 1 파워 스윙 | 1 → `002.ptc` | 6 | — |
 * | 2 플레임 스윙 | 11 → `012.ptc` | 3 | — |
 * | 3 토네이도 스윙 | 9 → `010.ptc` | 5 | +25 (0x49c84 `adds r3,#0x19`) |
 * | 4 미라지/메테오 | 아래 참고 | 1 | — |
 *
 * **번호 4 (0x49c8a)** 는 `0xb8e6d(타자)` 로 갈린다. 그 함수는 (직접 떴다)
 * `b8e6e: ldrb r3,[r0,#0xb] ; lsrs r3,#4 ; subs r3,#2 ; cmp r3,#1 ; bhi → 거짓`
 * = **폼 니블이 2·3 인가** = 타자 타입이 1(장타형)인가. 웹 `batterForm` 이 그 니블 그대로라
 * `(batterForm >> 1) === 1` 이 같은 판정이다 (니블 2·3 일 때만 참이라 원본과 완전히 같다).
 * - 참(장타형) → id 12 (`013.ptc`) · 프레임 1 (0x49c98 `movs r0,#0xc`)
 * - 거짓(타격형) → id 20 (`021.ptc`) · 프레임 1 (0x49d42 `movs r0,#0x14`)
 *   ⚠️ 원본은 이 갈래에서 파티클 **앞에** 경기 `+0xf18` 의 별도 그림을 한 장 더 그린다
 *   (자리 = 표 `0xcfb34`(295, 351) / `0xcfb2c`(184, 351) 를 카메라로 옮긴 값, 좌우 뒤집기 `0xb63c1`).
 *   그 그림 객체가 웹 타석에 아직 없어 **파티클만 옮겼다** — 그림은 미구현이다.
 *
 * **마타자 점프표 `0xd01e4`** (표 낱말을 직접 읽어 확인했다):
 *
 * | 순번 | 마타자 | 가는 곳 | 쏘는 것 |
 * |---|---|---|---|
 * | 0 | 메디카 | 0x49bb2 | 9 (`010.ptc`) · 2 |
 * | 1 | 어거지죠 | 0x49bba | 18 (`019.ptc`) · 1 + 19 (`020.ptc`) · 1 |
 * | 2 | 로제 | 0x49bde | 13 (`014.ptc`) · 1 + 1 (`002.ptc`) · 6 |
 * | 3 | 크라이져 | 0x49bec | 20 (`021.ptc`) · 5, y +25 (0x49c80 → 0x49c84) |
 * | 4 | 킹타이거 | 0x49bf2 | 17 (`018.ptc`) · 13 |
 *
 * 순번은 `ACE_PLAYERS` 중 `role === '타자'` 다섯의 배열 색인과 같다 (medica 0 … tiger 4).
 * ⚠️ 어거지죠 줄은 `0xb63c1` 이 거짓이면 `sp+0x38` 에 17 을 따로 적어 두는데, 그 칸은 파티클이 아니라
 *   뒤따르는 그리기(0x49d76)가 쓰는 값이라 **여기선 안 옮겼다**.
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

/** 필살 번호 4 — 폼 니블 2·3(장타형)이면 013, 아니면 021 (0x49c8a → 0xb8e6d) */
const MIRAGE_SLUGGER_PARTICLE: SpecialSwingParticle = { id: 12, img: 1, offsetY: 0 }
const MIRAGE_CONTACT_PARTICLE: SpecialSwingParticle = { id: 20, img: 1, offsetY: 0 }

/** 마타자 순번(0~4) → 쏘는 파티클. 점프표 0xd01e4 순서 그대로다 */
export const ACE_BATTER_SPECIAL_PARTICLES: readonly (readonly SpecialSwingParticle[])[] = [
  [{ id: 9, img: 2, offsetY: 0 }],
  [{ id: 18, img: 1, offsetY: 0 }, { id: 19, img: 1, offsetY: 0 }],
  [{ id: 13, img: 1, offsetY: 0 }, { id: 1, img: 6, offsetY: 0 }],
  [{ id: 20, img: 5, offsetY: 25 }],
  [{ id: 17, img: 13, offsetY: 0 }],
]

/**
 * 이번 필살 스윙이 쏠 파티클들. 원본 순서대로 0~2개다.
 *
 * - `aceBatterIndex` 가 0 이상이면 마타자 점프표를 탄다 (필살 번호는 안 본다).
 * - 아니면 필살 번호로 고른다. 모르는 번호면 빈 배열이다.
 */
export function specialSwingParticlesOf(
  swingNumber: number,
  batterForm: number,
  aceBatterIndex = -1,
): readonly SpecialSwingParticle[] {
  if (aceBatterIndex >= 0) return ACE_BATTER_SPECIAL_PARTICLES[aceBatterIndex] ?? []
  if (swingNumber === 4) {
    return [(batterForm >> 1) === 1 ? MIRAGE_SLUGGER_PARTICLE : MIRAGE_CONTACT_PARTICLE]
  }
  const single = SPECIAL_SWING_PARTICLES[swingNumber]
  return single === undefined ? [] : [single]
}
