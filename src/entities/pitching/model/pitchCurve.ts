import { bezierPoint3At } from '@/shared/lib/bezier/bezier'
import type { CurvePoint3 } from '@/shared/lib/bezier/bezier'
import { atan2Degrees, integerSquareRoot, sineHundred } from '@/shared/lib/math/originalTrigonometry'
import { PITCH_RECORDS } from '@/shared/config/original/pitchRecords'
import type { PitchRecord } from '@/shared/config/original/pitchRecords'

/**
 * 투구 3D 곡선 (0x4dc78 이 game+0x1140 을 채운다 — 위치 분석 2·5차, 바이트 확인).
 *   1. 레코드: 구질 t 의 레코드 중 폼 L 의 k 번째 (k = 구속 단계). 홀수 폼(≤5)은 L−1 을 쓴다 (0x9e944)
 *   2. 폼 1·3·5·6 이면 제어점 x 를 뒤집는다 (0x9e3c8, 폼 매핑표 0xd7538 은 항등)
 *   3. 발사점 S 를 더하고, 목표점 T 쪽으로 가운데 제어점을 휜다 → 마지막 제어점 = T
 *   4. 베지어로 N 점 (한 틱에 한 점)
 * 투영 0xbe3d8: 카메라 (20000, 3470, 31500), 27° (sin 45 · cos 89), 초점 156/146.
 */
export type WorldPoint = CurvePoint3

export const RELEASE_ORIGIN: WorldPoint = { x: 20000, y: 0, z: 24500 }
/** 존 중심 (표 0xcfbcc) — side 0 · 1 */
export const ZONE_CENTERS: readonly WorldPoint[] = [
  { x: 19415, y: 1202, z: 29705 },
  { x: 20585, y: 1202, z: 29705 },
]
export const PLATE_DEPTH = 29705

const MIRRORED_FORMS: ReadonlySet<number> = new Set([1, 3, 5, 6])
const LAST_PAIRED_FORM = 5

export const isMirroredForm = (form: number) => MIRRORED_FORMS.has(form)

/** 폼에 맞는 레코드가 없으면(마선수 폼에 없는 구질) 폼 0 을 쓴다 — 원본 동작은 미확인 (추정) */
export function pitchRecordOf(typeNumber: number, form: number, speedStage: number): PitchRecord {
  const records = PITCH_RECORDS[typeNumber - 1] ?? PITCH_RECORDS[0]
  const level = form <= LAST_PAIRED_FORM && form % 2 === 1 ? form - 1 : form
  const sameForm = records.filter((record) => record.form === level)
  const candidates = sameForm.length > 0 ? sameForm : records.filter((record) => record.form === 0)
  return candidates[Math.min(speedStage, candidates.length - 1)]
}

const PERCENT = 100

/** 가운데 제어점을 목표 방향으로 휜다 — y 먼저, 그다음 x (0x4dc78) */
export function bendControlPoints(points: readonly WorldPoint[], target: WorldPoint): WorldPoint[] {
  const bent = points.map((point) => ({ ...point }))
  const last = bent.length - 1
  const depth = target.z - RELEASE_ORIGIN.z
  const angleY = atan2Degrees(depth, target.y - bent[last].y)
  for (let index = 1; index < last; index += 1) {
    const reach = integerSquareRoot((bent[index].y - RELEASE_ORIGIN.y) ** 2 + (bent[index].z - RELEASE_ORIGIN.z) ** 2)
    bent[index].y += Math.trunc((sineHundred(angleY) * reach) / PERCENT)
  }
  const angleX = atan2Degrees(depth, target.x - bent[last].x)
  for (let index = 1; index < last; index += 1) {
    const reach = integerSquareRoot((bent[index].x - RELEASE_ORIGIN.x) ** 2 + (bent[index].z - RELEASE_ORIGIN.z) ** 2)
    bent[index].x += Math.trunc((sineHundred(angleX) * reach) / PERCENT)
  }
  bent[last] = { ...target }
  return bent
}

export interface PitchPathRequest {
  /** 원본 구질 번호 1~21 (22 = 마구) */
  readonly typeNumber: number
  readonly form: number
  readonly speedStage: number
  readonly target: WorldPoint
  /**
   * 레코드를 폼·구속 단계로 찾지 않고 블록 안 번호로 곧장 고른다 — 마구(구질 22)용.
   * 마구는 구속 단계 레코드가 없고 번호가 `3(m−1) + 폼/2` 또는 `m + 7` 이다 (0x9e944, H2 3-5).
   */
  readonly recordIndex?: number
}

/** 월드 좌표 N 점. B-스플라인 레코드(곡선 종류 1)는 미해독이라 베지어로 돈다 (추정) */
export function pitchPathOf({ typeNumber, form, speedStage, target, recordIndex }: PitchPathRequest): WorldPoint[] {
  const record =
    recordIndex === undefined
      ? pitchRecordOf(typeNumber, form, speedStage)
      : PITCH_RECORDS[typeNumber - 1]?.[recordIndex] ?? pitchRecordOf(typeNumber, form, speedStage)
  const mirror = isMirroredForm(form) ? -1 : 1
  const controlPoints = record.points.map(([x, y, z]) => ({
    x: x * mirror + RELEASE_ORIGIN.x,
    y: y + RELEASE_ORIGIN.y,
    z: z + RELEASE_ORIGIN.z,
  }))
  const bent = bendControlPoints(controlPoints, target)
  return Array.from({ length: record.frames }, (_unused, index) => bezierPoint3At(bent, index, record.frames))
}

const CAMERA = { x: 20000, y: 3470, z: 31500 }
const CAMERA_SINE = 45
const CAMERA_COSINE = 89
const FOCAL_X = 156
const FOCAL_Y = 146
/** 투구 원점 (표 0xcfb18) — side 0 · 1 */
const PITCH_ORIGINS = [
  { x: 276, y: 258 },
  { x: 203, y: 258 },
]
/** 카메라 오프셋 — 월드 480×390 을 240×320 화면으로 본다 */
const SCREEN_OFFSET = { x: -120, y: -70 }

/** 판정용 좌표 (카메라 오프셋 없음, game+0x10dc/0x10e0) */
export function projectToPlate(point: WorldPoint, side: number): { x: number; y: number } {
  const dx = point.x - CAMERA.x
  const dy = point.y - CAMERA.y
  const dz = point.z - CAMERA.z
  const across = Math.trunc((dy * CAMERA_COSINE - dz * CAMERA_SINE) / PERCENT)
  const depth = Math.trunc((dy * CAMERA_SINE + dz * CAMERA_COSINE) / PERCENT)
  const origin = PITCH_ORIGINS[side] ?? PITCH_ORIGINS[0]
  if (depth === 0) return { ...origin }
  const screenX = Math.trunc((dx * FOCAL_X) / Math.abs(depth))
  const screenY = Math.trunc((across * FOCAL_Y) / Math.abs(depth))
  return { x: origin.x + screenX, y: origin.y - screenY }
}

export function projectToScreen(point: WorldPoint, side: number): { x: number; y: number } {
  const plate = projectToPlate(point, side)
  return { x: plate.x + SCREEN_OFFSET.x, y: plate.y + SCREEN_OFFSET.y }
}

const BALL_SIZE_STEPS = 10
const SMALLEST_BALL = 2
const LARGEST_BALL = 9
export const BALL_FRAMES_PER_KIND = 11

/** ball.pzx 프레임 = clamp(trunc((z−z0)·10/(zN−z0)), 2, 9) + 11·공 종류 (0x358fc) */
export function ballFrameOf(path: readonly WorldPoint[], index: number, ballKind: number): number {
  const first = path[0].z
  const span = path[path.length - 1].z - first
  const size = span === 0 ? SMALLEST_BALL : Math.trunc(((path[index].z - first) * BALL_SIZE_STEPS) / span)
  return Math.min(LARGEST_BALL, Math.max(SMALLEST_BALL, size)) + BALL_FRAMES_PER_KIND * ballKind
}
