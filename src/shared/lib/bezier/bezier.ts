/** 원본 곡선의 t 눈금 — 0 ~ 10000 */
const T_SCALE = 10_000

/**
 * 번스타인 가중치 (binary.mod 0xbcb84, 정수 나눗셈은 0쪽으로 자름).
 * 차수 0 이면 원본 그대로 [1] 이다 — 10000 이 아닌 것은 원본 버그다.
 */
export function bernsteinWeights(degree: number, t: number): number[] {
  const weights = new Array<number>(degree + 1).fill(0)
  if (degree === 0) {
    weights[0] = 1
    return weights
  }
  weights[0] = T_SCALE - t
  weights[1] = t
  for (let order = 2; order <= degree; order += 1) {
    weights[order] = Math.trunc((weights[order - 1] * t) / T_SCALE)
    for (let index = order - 1; index >= 1; index -= 1) {
      weights[index] =
        Math.trunc((weights[index - 1] * t) / T_SCALE) + Math.trunc((weights[index] * (T_SCALE - t)) / T_SCALE)
    }
    weights[0] = Math.trunc((weights[0] * (T_SCALE - t)) / T_SCALE)
  }
  return weights
}

export interface CurvePoint {
  readonly x: number
  readonly y: number
}

/** 곡선 위 pointIndex 번째 점 (0xbcc6c) — t = trunc(i×10000/(N−1)), 좌표마다 Σ trunc(가중치×제어점/10000) */
export function bezierPointAt(controlPoints: readonly CurvePoint[], pointIndex: number, pointCount: number): CurvePoint {
  const t = pointCount <= 1 ? T_SCALE : Math.trunc((pointIndex * T_SCALE) / (pointCount - 1))
  const weights = bernsteinWeights(controlPoints.length - 1, t)
  let x = 0
  let y = 0
  controlPoints.forEach((point, index) => {
    x += Math.trunc((weights[index] * point.x) / T_SCALE)
    y += Math.trunc((weights[index] * point.y) / T_SCALE)
  })
  return { x, y }
}

export interface CurvePoint3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** 3차원 제어점도 좌표마다 같은 식이다 (0xbcee0 이 곡선 한 점마다 0xbcc6c 를 부른다) */
export function bezierPoint3At(controlPoints: readonly CurvePoint3[], pointIndex: number, pointCount: number): CurvePoint3 {
  const t = pointCount <= 1 ? T_SCALE : Math.trunc((pointIndex * T_SCALE) / (pointCount - 1))
  const weights = bernsteinWeights(controlPoints.length - 1, t)
  let x = 0
  let y = 0
  let z = 0
  controlPoints.forEach((point, index) => {
    x += Math.trunc((weights[index] * point.x) / T_SCALE)
    y += Math.trunc((weights[index] * point.y) / T_SCALE)
    z += Math.trunc((weights[index] * point.z) / T_SCALE)
  })
  return { x, y, z }
}
