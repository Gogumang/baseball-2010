/**
 * **타석 공 꼬리선 0x3b188** — 타석 공 그리기 0x3b2f4 가 그림자(3b388~3b422) 다음 · 공 그림(3b6de) 앞에 곧바로 긋는다
 * (r274 직접 떴다):
 * ```
 * 3b434  공 틱 [+0x1098] ≤ 점 수 [+0x109c] 일 때만:
 * 3b440    상태 0x13 이면 0x35988(강한 타구) 이나 0x357e0(결과 코드 24~26) 일 때만 0x3b188(장면, 3, 0x8f, 0)
 * 3b466    그 밖(0x11 · 0x12)은 늘 0x3b188(장면, 5, 0xdf, 0)
 * 0x3b188(장면, n, s, 종류):
 * 3b19c  공 틱 == 0 이거나 n ≤ 0 이면 끝
 * 3b1b6  i = 1 … n: k = max(공 틱, 0) − n + i ; k ≤ 0 이면 건너뜀 ; k ≥ N 이면 k = N − 1
 * 3b1de    A = 0x35854(k − 1) · B = 0x35854(k)               ; 공 그리기와 같은 화면 자리(투영 0xbe3d8)
 * 3b270    종류 0: a = s · i / n ; 색 = a · 0x01010101(윗바이트가 알파)
 * 3b28c    j = 0 … i − 1: 0x6a905(B.x + j − i/2, B.y, A.x + j − i/2, A.y, 색)   ; 굵기 i 의 선
 * ```
 * 곧 공 뒤로 n 마디 — 오래된 마디일수록 가늘고(굵기 i) 흐리다(회색 a, 알파 a/255). 종류 1 갈래(3b204, 공 그림을 반투명으로
 * 늘어놓기)는 부르는 곳이 없다. 0x6a905 는 알파가 0 · 0xff 가 아니면 플랫폼 그리기 속성 [0x1400698](gc, 4, 알파)로 섞는다 — 섞기 식은
 * 단말 몫이라(CORRECTIONS P6 7-1) 웹은 알파 a/255 로 칠한다.
 */
export interface BallTrailSpec {
  /** 마디 수 n */
  readonly count: number
  /** 마디 i 의 밝기 · 알파 = s · i / n */
  readonly step: number
}

/** 0x11 · 0x12 (3b466 `movs r1, #5 ; movs r2, #0xdf`) */
export const PITCH_BALL_TRAIL: BallTrailSpec = { count: 5, step: 0xdf }
/** 0x13 (3b45e `movs r1, #3 ; movs r2, #0x8f`) */
export const HIT_BALL_TRAIL: BallTrailSpec = { count: 3, step: 0x8f }

export interface BallTrailLine {
  readonly from: { readonly x: number; readonly y: number }
  readonly to: { readonly x: number; readonly y: number }
  /** 회색 밝기 = 알파 (0~255) */
  readonly shade: number
}

/**
 * 꼬리선 마디들 — `pixelAt(k)` 는 0x35854(경로 점 k 의 화면 자리), `pointCount` 는 N(+0x109c).
 * 3b434 의 `공 틱 ≤ N` 은 부르는 쪽이 본다(`trailsAt`).
 */
export function ballTrailLinesOf(
  spec: BallTrailSpec,
  ballTick: number,
  pointCount: number,
  pixelAt: (index: number) => { readonly x: number; readonly y: number },
): BallTrailLine[] {
  if (ballTick === 0 || spec.count <= 0) return []
  const lines: BallTrailLine[] = []
  for (let i = 1; i <= spec.count; i += 1) {
    let index = Math.max(ballTick, 0) - spec.count + i
    if (index <= 0) continue
    if (index >= pointCount) index = pointCount - 1
    const before = pixelAt(index - 1)
    const now = pixelAt(index)
    const shade = Math.trunc((spec.step * i) / spec.count)
    const half = i >> 1
    for (let j = 0; j < i; j += 1) {
      lines.push({
        from: { x: now.x + j - half, y: now.y },
        to: { x: before.x + j - half, y: before.y },
        shade,
      })
    }
  }
  return lines
}

/** 3b434 — 공 틱이 점 수를 넘지 않았나 */
export function trailsAt(ballTick: number, pointCount: number): boolean {
  return ballTick <= pointCount
}
