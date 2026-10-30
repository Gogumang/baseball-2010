/**
 * **레이더 자라는 애니** — 능력치 레이더 객체 [skin+0xd4] (그리기 0x5a990 · 0x5aefc → 0x764c8, 직접 떴다).
 *
 * 그리기는 `[anim+0x1e3] == 0` 이면 도형을 다시 만든다 — 0x75ebc 가 축마다 지금값 E+8 을
 * `(s8)[anim+0xad] ≠ 0 ? 지난 목표값 prev[i](anim+0x9c+2i) : 0`(0x76006~0x76020)으로 두고 +0x1e1 = 1 · +0x1e2 = 0 · +0x1e3 = 1.
 * 그 뒤 **매 그림** 0x764c8 이 +0x1e1 이면 한 걸음(0x760e8)을 굴리고 `+0x1e1 = (+0x1e2 == 0)` 으로 둔다 — 첫 그림도 굴린 뒤 그린다.
 * ```
 * 한 걸음 0x760e8 (축 i = 0..n−1, n = [anim+0x64] = 4):
 *   [anim+0x1e2] == 0 이면
 *     [anim+0xad] ≠ 0 && 목표 < prev[i]  → 지금 −= 48 · 닿음 = 지금 ≤ 목표       ; 0x76192~0x761a6
 *     그 밖                               → 지금 += 48 · 닿음 = 지금 ≥ 목표       ; 0x76172~0x761a6
 *     닿으면 닿은 수++ · [anim+0xad] = n · prev[i] = 목표 · 지금 = 목표 · 닿은 수 ≥ n 이면 [anim+0x1e2] = 1   ; 0x761a8~0x761e0
 *   꼭짓점 = 중심 + 표 × max(3, 지금 × R / 999) >> 16 (지금 0 이면 0)
 * ```
 * 축마다 따로 같은 걸음(48)으로 움직이고, **한 그림에서 네 축이 다 닿아야** 끝난다(이미 닿은 축도 매 그림 다시 닿는다).
 * 숫자도 지금값(E+8)을 찍어 같이 오른다. 키는 막지 않는다(0x760e8 의 돌려준 값은 버려진다).
 *
 * 다시 거는 곳 — 들어올 때는 `+0xad = 0 · +0x1e3 = 0`(0 에서 자람: 0xd5 0x5366 · 0xd9 0x5446 · 0xdc 0x5f98 · 0xc8 0xb92e ·
 * 119 · 121 · 111 0x10940 · 102 0x173a2 · 목록 화면 들어옴들 — 팀 고르기 · 명전 · 에디트), 102 등록 키 0x16f28 의 타입 · 포지션 줄
 * 좌우(0x16fb2~0x16fe0 · 0x1709e~0x170cc)도 같은 `+0xad = 0 · +0x1e3 = 0` 이라 0 에서 다시 자란다.
 * 장비 끼워 보기 0x81938 · 목록 0x63b14 틱 0 · 목록 커서 이동(커서 +0x25, 0x63c36~0x63c56) · 마선수 레벨업 0x5fc72 는
 * `+0x1e3 = 0` 만 (지난 목표값에서 새 값으로 오르내림).
 *
 * **원본 그대로의 특이점**: 들어올 때도 prev 표는 안 지운다. 첫 축이 닿아 [anim+0xad] = n 이 서면, 아직 덜 자란 축 가운데
 * 앞 화면의 prev 가 새 목표보다 큰 축은 감소 갈래로 빠져 그 자리에서 목표로 튄다. 그래서 prev 는 화면을 건너 사는 값이다.
 */
export const RADAR_GROWTH_STEP = 48

export interface RadarGrowthState {
  /** E+8 — 축마다 지금값 */
  readonly current: readonly number[]
  /** anim+0x9c — 지난 목표값 */
  readonly previous: readonly number[]
  /** (s8)[anim+0xad] ≠ 0 */
  readonly hasPrevious: boolean
  /** [anim+0x1e2] */
  readonly isDone: boolean
}

/** 다시 만들기 0x75ebc — `fromZero` 는 들어옴(+0xad = 0 을 같이 쓴다) */
export function radarGrowthStart(previous: readonly number[], hasPrevious: boolean, axes: number, fromZero: boolean): RadarGrowthState {
  const keepsPrevious = hasPrevious && !fromZero
  const filled = Array.from({ length: axes }, (_unused, axis) => previous[axis] ?? 0)
  return {
    current: keepsPrevious ? filled : filled.map(() => 0),
    previous: filled,
    hasPrevious: keepsPrevious,
    isDone: false,
  }
}

/** 축 하나가 목표에 닿았나 — 내려가는 축(목표가 지난 목표보다 낮다)은 목표 이하, 오르는 축은 목표 이상 */
function reachesTarget(value: number, target: number, isFalling: boolean): boolean {
  return isFalling ? value <= target : value >= target
}

/** 한 걸음 0x760e8 */
export function radarGrowthStep(state: RadarGrowthState, targets: readonly number[]): RadarGrowthState {
  if (state.isDone) return state
  const current = [...state.current]
  const previous = [...state.previous]
  let hasPrevious = state.hasPrevious
  let isDone = false
  let reached = 0
  for (let axis = 0; axis < current.length; axis++) {
    if (isDone) break
    const target = targets[axis] ?? 0
    const isFalling = hasPrevious && target < previous[axis]
    current[axis] += isFalling ? -RADAR_GROWTH_STEP : RADAR_GROWTH_STEP
    if (!reachesTarget(current[axis], target, isFalling)) continue
    reached += 1
    hasPrevious = true
    previous[axis] = target
    current[axis] = target
    isDone = reached >= current.length
  }
  return { current, previous, hasPrevious, isDone }
}

/** 다시 만든 뒤 `draws`(0 부터) 째 그림의 값 — 그 그림도 굴린 뒤 그린다 */
export function radarGrowthAt(start: RadarGrowthState, targets: readonly number[], draw: number): RadarGrowthState {
  let state = start
  for (let step = 0; step <= draw && !state.isDone; step++) state = radarGrowthStep(state, targets)
  return state
}

/**
 * 레이더 객체 [skin+0xd4] 는 하나라 지난 목표값 · 깃발 · 지금값(E+8) · 끝 깃발(+0x1e2)이 화면을 건너 산다 — 웹은 모듈 칸 하나로 든다.
 * 카드 레이더(0x5a990)와 팀 고르기 · 에디트 · 명전 목록 · 구단정보의 능력치 도형(0x5aefc)이 모두 이 칸을 읽고 고친다 —
 * 0x5aefc 도 [anim+0x1e3] == 0 이면 0x5b344~0x5b3b8 에서 0x75ebd(anim, 서술자, 4, 0) 로 다시 만들고 매 그림 0x764c9 를 부른다.
 * 다시 거는 쪽이 없으면(+0x1e3 = 1 그대로) 다시 만들지 않고 지금값에서 한 걸음씩 이어 간다 — `continueRadarGrowth`.
 */
export const radarObject: {
  previous: readonly number[]
  hasPrevious: boolean
  current: readonly number[]
  isDone: boolean
} = { previous: [], hasPrevious: false, current: [], isDone: false }

/**
 * 다시 만들지 않고 이어 가기 — [anim+0x1e3] 이 1 인 채 새 화면이 그리기만 이어 부를 때(에디트 하위 0 ↔ 1 · 2, 상태 29 의
 * 그림 0x2e1e0 이 목록 k 9 를 늘 그려 같은 객체를 매 그림 굴린다). 객체가 그 축 수의 지금값을 안 들고 있으면 지난 목표값으로 다시 만든다.
 */
export function continueRadarGrowth(axes: number): RadarGrowthState {
  if (radarObject.current.length !== axes) return radarGrowthStart(radarObject.previous, radarObject.hasPrevious, axes, false)
  return {
    current: radarObject.current,
    previous: Array.from({ length: axes }, (_unused, axis) => radarObject.previous[axis] ?? 0),
    hasPrevious: radarObject.hasPrevious,
    isDone: radarObject.isDone,
  }
}
