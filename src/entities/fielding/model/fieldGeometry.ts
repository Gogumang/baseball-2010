import { integerSquareRoot } from '@/shared/lib/math/originalTrigonometry'

/**
 * 수비 좌표계와 이동 상수 (binary.mod).
 *
 * 원본 수비는 월드 40000×32500 의 정수 좌표 (x, 높이, z) 위에서 돈다.
 * x 가 클수록 1루 쪽, z 가 작을수록 외야다 (I-controls 1a).
 * 화면 배율 40000×32500 → 620×500(수비 화면) · 148×142(작은 지도) 는 화면 쪽 몫이라 여기 두지 않는다 (R3 1절).
 */

/** 월드 가로 (R3 1절 · I-controls 1b 의 0xb9474 인자) */
export const WORLD_WIDTH = 40_000
/** 월드 세로 (z) */
export const WORLD_DEPTH = 32_500

export interface WorldPoint {
  readonly x: number
  /** 높이. 야수·주자는 늘 0, 공만 움직인다 */
  readonly y: number
  readonly z: number
}

/**
 * 루 좌표표 0xd856c (12바이트 × 4). 0xd86b0(야수 쪽)·0xd78f0(주자 쪽)·0xd7bdc 와 **내용이 완전히 같다**
 * — 리드 폭 같은 오프셋을 더하는 코드는 어디에도 없다 (S8 6-1, 확정).
 * 원본 표는 5칸이고 [4] 가 홈의 사본이라 루 번호를 4 로 나눈 나머지로 읽는다.
 */
export const BASE_POSITIONS: readonly WorldPoint[] = [
  { x: 20_000, y: 0, z: 29_445 }, // 0 홈
  { x: 25_946, y: 0, z: 24_175 }, // 1 1루
  { x: 20_000, y: 0, z: 19_170 }, // 2 2루
  { x: 14_055, y: 0, z: 24_175 }, // 3 3루
]

/** 루 번호(0~4, 원본 표의 [4] = 홈)를 좌표로. 음수도 감싼다 */
export function basePosition(base: number): WorldPoint {
  return BASE_POSITIONS[(((base % 4) + 4) % 4)]
}

/**
 * 야수 시작 좌표표 0xd86ec (9 × 12바이트, 0xb0fb4 가 씀 — I-controls 1a).
 * 칸 = 선수 레코드 +0x1c 하위 4비트 − 1.
 * 외야 6 = 1루 쪽(우익) · 7 = 3루 쪽(좌익) · 8 = 중견 (R3 2절에서 확정).
 */
export const FIELDER_START_POSITIONS: readonly WorldPoint[] = [
  { x: 20_000, y: 0, z: 24_500 }, // 0 투수
  { x: 20_000, y: 0, z: 29_705 }, // 1 포수
  { x: 25_068, y: 0, z: 23_275 }, // 2 1루수
  { x: 22_130, y: 0, z: 19_610 }, // 3 2루수
  { x: 14_664, y: 0, z: 22_750 }, // 4 3루수
  { x: 17_273, y: 0, z: 19_150 }, // 5 유격수
  { x: 30_700, y: 0, z: 12_300 }, // 6 1루 쪽 외야(우익)
  { x: 9_100, y: 0, z: 12_300 }, // 7 3루 쪽 외야(좌익)
  { x: 20_000, y: 0, z: 8_000 }, // 8 중견
]

export const FIELDER_COUNT = 9

/** 칸 ≤ 5 가 내야다 (0xb8da8 은 칸 6~8 을 외야로 본다 — P2 1a) */
export function isOutfieldSlot(slot: number): boolean {
  return slot > 5
}

/**
 * 루 담당 기본 야수표 0xd85a8 = u8 [1, 2, 3, 4]
 * — 홈→포수(1) · 1루→1루수(2) · 2루→2루수(3) · 3루→3루수(4) (S7 3-0, 확정).
 */
export const BASE_DEFAULT_FIELDER: readonly number[] = [1, 2, 3, 4]

/** 루 기본 점수표 0xd85ac = u32 [홈 4000, 1루 1000, 2루 2000, 3루 3000] (S7 3-0) */
export const BASE_SCORE: readonly number[] = [4000, 1000, 2000, 3000]

/** 야수 달리기 속도 cfg+0x18 = 220/틱. **능력치와 무관하게 9명 전부 같다** (P2 1c, 확정) */
export const FIELDER_SPEED = 220
/** 주자 기본 속도 cfg+0x14 = 300 (R3 4절) */
export const RUNNER_BASE_SPEED = 300
/** 주루 능력치 계수 cfg+0x16 = 7 (÷100) */
export const RUNNER_SPEED_NUMERATOR = 7
/** 슬라이딩 동작(6) 중 추가 속도 (0xa0164, R3 3절) */
export const SLIDING_SPEED_BONUS = 40
/** 슬라이딩이 걸리는 진행률 구간 (0xa9690: 71 ≤ p ≤ 94) */
export const SLIDING_PROGRESS_RANGE = { minimum: 71, maximum: 94 } as const

/**
 * 주자 속도 = 300 + ⌊주루 × 7 / 100⌋ (+ 팀 등급) — 0xa092c · 0xa93ac (R3 4절, 확정).
 * 팀 등급은 전역 모드 1·2·8 에서만 더해진다(야수 보너스와 달리 9 가 빠진다).
 */
export function runnerSpeedOf(runAbility: number, teamGrade = 0): number {
  return RUNNER_BASE_SPEED + Math.trunc((runAbility * RUNNER_SPEED_NUMERATOR) / 100) + teamGrade
}

/** 능력치 → 등급 0~7 (0xbbe98). 투구 쪽 0x66c98 표와 같은 칸이다 */
export const ABILITY_GRADE_LIMITS: readonly number[] = [125, 250, 375, 525, 675, 825, 925]

export function abilityGradeOf(ability: number): number {
  const index = ABILITY_GRADE_LIMITS.findIndex((limit) => ability <= limit)
  return index < 0 ? ABILITY_GRADE_LIMITS.length : index
}

/** 평면 거리 isqrt(dx² + dz²) — 0xbfa2c. 높이는 보지 않는다 */
export function horizontalDistance(from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  return integerSquareRoot(dx * dx + dz * dz)
}

/** 세 좌표가 **정확히** 같은가 — 0xbc0f4. 루 판정(0xa0ae4)이 이 완전일치를 쓴다 */
export function isSamePoint(left: WorldPoint, right: WorldPoint): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z
}

/** 목표까지 남은 틱 — 0xbf01c: 속도가 0 이면 1000 을 돌려준다 (원본 그대로) */
export const UNREACHABLE_TICKS = 1000

export function ticksToReach(from: WorldPoint, to: WorldPoint, speed: number): number {
  if (speed === 0) return UNREACHABLE_TICKS
  return Math.trunc(horizontalDistance(from, to) / speed)
}

/**
 * 한 틱 이동 — 기반 캐릭터 vt 0x24 = 0xbf158.
 * 남은 거리가 속도 이하면 **목표에 정확히 붙인다**(그래서 루 위 캐릭터 좌표가 루 좌표와 비트까지 같다 — S8 6-2).
 */
export function stepToward(position: WorldPoint, target: WorldPoint, speed: number): WorldPoint {
  const distance = horizontalDistance(position, target)
  if (distance <= speed) return { x: target.x, y: position.y, z: target.z }
  return {
    x: position.x + Math.trunc(((target.x - position.x) * speed) / distance),
    y: position.y,
    z: position.z + Math.trunc(((target.z - position.z) * speed) / distance),
  }
}

/** 진행률 % — 주자 vt90 = 0xa04e8: 출발 루에서 현재 위치까지 ÷ 출발 루에서 목표 루까지 × 100 */
export function progressPercent(legStart: WorldPoint, position: WorldPoint, target: WorldPoint): number {
  const whole = horizontalDistance(legStart, target)
  if (whole === 0) return 0
  return Math.trunc((horizontalDistance(legStart, position) * 100) / whole)
}
