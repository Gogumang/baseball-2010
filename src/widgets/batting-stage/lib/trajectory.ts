import { magicBallKindAtPath } from '@/entities/pitcher-career/model/magicPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND, ballFrameOf, projectToScreen } from '@/entities/pitching/model/pitchCurve'
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

/**
 * 공 그림 종류 = 경기+0x1080 — ball.pzx 는 종류 3 × 크기 11칸이다
 * (000~010 보통 · 011~022 불꽃 · 023~033 날개). 0 이 아닌 값을 쓰는 곳은 둘이다
 * (근거는 `entities/pitcher-career/model/magicPitch.ts` 의 `MAGIC_BALL_KIND_BY_NUMBER` 주석):
 *   - 던질 때 `0x46fa8` — **발렌타인(마구 8) → 2(날개) · 드래고나(마구 9) → 1(불꽃)**.
 *     `selectPitch` 가 정해 `pitch.ballKind` 로 실어 보낸다.
 *   - 날아가는 도중 `0x3b55e` (타석 공 그리기 0x3b2f4) — 마구 1, 그리고 폼 묶음 0 인 마구 4 는
 *     공 경로 번호(경기+0x1098) 가 8 인 틱부터 1(불꽃). 공 그리기(0x3b62e·0x3b6ae)가 그 뒤에 다시 읽으므로
 *     바로 그 틱부터 불꽃 공이다 → `magicBallKindAtPath`.
 *     이 갈래의 경기+0x1040(effect_fire/effect_shinning) 조건은 적재 0x47cc8 의 실리는 조건과 같아서
 *     (`magicBallEffect.ts` 의 `magicBallEffectFolderOf`) 마구 번호·폼만으로 갈린다.
 * 경로 번호는 웹의 `frame` 과 같은 칸이다 (`magicBallEffectFrameAt` 과 같은 기준).
 */
const DEFAULT_BALL_KIND = 0
const SMALLEST_BALL = 2
const LARGEST_BALL = 9

/** 이 틱(공 경로 번호 `frame`)의 공 그림 종류 */
export function ballKindAt(pitch: Pitch, frame: number): number {
  return magicBallKindAtPath({
    isMagicPitch: pitch.isMagicPitch === true,
    magicNumber: pitch.pitcherMagicNumber ?? 0,
    pitcherForm: pitch.pitcherForm ?? 0,
    pathIndex: frame,
    selectedBallKind: pitch.ballKind ?? DEFAULT_BALL_KIND,
  })
}

/** ball.pzx 프레임 번호 */
export function ballFrameIndexAt(pitch: Pitch, frame: number): number {
  const path = pitch.worldPath
  const ballKind = ballKindAt(pitch, frame)
  if (path !== null && path.length > 0) return ballFrameOf(path, clampFrame(frame, path.length), ballKind)
  const ratio = Math.max(0, Math.min(1, frame / Math.max(1, pitch.frameCount - 1)))
  return SMALLEST_BALL + Math.round(ratio * (LARGEST_BALL - SMALLEST_BALL)) + BALL_FRAMES_PER_KIND * ballKind
}
