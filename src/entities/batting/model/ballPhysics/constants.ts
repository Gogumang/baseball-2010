import type { WorldPoint } from '@/entities/batting/model/ballPhysics/otherSlices'

/** 점 개수 상한 — 0xa29c2 `cmp r1, #0x81` */
export const MAXIMUM_BALL_POINTS = 130

/** 0xd7bdc — 타구 시작점이자 ac0 거리의 기준 */
export const BALL_LAUNCH_POINT: WorldPoint = { x: 20_000, y: 1_000, z: 30_000 }
/** 0xd7be8 — ac4 거리의 기준(홈) */
export const DEEP_HIT_ORIGIN: WorldPoint = { x: 20_000, y: 0, z: 29_445 }
/** a2a52 0x2822 */
export const DEEP_HIT_DISTANCE = 10_274
/** a2b02 0x109 · a2b0c 0xa0 */
export const CARRY_SCALE_DIVISOR = 265
export const CARRY_SCALE_MAXIMUM = 160
/** 담장 면 충돌로 보는 높이 상한 (9fa4a · a2cb0 의 0x7cf) */
export const WALL_FACE_HEIGHT = 1_999
/** 폴에 맞는 높이 상한 (9fa5a 0x1b58) */
export const POLE_HEIGHT = 7_000
/** 수직 선의 기울기 표시 (9f8b2 `0x80 << 0x17`) */
export const VERTICAL_SLOPE = 0x4000_0000
