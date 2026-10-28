import { magicBallKindAtPath } from '@/entities/pitcher-career/model/magicPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND, ballFrameOf, projectToScreen, type WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { bezierPointAt } from '@/shared/lib/bezier/bezier'
import { STAGE_HEIGHT, toPixel } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 공 궤적 — 원본은 3D 곡선 N 점(0x4dc78)을 한 틱에 한 점씩 옮기고 투영한다(0xbe3d8, 0x35854).
 * CPU 투구 · 사용자 투구(`buildHumanPitch`) 모두 원본 곡선(pitch.worldPath)을 그대로 투영한다.
 * 곡선이 없는 공은 와인드업 자리 공(`windUpCpuPitchOf`, `frameCount` 0 이라 그리지 않는다)과 시험뿐이다 — 그때만
 * 화면 좌표 [릴리스, 도착점 − 변화량, 도착점] 세 점으로 같은 베지어를 돈다 (원본에 없는 대체 길).
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
  const bend = toPixel({ x: pitch.plate.x - pitch.breakOffset.x, y: pitch.plate.y - pitch.breakOffset.y }, pitch.stageSide)
  const controlPoints = [RELEASE_PIXEL, bend, plate].map((point) => ({
    x: Math.round(point.x * FIXED_POINT),
    y: Math.round(point.y * FIXED_POINT),
  }))
  const index = clampFrame(frame, pitch.frameCount)
  const point = bezierPointAt(controlPoints, index, pitch.frameCount)
  return { x: point.x / FIXED_POINT, y: point.y / FIXED_POINT }
}

/** 0 채움 경로 칸 — 장면 객체는 장면 전환 0x3874 의 new(0x1b80)(0 채움)로 서서 첫 놓기 전 [경기+0x1140] 은 모두 (0, 0, 0) 이다 */
const ZERO_PATH_POINT: WorldPoint = { x: 0, y: 0, z: 0 }

/**
 * **장면 공 경로 칸의 화면 자리** — 0x35854(공 틱) = 0x35820 이 고른 점을 [경기+0x17e1](지금 타자 좌우, 타석 시작 0x3b084)의 원점으로
 * 투영한다. 0x35820 의 자르기는 **위 먼저**(35828~3582e: `t > N − 1` 이면 N − 1) **다음 아래**(35830~35834: `t < 0` 이면 0)라,
 * 장면 첫 놓기 전처럼 N = [+0x109c] = 0 이면 점 0 — 0 채움 칸 (0, 0, 0) 을 읽는다 (A-26, 2026-10-27 직접 떴다).
 * `path` 는 이 장면에서 마지막으로 경로를 채운 공(`sceneBallPathPitch`), 아직 없으면 null(0 채움 칸, N = 0).
 * 원점은 경로를 채운 공의 좌우가 아니라 **그리는 때의** 좌우 `side` 다(0x35896 이 그림마다 [+0x17e1] 을 읽는다)
 */
export function sceneBallPathPixelAt(path: readonly WorldPoint[] | null, ballTick: number, side: number): { x: number; y: number } {
  const count = path?.length ?? 0
  const index = Math.max(0, Math.min(ballTick, count - 1))
  return projectToScreen(path?.[index] ?? ZERO_PATH_POINT, side)
}

/** 공이 도착할 화면 좌표 — 이글아이 표시용 */
/**
 * 이글아이 자리 — 0x4d2ac 는 [경기+0x10b8](0x10 목표점, 오차 전)을 투영한다(4d2dc~4d2ea). 틱을 안 가려 놓은 공 · 놓기 전
 * 와인드업 자리 공(`windUpCpuPitchOf`) 모두 그 점(`aimTarget`)이다(r309). 목표점이 없는 공(사용자 투구 · 시험 공)은 도착점
 */
export function eagleEyePixelOf(pitch: Pitch): { x: number; y: number } {
  if (pitch.aimTarget !== undefined) return projectToScreen(pitch.aimTarget, pitch.stageSide)
  return platePixelOf(pitch)
}

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

/**
 * **타석 공 그림자** — 타석 공 그리기 0x3b2f4 가 공 그림(3b6de) 앞에서 0x356f8 로 그린다 (r271 직접 떴다 — 투영 해석 허가 10-26).
 * ```
 * 3b310  P = 0x35820(장면, 공 틱 [+0x1098])          ; 경로 [+0x1140 + 12 · clamp(틱, 0, N − 1)] — 월드 (x, y, z)
 * 3b33a  (bx, by) = [+0x218] vt+8(P)                 ; 투영 0xbe3d8 — 공 그리기 0x35854 가 쓰는 것과 같은 함수 · 같은 값
 * 3b350  (gx, gy) = 0xbe385([+0x218], P.x, 0, P.z)   ; 0xbe384 는 (x, y, z) 점을 세워 같은 vt+8 을 부르는 얇은 감쌈 — 높이 0 으로 내린 점
 * 3b35a  gx = bx                                     ; ★ 가로는 공 점의 투영 그대로, 세로만 땅점의 투영
 * 3b35c  크기 = 0x358fc(장면, P) — 공 그림 크기 칸(2~9, 종류 빼고)
 * 3b388  공 틱 [+0x1098] == 0 이거나 공 그림 칸이 없으면 그림자 없음
 * 3b39c  (sx, sy) = 0xb94b5([+0x1f4], 원점[+0x17e1].x + gx, 원점.y − gy)   ; 원점 표 0xcfb18 — 공 그리기 0x35854 와 같은 셈
 * 3b3ce  s = max(크기 − 4, 2)
 * 3b3d8  상태 0x11: 카메라 y(+0xff8) + sy + s ≥ 화면 높이(0x14008c8) 면 그리지 않음 · 0x13: 늘 · 그 밖(0x12 등): 그리지 않음
 * 3b416  0x356f8(카메라 x(+0xff4) + sx, 카메라 y + sy + 2, s)
 * ```
 * 투영 vt+8 = 0xbe3d8: d = P − 카메라(+4 · +8 · +0xc), 가로질 = (dy·cos − dz·sin)/100 · 깊이 = (dy·sin + dz·cos)/100,
 * 깊이 0 이면 (0, 0), 아니면 (dx·(F + 10) / |깊이|, 가로질·F / |깊이|), F = [+0x14] (`pitchCurve.projectToPlate` 와 같다).
 * 0xb94b5 → 0xb9480 은 (x · [+0x10] / [+8], y · [+0x14] / [+0xc]) 비율 바꾸기다 — 웹 공 그리기(`projectToScreen`)가 이미 1:1 로 쓰는 것과 같다.
 * 그래서 그림자 = (공 화면 x, 땅점 화면 y + 2) 이다. 카메라(+0xff4 · +0xff8)는 가운데(−120, −70)로 놓고, 0x13 카메라가 옮긴 몫은 그리기가
 * 캔버스를 옮겨 더한다(`hitCamera` — 공과 같다. 화면 높이 문턱은 0x13 이 아닐 때만 보므로 카메라에 안 걸린다).
 * `isBigHitState` 는 상태 0x13 — 0x13 의 타구 공(0x33e34 가 공 물리 +0xf2c 에서 경로를 다시 채운다, `hitBallPath`)은 `ballShadowOfPoint` 로 같은 셈을 탄다(r274).
 * 곡선이 없는 대체 공(시험 · 와인드업 자리)은 월드 점이 없어 그림자도 없다.
 */
export interface BallShadowPlacement {
  readonly x: number
  readonly y: number
  readonly size: number
}

/** 화면 높이 — 0x14008c8 이 돌려주는 값 (웹 타석 캔버스 높이) */
const BALL_SHADOW_SCREEN_HEIGHT = STAGE_HEIGHT
const BALL_SHADOW_SIZE_DROP = 4
const BALL_SHADOW_SMALLEST = 2
const BALL_SHADOW_Y_OFFSET = 2

export function ballShadowAt(pitch: Pitch, frame: number, isBigHitState = false): BallShadowPlacement | null {
  const path = pitch.worldPath
  if (frame === 0 || path === null || path.length === 0) return null
  const index = clampFrame(frame, path.length)
  return ballShadowOfPoint(path[index], ballFrameOf(path, index, 0), pitch.stageSide, isBigHitState, frame)
}

/**
 * 경로 점 하나의 그림자 (3b33a~3b422) — `ballSize` 는 0x358fc 의 공 크기 칸(2~9, 종류 빼고), `ballTick` 은 자르기 전 공 틱 [+0x1098].
 * 0x13 의 타구 공(`hitBallPath`)도 이 셈이다 — 크기만 0x358fc 의 0x13 갈래(`hitBallSizeOf`)고 화면 아래 끝을 안 본다.
 */
export function ballShadowOfPoint(
  point: WorldPoint,
  ballSize: number,
  side: number,
  isBigHitState: boolean,
  ballTick: number,
): BallShadowPlacement | null {
  if (ballTick === 0) return null
  const ball = projectToScreen(point, side)
  const ground = projectToScreen({ x: point.x, y: 0, z: point.z }, side)
  const size = Math.max(ballSize - BALL_SHADOW_SIZE_DROP, BALL_SHADOW_SMALLEST)
  if (!isBigHitState && ground.y + size >= BALL_SHADOW_SCREEN_HEIGHT) return null
  return { x: ball.x, y: ground.y + BALL_SHADOW_Y_OFFSET, size }
}

/**
 * **공 그리기 목록 깊이** — 0x3b2f4 가 공 그림(3b6de 0xbe8d5) · 강속구 불꽃(3b7cc 0xbe8a5)을 [sp+0x88] 로, 마구 이펙트(3b59e 0xbe8a5)를
 * [sp+0x88] + 1 로 넣는다. [sp+0x88] 은 0x35820 이 꺼낸 경로 점의 **월드 z**(투영 전 값)다.
 * 목록 0xbe810 은 깊이 오름차순 · 같은 깊이는 넣은 차례(be864 `bge`)라 공은 z 이하 깊이의 그림(투수 24500 · 타자 29705 …) 다음이다.
 */
export function ballDepthAt(pitch: Pitch, frame: number): number | null {
  const path = pitch.worldPath
  if (path === null || path.length === 0) return null
  return path[clampFrame(frame, path.length)].z
}
