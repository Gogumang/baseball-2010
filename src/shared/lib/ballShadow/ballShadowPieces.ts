/** 공 그림자 한 조각 — 화면 좌표 사각(선은 폭 · 높이 1) */
export interface BallShadowPiece {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: { readonly r: number; readonly g: number; readonly b: number }
}

/** 그림자 테두리 회색 0x1400748(100, 100, 100) (35738) */
export const BALL_SHADOW_RIM_COLOR = { r: 100, g: 100, b: 100 } as const
/** 그림자 속 — 0x1400698(그리기 속성, 1, 0) 색 0 (35718) */
export const BALL_SHADOW_FILL_COLOR = { r: 0, g: 0, b: 0 } as const

/**
 * **공 그림자 0x356f8(x, y, s)** — 수비 화면(0x36dfc 37268)과 타석 공 그리기(0x3b2f4 3b422)가 함께 부른다 (직접 뜸).
 * ```
 * 356f8  x0 = x − (s >> 1) · y0 = y − (s >> 1) ; 색 0(검정) ; 기기 사각 칠 0x14006e8(x0, y0, s + 1, s + 1)
 * 35734  s > 2 면 색 (100, 100, 100) ; 기기 선 0x14006c8 넷(두 끝 다 칠한다):
 *          (x0 − 1, y0 + 1)–(x0 − 1, y0 + s − 1) · (x0 + s + 1, y0 + 1)–(x0 + s + 1, y0 + s − 1)
 *          (x0 + 1, y0 − 1)–(x0 + s − 1, y0 − 1) · (x0 + 1, y0 + s + 1)–(x0 + s − 1, y0 + s + 1)
 * ```
 * ⚠️ 근사(남김 — 단말 몫 · 바이너리 밖): 사각 칠 0x14006e8 · 선 0x14006c8 의 본문은 바이너리에 없다 — 사각은 (s + 1)² 칸,
 * 가로 · 세로선은 두 끝을 다 칠한다고 본다(`commonPanel` 머리말과 같은 가정).
 */
export function ballShadowPiecesAt(x: number, y: number, size: number): readonly BallShadowPiece[] {
  const x0 = x - (size >> 1)
  const y0 = y - (size >> 1)
  const pieces: BallShadowPiece[] = [{ x: x0, y: y0, width: size + 1, height: size + 1, color: BALL_SHADOW_FILL_COLOR }]
  if (size > 2) {
    const rim = BALL_SHADOW_RIM_COLOR
    pieces.push(
      { x: x0 - 1, y: y0 + 1, width: 1, height: size - 1, color: rim },
      { x: x0 + size + 1, y: y0 + 1, width: 1, height: size - 1, color: rim },
      { x: x0 + 1, y: y0 - 1, width: size - 1, height: 1, color: rim },
      { x: x0 + 1, y: y0 + size + 1, width: size - 1, height: 1, color: rim },
    )
  }
  return pieces
}
