/** 타자 자세 프레임 — 대기 · 스윙 · 번트, 마타자 단계 표 */
interface PoseTable {
  readonly idle: readonly number[]
  readonly swingStart: number
  readonly swingLength: number
  readonly bunt: number
}

/** u > 4(일반 타자) 분기 — v 0·1 과 v 2·3 */
const POSES: readonly PoseTable[] = [
  { idle: [0, 1, 2, 3], swingStart: 6, swingLength: 7, bunt: 13 },
  { idle: [0, 1, 2, 3, 4], swingStart: 7, swingLength: 5, bunt: 12 },
]

/** 대기 칸은 카운터가 지연 3 에 닿으면 넘어간다 → 칸마다 4틱 */
const IDLE_TICKS_PER_FRAME = 4

export interface BatterPoseInput {
  /** 지금 틱 */
  readonly tick: number
  /** 스윙을 누른 틱. 스윙 중이 아니면 null */
  readonly swingTick: number | null
  readonly isBunting: boolean
  readonly bodyType: number
  /**
   * 마타자 순번 u = 스윙 객체 +0x24 (0~4, 0x35650 의 3567c~35686 이 `0xb63a0(지금 타자)` 를 넣는다). 없거나 음수면 일반 타자
   * (0xb63a0 이 −1 이라 `cmp u,#4 ; bhi` 가 일반 갈래로 간다)
   */
  readonly aceOrder?: number
}

/**
 * **마타자 자세표** (자세 0xb905c · 갱신 0xb9168 의 `u ≤ 4` 갈래, 직접 떴다):
 * - 대기(상태 5): 프레임 = 표 0xd8b0d[5u + k] · 칸 수 0xd8ad3[u] = [5,4,4,4,4] · 지연 0xd8ad8 = 3(칸마다 4틱) · 돈다
 * - 스윙(상태 3): 프레임 = 0xd8b5f[u](= 6) + 0xd8b32[9u + k] · 칸 수 0xd8ac5[u] = [8,9,7,7,7] · 지연 0(틱마다 한 칸)
 * - 번트(상태 4): 마타자 갈래가 없다 — `v = +0x28 = rec[0xb] >> 4`(35650 의 356b6~356bc) 가 4~8 이라 `cmp v,#3 ; bgt` 로 **0** 이다
 *   (원본 그대로 — 번트 자세 대신 프레임 0)
 */
const ACE_IDLE_FRAMES: readonly (readonly number[])[] = [
  [0, 1, 2, 1, 3],
  [0, 1, 2, 3],
  [0, 1, 2, 3],
  [0, 1, 2, 3],
  [0, 1, 2, 3],
]

const ACE_SWING_START = 6

const ACE_SWING_STEPS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 5, 5],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6],
  [0, 1, 2, 3, 4, 5, 5],
  [0, 1, 2, 3, 4, 5, 6],
]

const ACE_BUNT_FRAME = 0

const ACE_BATTER_COUNT = 5

/** 마타자 순번이 0~4 인가 (0xb905c 의 `cmp u,#4 ; bhi` — 음수는 부호 없이 커서 일반 갈래) */
export function isAceBatterOrder(aceOrder: number | undefined): aceOrder is number {
  return aceOrder !== undefined && aceOrder >= 0 && aceOrder < ACE_BATTER_COUNT
}

function aceBatterFrameAt(tick: number, swingTick: number | null, isBunting: boolean, aceOrder: number): number {
  if (isBunting) return ACE_BUNT_FRAME
  if (swingTick !== null) {
    const steps = ACE_SWING_STEPS[aceOrder]
    const elapsed = tick - swingTick
    // 스윙 끝 칸에 머문다 (`batterFrameAt` 주석 — 0xb9168 · 0xb928c)
    if (elapsed >= 0) return ACE_SWING_START + steps[Math.min(elapsed, steps.length - 1)]
  }
  const idle = ACE_IDLE_FRAMES[aceOrder]
  return idle[Math.floor(Math.max(0, tick) / IDLE_TICKS_PER_FRAME) % idle.length]
}

/**
 * **스윙은 마지막 칸에 머문다** (갱신 0xb9168 · 틱 함수 0xb928c, 2026-10-14 직접 뜸):
 * ```
 * b9168  상태 3(스윙): 지연 r5 = 0 · 칸 수 r1 = 마타자 0xd8ac5[u] = [8,9,7,7,7] · 일반 v ≤ 1 → 7 · v 2·3 → 5 · 돌기 r6 = 0
 * b921e  카운터 +0x20 ++ ; 옛 카운터 ≥ r5 이면 — k ≥ r1 − 1 이면 r6 == 0 이라 **아무것도 안 한다**(k 가 r1 − 1 에 선다),
 *        아니면 k++ · 카운터 0                                         ; 돌기(r6 = 1)는 상태 5(대기)뿐
 * b928c  b9168 뒤 +0xd(스윙 중) · 상태 3 이면 — 마타자 k == 0xd8ac5[u](칸 수) · 일반 k == 7 | 5 일 때만 0xb915c(S, 0)
 *        → k 는 칸 수 − 1 에서 멈추므로 **이 갈래는 안 선다**(원본 그대로)
 * 3d954  0xf 진입 → 0x35650 → 스윙 객체 vtable +0xc = 0xb9318 → 0xb915c(S, 5) — 다음 공의 0xf 에서야 대기로 돌아온다
 *        (타석 교대 0x48d50 48ee4 도 0x35650)
 * ```
 * 그래서 스윙이 끝나면 0x12 · 0x13 · 인플레이 동안 마지막 칸 그대로고, 부르는 쪽이 0xf(웹 '대기')에 들 때 `swingTick` 을 지운다.
 */
export function batterFrameAt({ tick, swingTick, isBunting, bodyType, aceOrder }: BatterPoseInput): number {
  if (isAceBatterOrder(aceOrder)) return aceBatterFrameAt(tick, swingTick, isBunting, aceOrder)
  const pose = POSES[bodyType] ?? POSES[0]
  if (isBunting) return pose.bunt
  if (swingTick !== null) {
    const elapsed = tick - swingTick
    if (elapsed >= 0) return pose.swingStart + Math.min(elapsed, pose.swingLength - 1)
  }
  const cell = Math.floor(Math.max(0, tick) / IDLE_TICKS_PER_FRAME) % pose.idle.length
  return pose.idle[cell]
}

/**
 * 일반 타자 자세표가 그리는 **몸통 프레임 전부** — 대기 · 스윙 · 번트 (`batterFrameAt` 이 낼 수 있는 값). 미리 받기가 쓴다.
 */
export function batterPoseFramesOf(bodyType: number): number[] {
  const pose = POSES[bodyType] ?? POSES[0]
  const swing = Array.from({ length: pose.swingLength }, (_, step) => pose.swingStart + step)
  return [...new Set([...pose.idle, ...swing, pose.bunt])]
}

/** 마타자 자세표가 그리는 프레임 전부 — 대기 · 스윙 · 번트(0). 순번이 0~4 가 아니면 빈 목록 */
export function aceBatterPoseFramesOf(aceOrder: number): number[] {
  if (!isAceBatterOrder(aceOrder)) return []
  const swing = ACE_SWING_STEPS[aceOrder].map((step) => ACE_SWING_START + step)
  return [...new Set([...ACE_IDLE_FRAMES[aceOrder], ...swing, ACE_BUNT_FRAME])]
}
