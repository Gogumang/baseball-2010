/** 공 그림 프레임 · 공 그림자 (0x36dfc) */
import { ballShadowPiecesAt } from '@/shared/lib/ballShadow/ballShadowPieces'
import type { BallShadowPiece } from '@/shared/lib/ballShadow/ballShadowPieces'

/**
 * 공 그림 프레임 — 0x17 공 그리기 0x36dfc(36efa~36f56, 직접 뜸).
 *
 * ball.pzx 는 **공 종류 3 × 크기 11칸**이다 (그림 = 크기 + 11 × 종류):
 *   - 000~010 보통 야구공 (2×2 → 12×12)
 *   - 011~022 **불꽃 공** — 마구 1 "파이어 볼" 쪽 그림
 *   - 023~033 **날개 달린 공** — 또 다른 마구 그림 (가로로 길다, 최대 33×11)
 *
 * ```
 * 36efa  크기 = 0xca7b4(공 높이 y, 2000) + 4 ; 크기 > 10 이면 10           ; 아래 자르기는 없다
 * 36f3a  그림 = 크기 + 11 × [경기+0x1080]                                     ; 0xbe8d4 로 그리기 목록에
 * ```
 * 경기+0x1080(공 그림 종류)은 0x17 진입 0x46418 이 끝(467fe)에서 **0 으로 둔다** — 그 뒤 0x17 동안 쓰는 곳이 없다
 * (쓰는 곳 전수 R2 14-1: 0x3d78e · 0x3d988 · 0x467fe 는 0, 마구 갈래 0x4725c · 0x4736e · 0x3b55e 는 타석 그리기 0x4d64c ·
 * 0x3b2f4 안). 그래서 수비 화면의 공은 늘 보통 공(종류 0)이고, 땅에 있어도 004 부터다(000~003 은 안 쓴다).
 */
export const BALL_HEIGHT_PER_FRAME = 2000
/** 땅(높이 0)의 크기 칸 (36f06 `adds r0, #4`) */
export const BALL_GROUND_FRAME = 4
const BALL_MAX_FRAME = 10
export function ballFrameOf(height: number): number {
  return Math.min(Math.trunc(height / BALL_HEIGHT_PER_FRAME) + BALL_GROUND_FRAME, BALL_MAX_FRAME)
}

/** 공중 공의 그림자 크기 (36fbc) · 땅 공(화면 높이 0)의 크기 (36fda) */
export const BALL_SHADOW_SIZE_AIR = 3
export const BALL_SHADOW_SIZE_GROUND = 5

/**
 * **공 그림자** — 0x36dfc 의 37268 이 부르는 0x356f8(x, y, s) (직접 뜸). 공 땅점 (x, z)의 화면 자리에 그린다.
 * ```
 * 36fba  s = 3 ; 화면 높이 h(0xb94b4(카메라, 0, y)) < 0 이면 그림자 없음(3736c)
 * 36fc6  땅점 화면 y(ff0 + z 투영) < 1 이면 그림자 없음
 * 36fd4  h == 0(땅)이면 s = 5
 * 37268  0x356f8(땅점 화면 x, 땅점 화면 y, s)
 * 356f8  x0 = x − (s >> 1) · y0 = y − (s >> 1) ; 색 0(검정) ; 기기 사각 칠 0x14006e8(x0, y0, s + 1, s + 1)
 * 35734  s > 2 면 색 (100, 100, 100) ; 기기 선 0x14006c8 넷(두 끝 다 칠한다):
 *          (x0 − 1, y0 + 1)–(x0 − 1, y0 + s − 1) · (x0 + s + 1, y0 + 1)–(x0 + s + 1, y0 + s − 1)
 *          (x0 + 1, y0 − 1)–(x0 + s − 1, y0 − 1) · (x0 + 1, y0 + s + 1)–(x0 + s − 1, y0 + s + 1)
 * ```
 * 그리기 목록(0xbe6a0)이 아니라 **곧바로 화면에** 칠하므로 목록으로 그리는 야수 · 주자 · 공보다 아래다.
 * 공을 안 그리는 그림(`isBallDrawn` 거짓)에는 그림자도 없다(36ef8 → 3736c).
 */
export function ballShadowOf(ground: { readonly x: number; readonly y: number }, screenHeight: number): readonly BallShadowPiece[] {
  if (screenHeight < 0 || ground.y < 1) return []
  const size = screenHeight === 0 ? BALL_SHADOW_SIZE_GROUND : BALL_SHADOW_SIZE_AIR
  return ballShadowPiecesAt(ground.x, ground.y, size)
}
