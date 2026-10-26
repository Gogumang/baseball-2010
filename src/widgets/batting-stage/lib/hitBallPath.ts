import { projectToScreen, type WorldPoint } from '@/entities/pitching/model/pitchCurve'

/**
 * **상태 0x13 의 타구 공 경로** — 0x13 진입 0x3d720 이 부르는 0x33e34 가 [경기+0xf2c] 공(판 공과 수평각만 d 다른 공,
 * `earlyPassPatternOf`)의 점으로 타석 공 경로 +0x1140 을 **다시 채운다** (r274 직접 떴다 — 투영 해석 허가 10-26).
 * ```
 * 33e40  N = [[경기+0xf2c]+0x6c] → +0x109c(점 수) ; +0x1090(땅 번호) = −1
 * 33e7a  i = 0 … N − 1: P = 0xa25b0(공, i)                       ; 공 물리의 i 번째 점 (x, y, z)
 * 33e8c    x += [+0x17e1] ≠ 0 ? +0x249 : −0x249                   ; 타자 손(0 우타 · 1 좌타)
 * 33ea6    y −= 0x190 ; z −= 0x514
 * 33ec2    y ≤ 0x257 이면 y = (6y + 0x960) / 10                    ; 곧 원래 y 로는 trunc(6y / 10)
 * 33ee6    q = −|y| / 35 ; t = q · z / 30000 ; r = t + 0x127, 음수면 0
 * 33f12    x += r · (x − 20000) / 1000
 * 33f28    z −= r · (z − 30000) / 1000
 * 33f44    +0x1090 == −1 이고 y == 0 이면 +0x1090 = i
 * ```
 * 나눗셈은 모두 0xca7b5(부호 있는 나눗셈, 0 쪽 자름)다. 높이가 0 에 가까울수록 r 이 커서(최대 295) 점이 홈 (20000, ·, 30000)
 * 쪽으로 당겨진다 — 타석 카메라(0xbe3d8, 투수판 너머를 보는 시야)에 공이 날아가는 모습이 들어오도록 줄이는 셈이다.
 *
 * 그리기는 0x11 공과 같은 0x3b2f4 — 0x35820 이 공 틱 [+0x1098] 을 [0, N − 1] 로 잘라 이 경로의 점을 고르고,
 * 0x35854 가 같은 투영 0xbe3d8(카메라 [+0x218])로 화면에 놓는다. 크기만 0x358fc 의 0x13 갈래(`hitBallSizeOf`)다.
 */
export interface HitBallPath {
  /** 0x33e34 가 채운 경로 점 — +0x1140 + 12 · i */
  readonly points: readonly WorldPoint[]
  /** +0x1090 — 높이가 처음 0 이 된 점 번호, 없으면 −1 */
  readonly groundIndex: number
}

const SIDE_SHIFT = 0x249
const HEIGHT_DROP = 0x190
const DEPTH_DROP = 0x514
const LOW_HEIGHT = 0x257
const PULL_BASE = 0x127
const HOME_X = 20000
const HOME_Z = 30000

/** 0x33e34 — `trajectory` 는 [경기+0xf2c] 공의 궤적, `side` 는 +0x17e1 (0 우타 · 1 좌타) */
export function hitBallPathOf(
  trajectory: { readonly length: number; pointAt(tick: number): WorldPoint },
  side: number,
): HitBallPath {
  const points: WorldPoint[] = []
  let groundIndex = -1
  for (let index = 0; index < trajectory.length; index += 1) {
    const point = trajectory.pointAt(index)
    const shiftedX = point.x + (side !== 0 ? SIDE_SHIFT : -SIDE_SHIFT)
    const droppedY = point.y - HEIGHT_DROP
    const y = droppedY > LOW_HEIGHT ? droppedY : Math.trunc((6 * droppedY + 0x960) / 10)
    const droppedZ = point.z - DEPTH_DROP
    const q = Math.trunc(-Math.abs(y) / 35)
    const pull = Math.max(0, Math.trunc((q * droppedZ) / 30000) + PULL_BASE)
    const x = shiftedX + Math.trunc((pull * (shiftedX - HOME_X)) / 1000)
    const z = droppedZ - Math.trunc((pull * (droppedZ - HOME_Z)) / 1000)
    points.push({ x, y, z })
    if (groundIndex === -1 && y === 0) groundIndex = index
  }
  return { points, groundIndex }
}

/** 0x358fc 의 0x13 갈래 — 깊이 기준 [0xcfa8c+8] = 24500(투수판) · [0xcfa8c+0x14] = 29705(타석) */
const SIZE_NEAR = 29705
const SIZE_FAR = 24500
const SMALLEST_BALL = 2
const LARGEST_BALL = 9

/**
 * 0x13 공 그림 크기 — `trunc((z − 24500) · 10 / (29705 − 24500))` 를 [2, 9] 로 자른다 (35906~35922 · 35966~35972).
 * 0x11 처럼 경로 첫 · 끝 점과 견주지 않고 늘 투수판 ~ 타석 깊이로 잰다. 종류 [+0x1080] 은 0x13 진입(3d78e)이 0 으로 둔다.
 */
export function hitBallSizeOf(point: WorldPoint): number {
  const size = Math.trunc(((point.z - SIZE_FAR) * 10) / (SIZE_NEAR - SIZE_FAR))
  return Math.min(LARGEST_BALL, Math.max(SMALLEST_BALL, size))
}

const clampTick = (tick: number, length: number) => Math.max(0, Math.min(tick, length - 1))

/** 0x35820 — 공 틱을 [0, N − 1] 로 자른 경로 점 */
export function hitBallPointAt(path: HitBallPath, ballTick: number): WorldPoint | null {
  if (path.points.length === 0) return null
  return path.points[clampTick(ballTick, path.points.length)]
}

/** 0x35854 — 경로 점의 화면 자리 (카메라 흔들림 +0xff4 · +0xff8 은 웹 타석이 안 얹는다 — `bigHitScreen` 머리말) */
export function hitBallPixelAt(path: HitBallPath, ballTick: number, side: number): { readonly x: number; readonly y: number } | null {
  const point = hitBallPointAt(path, ballTick)
  return point === null ? null : projectToScreen(point, side)
}

/**
 * 0x13 그림이 보는 공 틱 [+0x1098] — 0x13 진입(3d77e)이 0 으로 두고 틀 끝 0x3f378(3f450)이 +1 한다. 그리기는 그 틀의 갱신 뒤 ·
 * 틀 끝 앞이라 상태 틱 k 의 그림은 공 틱 k 를 본다. 큰 타구는 막음 +0x10a0 이 풀리는 그림(`releaseTick`)까지 +1 을 건너뛰어
 * max(0, k − releaseTick) 이다 (`hitPause.HIT_STOP_TICKS` · `bigHitScreen`).
 */
export function hitBallTickOf(stateTick: number, releaseTick: number | null): number {
  if (releaseTick === null) return Math.max(0, stateTick)
  return Math.max(0, stateTick - releaseTick)
}
