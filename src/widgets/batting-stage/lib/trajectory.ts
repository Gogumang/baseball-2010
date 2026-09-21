import type { Pitch } from '@/entities/pitching/model/pitch'
import { ballFrameOf, projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { bezierPointAt } from '@/shared/lib/bezier/bezier'
import { toPixel } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 공 궤적 — 원본은 3D 곡선 N 점(0x4dc78)을 한 틱에 한 점씩 옮기고 투영한다(0xbe3d8, 0x35854).
 * CPU 투구는 원본 곡선(pitch.worldPath)을 그대로 투영한다.
 * 곡선이 없는 사용자 투구(투수편)만 화면 좌표 [릴리스, 도착점 − 변화량, 도착점] 세 점으로 같은 베지어를 돈다 (추정).
 * 릴리스 지점은 원본 직구 곡선 첫 점의 side1 투영 (73,167) 이다 (위치 분석 6차 계산 — 다른 구질의 첫 점은 다를 수 있다).
 */
export const RELEASE_PIXEL = { x: 73, y: 167 } as const

/** 베지어 정수식에 넣을 고정소수 배율 — 픽셀 이하 움직임을 살린다 */
const FIXED_POINT = 16

const clampFrame = (frame: number, length: number) => Math.max(0, Math.min(frame, length - 1))

export function ballPixelAt(pitch: Pitch, frame: number): { x: number; y: number } {
  const path = pitch.worldPath
  if (path !== null && path.length > 0) {
    return projectToScreen(path[clampFrame(frame, path.length)], pitch.stageSide)
  }
  const plate = toPixel(pitch.plate, pitch.stageSide)
  const bend = toPixel(
    { x: pitch.plate.x - pitch.breakOffset.x, y: pitch.plate.y - pitch.breakOffset.y },
    pitch.stageSide,
  )
  const controlPoints = [RELEASE_PIXEL, bend, plate].map((point) => ({
    x: Math.round(point.x * FIXED_POINT),
    y: Math.round(point.y * FIXED_POINT),
  }))
  const index = clampFrame(frame, pitch.frameCount)
  const point = bezierPointAt(controlPoints, index, pitch.frameCount)
  return { x: point.x / FIXED_POINT, y: point.y / FIXED_POINT }
}

/** 공이 도착할 화면 좌표 — 이글아이 표시용 */
export function platePixelOf(pitch: Pitch): { x: number; y: number } {
  const path = pitch.worldPath
  if (path !== null && path.length > 0) return projectToScreen(path[path.length - 1], pitch.stageSide)
  return toPixel(pitch.plate, pitch.stageSide)
}

/** 공 종류(game+0x1080)의 뜻은 미해독이라 첫 묶음(0)을 쓴다 (추정) */
const BALL_KIND = 0
const SMALLEST_BALL = 2
const LARGEST_BALL = 9

/** ball.pzx 프레임 번호 */
export function ballFrameIndexAt(pitch: Pitch, frame: number): number {
  const path = pitch.worldPath
  if (path !== null && path.length > 0) return ballFrameOf(path, clampFrame(frame, path.length), BALL_KIND)
  const ratio = Math.max(0, Math.min(1, frame / Math.max(1, pitch.frameCount - 1)))
  return SMALLEST_BALL + Math.round(ratio * (LARGEST_BALL - SMALLEST_BALL))
}
