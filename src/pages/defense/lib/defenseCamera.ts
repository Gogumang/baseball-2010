/**
 * 수비 화면 카메라 (R3-field-view 1절).
 *
 * 원본은 월드 40000×32500 을 620×500 짜리 시야로 본다 (배율 0xb9474 = this+0x1f0).
 * 화면 크기(240×320)는 그 620×500 보다 작으므로, 화면에 들어오는 월드 넓이
 * (Vw, Vh) 를 역배율 0xb9504 로 구해 카메라 경계 vt8(0xc0724) 에 넣는다.
 *
 * 카메라 클래스는 둘인데(0x3e49e), 고르는 전역 `[0x14000bc]+0xc` 를 쓰는 곳을
 * 원본에서 못 찾았다(R3 1-5). 0 으로 남아 있다면 **따라가기형(20%/틱)** 이므로
 * 여기서는 따라가기형만 옮긴다 — 데드존형(즉시 컷)은 필요해지면 그때 붙인다.
 */

/** 월드 크기 (0x3e528 이 vt8 에 넣는 값) */
export const DEFENSE_WORLD_WIDTH = 40000
export const DEFENSE_WORLD_HEIGHT = 32500
/** 배율 기준 화면 (0xb9474) — 월드 40000×32500 이 이 크기로 줄어든다 */
export const DEFENSE_VIEW_WIDTH = 620
export const DEFENSE_VIEW_HEIGHT = 500

/** 따라가기 비율 — 생성자 0xc055c 가 +0x2c 에 넣는 기본값 20(%/틱) */
export const CAMERA_FOLLOW_PERCENT = 20
/** 경기 끝 직전(상태 0x18)에 투수판으로 천천히 도는 비율 1%/틱 (0xc0558(cam,1)) */
export const CAMERA_ENDING_FOLLOW_PERCENT = 1

/** 월드 한 점 — x+ 는 1루 쪽(오른쪽), z+ 는 홈 쪽(아래) (R3 2-1) */
export interface WorldPoint {
  readonly x: number
  readonly z: number
}

/** 카메라 왼쪽 위 (월드 단위, +0x18/+0x1c) */
export interface CameraState {
  readonly x: number
  readonly y: number
}

/** 카메라 경계 (+8 W · +0xc H · +0x10 Vw · +0x14 Vh) */
export interface CameraBounds {
  readonly worldWidth: number
  readonly worldHeight: number
  readonly viewWidth: number
  readonly viewHeight: number
}

/** 역배율 0xb9504 — 월드 = 화면 × 월드폭 ÷ 화면폭 (정수 나눗셈은 0 쪽으로 자른다) */
export function toWorldWidth(screenWidth: number): number {
  return Math.trunc((screenWidth * DEFENSE_WORLD_WIDTH) / DEFENSE_VIEW_WIDTH)
}

/** 역배율 0xb9504 (세로) */
export function toWorldHeight(screenHeight: number): number {
  return Math.trunc((screenHeight * DEFENSE_WORLD_HEIGHT) / DEFENSE_VIEW_HEIGHT)
}

/** 배율 0xb9480 — 화면 = 월드 × 화면폭 ÷ 월드폭 */
export function toScreenX(worldX: number): number {
  return Math.trunc((worldX * DEFENSE_VIEW_WIDTH) / DEFENSE_WORLD_WIDTH)
}

/** 배율 0xb9480 (세로) */
export function toScreenY(worldZ: number): number {
  return Math.trunc((worldZ * DEFENSE_VIEW_HEIGHT) / DEFENSE_WORLD_HEIGHT)
}

/** 화면 크기 → 카메라 경계 (0x3e528~0x3e554) */
export function cameraBoundsOf(screenWidth: number, screenHeight: number): CameraBounds {
  return {
    worldWidth: DEFENSE_WORLD_WIDTH,
    worldHeight: DEFENSE_WORLD_HEIGHT,
    viewWidth: toWorldWidth(screenWidth),
    viewHeight: toWorldHeight(screenHeight),
  }
}

/**
 * 경계 vt30 (0xc062c) — 위 한계를 **먼저**, 0 을 **나중에** 건다.
 * 그래서 시야가 월드보다 넓으면(W < Vw) 결과가 0 이 된다. 원본 순서 그대로다.
 */
export function clampCamera(bounds: CameraBounds, x: number, y: number): CameraState {
  const limitX = bounds.worldWidth - bounds.viewWidth
  const limitY = bounds.worldHeight - bounds.viewHeight
  return {
    x: Math.max(0, Math.min(x, limitX)),
    y: Math.max(0, Math.min(y, limitY)),
  }
}

/** 가운데 맞추기 vt20 (0xc05f0) — 목표 = 대상 − 시야/2, 그 뒤 경계 */
export function centerOn(bounds: CameraBounds, target: WorldPoint): CameraState {
  return clampCamera(
    bounds,
    target.x - Math.trunc(bounds.viewWidth / 2),
    target.z - Math.trunc(bounds.viewHeight / 2),
  )
}

/** 한 축 따라가기 (vt28 0xc0690 안쪽) — 걸음이 0 으로 잘리면 부호만큼 ±1 움직인다 */
function followValue(current: number, target: number, percent: number): number {
  const distance = target - current
  if (distance === 0) return current
  const step = Math.trunc((distance * percent) / 100)
  return current + (step === 0 ? Math.sign(distance) : step)
}

/** 따라가기형 틱 vt28 (0xc0690) — 목표 쪽으로 percent%/틱 */
export function followCamera(
  current: CameraState,
  target: CameraState,
  percent: number = CAMERA_FOLLOW_PERCENT,
): CameraState {
  return {
    x: followValue(current.x, target.x, percent),
    y: followValue(current.y, target.y, percent),
  }
}

/**
 * 한 틱 (0x3f060) — 대상을 가운데로 잡은 목표에 percent% 다가간다.
 * 목표만 경계로 자르고 현재 위치는 자르지 않는다(원본 vt30 이 목표에만 걸린다).
 */
export function stepCamera(
  bounds: CameraBounds,
  current: CameraState,
  target: WorldPoint,
  percent: number = CAMERA_FOLLOW_PERCENT,
): CameraState {
  return followCamera(current, centerOn(bounds, target), percent)
}

/** 화면 오프셋 0x41230 — `−(카메라 현재) × 620/40000, ×500/32500` */
export function screenOffsetOf(camera: CameraState): { readonly x: number; readonly y: number } {
  return { x: -toScreenX(camera.x), y: -toScreenY(camera.y) }
}

/** 월드 점 → 화면 점 (배율 뒤 화면 오프셋을 더한다) */
export function worldToScreen(
  camera: CameraState,
  point: WorldPoint,
): { readonly x: number; readonly y: number } {
  const offset = screenOffsetOf(camera)
  return { x: toScreenX(point.x) + offset.x, y: toScreenY(point.z) + offset.y }
}
