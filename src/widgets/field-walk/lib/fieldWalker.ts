import { FIELDER_SPEED, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { FIELDER_ACTION } from '@/pages/defense/lib/defenseView'

/**
 * **운동장을 걷는 선수 한 명** — 야수 클래스(vtable 0xd7934, 0xa0e08 이 만든다)의 걷기 몫만 옮긴 것.
 * 공수 교대 판(0x18)의 운동장 전경 0x4fb8c 와 벤치 클리어링(0x1e) 0x43228 이 두 줄 9명씩(장면 +0x111c 수비 · +0x1758 공격)을 이것으로 그린다.
 *
 * 직접 뜬 메서드 (2026-10-14):
 * ```
 * vt10  0xa124c  0xbf2b0(목표 +0x2c = 위치 +0x20, +0x3a = 1) · 동작 +0xa8 = 0 · +0xb0~+0xb3 · +0xb4 · +0xbc · +0xe8 = 0   ; +0xac 는 그대로
 * vt18  0xbf3a0  위치 == 목표 (세 칸 완전일치 0xbc0f4)                                                               ; 닿았나
 * vt24  0xbf158  한 걸음 — 남은 거리 ≤ 속도 +0x3c 면 목표에 붙이고, 아니면 x · z 를 (차 × 속도 / 평면거리) 만큼     ; `stepToward`
 * vt40  0xa1058  그림 프레임 = 동작 +0xa8 · 칸 +0xac                                                                 ; `fielderActionFrameOf`
 * vt44  0xa1234  동작이 다를 때만 +0xa8 = 동작 · +0xac = 0
 * vt64  0xa2164  [0x14000c0]+0x18 = 220                                                                              ; 야수 걸음
 * 0xbee60 / 0xbee84  위치 +0x20 과 구간 출발점 +0x14 를 그 점으로 — 목표는 안 건드린다                              ; 놓기
 * 0xa21bc  목표 0xbf2cc(점) → 방향 동작 0xa0ee8 → 속도 = vt64() (220) · 수직 0                                       ; 보내기
 * 0xa0ee8  목표 ≠ 위치(0xbc124)면 dx = tx − x · dz = tz − z : |dx| > |dz| ? (dx > 0 ? 4 : 3) : (dz > 0 ? 1 : 2), 아니면 0 → vt44
 * 0xbec7c  +0x3c = 속도 · +0x40 = 수직 속도                                                                          ; 속도 바꾸기
 * ```
 * 높이(+0x24)는 늘 0 이다 — 수직 속도를 0 으로만 넣는다(0xa21bc · 0x3fac4 · 0x3a5f0 · 0x401d4 모두 0xbec7c(…, v, 0)).
 */
export interface FieldWalker {
  /** +0x20 x · +0x28 z */
  readonly x: number
  readonly z: number
  /** 목표 +0x2c x · +0x34 z */
  readonly targetX: number
  readonly targetZ: number
  /** +0x3c 한 틱 걸음 */
  readonly speed: number
  /** +0xa8 동작 (`FIELDER_ACTION`) */
  readonly action: number
  /** +0xac 동작 칸 — 걷는 틱마다 +1, 동작이 바뀌면 0 */
  readonly actionTick: number
}

/** 생성자(0xa0e08 → 0xbecd4)가 막 만든 선수 — 자리 (0, 0, 0) · 서 있음. 속도는 기반 생성자 0xbec84 의 100 */
export const NEW_FIELD_WALKER: FieldWalker = { x: 0, z: 0, targetX: 0, targetZ: 0, speed: 100, action: 0, actionTick: 0 }

/** vt18 0xbf3a0 — 목표에 닿았나 */
export function isWalkerArrived(walker: FieldWalker): boolean {
  return walker.x === walker.targetX && walker.z === walker.targetZ
}

/** vt10 0xa124c — 목표를 지금 자리로 · 동작 0 (칸 +0xac 는 그대로) */
export function standWalker(walker: FieldWalker): FieldWalker {
  return { ...walker, targetX: walker.x, targetZ: walker.z, action: FIELDER_ACTION.stand }
}

/** 0xbee60 · 0xbee84 — 자리만 옮긴다 (목표는 그대로) */
export function placeWalker(walker: FieldWalker, point: { readonly x: number; readonly z: number }): FieldWalker {
  return { ...walker, x: point.x, z: point.z }
}

/** vt44 0xa1234 — 동작이 다를 때만 바꾸고 칸을 0 으로 */
export function setWalkerAction(walker: FieldWalker, action: number): FieldWalker {
  return walker.action === action ? walker : { ...walker, action, actionTick: 0 }
}

/** 0xbec7c — 걸음 바꾸기 */
export function setWalkerSpeed(walker: FieldWalker, speed: number): FieldWalker {
  return { ...walker, speed }
}

/** 0xa0ee8 — 목표 쪽 달리기 동작 (목표가 지금 자리면 0) */
export function walkDirectionActionOf(walker: FieldWalker): number {
  if (isWalkerArrived(walker)) return FIELDER_ACTION.stand
  const dx = walker.targetX - walker.x
  const dz = walker.targetZ - walker.z
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? FIELDER_ACTION.runRight : FIELDER_ACTION.runLeft
  return dz > 0 ? FIELDER_ACTION.runDown : FIELDER_ACTION.runUp
}

/** 0xa21bc — 목표를 점으로 · 방향 동작 · 걸음 220 */
export function aimWalker(walker: FieldWalker, point: { readonly x: number; readonly z: number }): FieldWalker {
  const aimed = { ...walker, targetX: point.x, targetZ: point.z }
  return { ...setWalkerAction(aimed, walkDirectionActionOf(aimed)), speed: FIELDER_SPEED }
}

/** 0xbef58 — 자리 · 목표를 함께 그 점으로 (선 채로 놓기) */
export function setWalkerAt(walker: FieldWalker, point: { readonly x: number; readonly z: number }): FieldWalker {
  return { ...walker, x: point.x, z: point.z, targetX: point.x, targetZ: point.z }
}

/** 갱신 한 번의 걷기 — 0x4f7ac · 0x405b0: 안 닿았으면 +0xac += 1 뒤 vt24 한 걸음 */
export function stepWalker(walker: FieldWalker): FieldWalker {
  const moved = stepToward({ x: walker.x, y: 0, z: walker.z }, { x: walker.targetX, y: 0, z: walker.targetZ }, walker.speed)
  return { ...walker, x: moved.x, z: moved.z, actionTick: walker.actionTick + 1 }
}
