import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import { hitBallPointAt, hitBallTickOf, type HitBallPath } from '@/widgets/batting-stage/lib/hitBallPath'

/**
 * **상태 0x13 의 타석 카메라** — 틀 머리 0x3f060 의 3f1dc~3f2d8 (r292 직접 떴다). 타석 카메라 [경기+0x1ec] 는 따라가기형 0xc0570
 * (vtable 0xd8ee8)이고 장면 초기화 0x3e340 이 세계 480 × 390 · 시야 = 화면(배율 [+0x1f4] 은 480×390 → 480×390, 3e414~3e426 —
 * 0xb9505 가 화면 크기를 그대로 돌려준다)으로 세운다(3e5b0~3e5c6):
 * ```
 * 카메라 칸  +8 · +0xc 세계 폭 · 높이 · +0x10 · +0x14 시야 폭 · 높이 · +0x18 · +0x1c 지금 (x, y) · +0x20 · +0x24 목표 · +0x2c 속도 %
 * vt+0x2c 0xc0660  목표 = (x, y) → vt+0x30 0xc062c 로 [0, 세계 − 시야] 자르기 → 지금 = 목표(곧바로)
 * vt+0xc  0xc074d  vt+0x20 0xc05f0(가운데 맞추기: x − 시야/2, y − 시야/2) → 지금 = 목표
 * ```
 * 0x3f060 은 0x13 이 아닌 상태(0x33c98 필드 화면이 아닐 때)마다 3f2fe~3f30e `vt+0xc(240, 389)` 로 카메라를 가운데로 되돌린다 —
 * 240 × 320 화면이면 (120, 70) 이고 웹 고정 오프셋 `projectToScreen` 의 (−120, −70) 이 그 값이다.
 * 0x13 이면:
 * ```
 * 3f1ea  막음 [+0x10a0] ≠ 0 이면 끝(카메라 · 스윙 모두 그대로)                     ; 큰 타구 멈춤 동안
 * 3f1fe  0xc0559(카메라, 0)                                                         ; 속도 % = 0 (아래 vt+0x2c 가 곧바로 놓아 안 쓴다)
 * 3f20c  P = 0x35854(공 틱 [+0x1098]) · Q = 0x35854(max(공 틱 − 1, 0))              ; 경로 점의 화면 자리 = 투영 + (+0xff4, +0xff8)
 * 3f222  cx = 카메라.vt14(+0x18) · cy = 카메라.vt18(+0x1c)
 * 3f23e  a = s16 [+0xfcc] (판정 각) — −180 < a < 0 이면
 * 3f24a    0xbce91(&cx, P.x, min(|P.x − Q.x| >> 1, 30)) · 0xbce91(&cy, P.y, min(|P.y − Q.y| >> 1, 30))
 * 3f27c  손 [+0x17e1] ≠ 0: a + 90 > 0 이면 cx = min(cx, 170) · 아니면 cx = max(cx, 0)
 *        손 == 0      : a + 90 ≥ 0 이면 cx = min(cx, 350) · 아니면 cx = max(cx, 80)
 * 3f2c8  카메라.vt2c(cx, cy) → 3f2d8 카메라.vt28(따라가기 — 지금 = 목표라 할 일 없음)
 * ```
 * 0xbce91(&v, 목표, %) — v == 목표면 끝, 아니면 v += trunc(% × (목표 − v) / 100) ± 1(목표 쪽), 그 뒤 목표와 1 차이거나 % == 100 이면
 * v = 목표 (bce9e~bceca).
 * P · Q 는 **화면** 자리(0x35854 가 (+0xff4, +0xff8) = −카메라를 더한다)인데 cx · cy 는 카메라(세계) 자리다 — 원본이 두 좌표를 섞어
 * 견준다. 그대로 옮긴다(카메라는 공 세계 x 의 절반 쪽으로 다가간다).
 *
 * 틀 차례: 0x13 진입 0x3d720(52d30, 공 틱 = 0)이 틀 머리 0x3f060(52e16)보다 앞이라 0x13 틱 0 의 틀 머리가 이미 0x13 을 본다. 틀 머리의
 * 공 틱은 그 틀 갱신 · 그림이 보는 공 틱과 같다(`hitBallTickOf` — 틀 끝 0x3f378 이 올린다). (+0xff4, +0xff8) 은 0x41230(52f36, 그림 앞)이
 * 카메라 지금 자리를 0xb9481(배율 [+0x1f4] = 같은 크기)로 −x · −y 로 옮겨 적는다 — 그래서 틀 머리의 P · Q 는 앞 틀 카메라로 투영한다.
 * 막음 [+0x10a0] 은 큰 타구 0x13 틱 r(`bigHitReleaseTickOf`)의 그림이 푼다 — 틀 머리는 틱 r + 1 부터 돈다. 창이 선 첫 그림은 틀 머리를
 * 안 돌아 카메라가 그대로다.
 */
export interface StageCamera {
  readonly x: number
  readonly y: number
}

/** 0x3f060 3f2fe — vt+0xc(240, 389) 를 240 × 320 시야 · 480 × 390 세계로 자른 가운데 자리 */
export const STAGE_CAMERA_HOME: StageCamera = { x: 120, y: 70 }

/** 타석 카메라 세계 480 × 390 (3e5b0 · 3e5be) − 시야 240 × 320 — vt+0x30 0xc062c 의 자르기 끝 */
const CAMERA_MAX = { x: 480 - 240, y: 390 - 320 } as const

/** 3f256 · 3f270 — 따라가기 % 상한 */
const FOLLOW_PERCENT_MAX = 30

/** 0xbce91 — 한 축을 목표 쪽으로 % 만큼(최소 1) 옮긴다 */
export function approachCameraAxis(value: number, target: number, percent: number): number {
  if (value === target) return value
  const step = Math.trunc((percent * (target - value)) / 100) + (target > value ? 1 : -1)
  const next = value + step
  if (next + 1 === target || next - 1 === target || percent === 100) return target
  return next
}

/** 3f27c~3f2be — 손 · 판정 각으로 가로 한쪽만 자른다 */
function clampFollowX(x: number, side: number, angle: number): number {
  if (side !== 0) return angle + 90 > 0 ? Math.min(x, 170) : Math.max(x, 0)
  return angle + 90 >= 0 ? Math.min(x, 350) : Math.max(x, 80)
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max))

export interface HitCameraInput {
  /** 0x33e34 가 채운 0x13 공 경로 (`hitBallPath`) */
  readonly path: HitBallPath
  /** 타자 손 +0x17e1 (0 우타 · 1 좌타) */
  readonly side: number
  /** 판정 각 s16 [+0xfcc] — 판 패턴 각의 부호를 뒤집은 값(`hitCameraAngleOf`) */
  readonly angle: number
  /** 큰 타구 막음을 푸는 0x13 틱(`bigHitReleaseTickOf`) — 막음이 없는 타구는 null */
  readonly releaseTick: number | null
}

/** 판 패턴 각(0~359) → 원본 [+0xfcc] — 타격 경로는 패턴 각의 부호를 뒤집어 넣는다(S8 · `earlyPassBall`) */
export function hitCameraAngleOf(patternAngle: number): number {
  return -patternAngle
}

/** 0x13 틱 `stateTick` 그림의 카메라 — 0x13 틱 0 부터 틀 머리를 차례로 돌린다 */
export function hitCameraAt(input: HitCameraInput, stateTick: number): StageCamera {
  let x = STAGE_CAMERA_HOME.x
  let y = STAGE_CAMERA_HOME.y
  if (input.path.points.length === 0) return STAGE_CAMERA_HOME
  const follows = input.angle < 0 && input.angle + 0xb4 > 0
  for (let tick = 0; tick <= stateTick; tick += 1) {
    // 3f1ea — 막음이 선 틀 머리는 카메라를 건드리지 않는다(풀린 그림 다음 틀부터)
    if (input.releaseTick !== null && tick <= input.releaseTick) continue
    const ballTick = hitBallTickOf(tick, input.releaseTick)
    const now = hitBallPointAt(input.path, ballTick)
    const before = hitBallPointAt(input.path, Math.max(ballTick - 1, 0))
    if (now === null || before === null) break
    let cx = x
    let cy = y
    if (follows) {
      const p = projectToPlate(now, input.side)
      const q = projectToPlate(before, input.side)
      // 0x35854 — 화면 자리 = 투영 − 지금 카메라(앞 틀의 0x41230 이 적은 +0xff4 · +0xff8)
      const px = p.x - x
      const py = p.y - y
      cx = approachCameraAxis(cx, px, Math.min(Math.abs(p.x - q.x) >> 1, FOLLOW_PERCENT_MAX))
      cy = approachCameraAxis(cy, py, Math.min(Math.abs(p.y - q.y) >> 1, FOLLOW_PERCENT_MAX))
    }
    cx = clampFollowX(cx, input.side, input.angle)
    // vt+0x2c → vt+0x30 — 세계 안으로 자르고 곧바로 놓는다
    x = clamp(cx, CAMERA_MAX.x)
    y = clamp(cy, CAMERA_MAX.y)
  }
  return { x, y }
}

/** 그림을 옮길 값 — 고정 오프셋(−120, −70) 그림 위에 (+0xff4, +0xff8) 의 차이만큼 */
export function stageCameraShiftOf(camera: StageCamera | null | undefined): { readonly dx: number; readonly dy: number } {
  if (camera === null || camera === undefined) return { dx: 0, dy: 0 }
  return { dx: STAGE_CAMERA_HOME.x - camera.x, dy: STAGE_CAMERA_HOME.y - camera.y }
}
