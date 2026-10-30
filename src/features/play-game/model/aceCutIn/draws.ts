import {
  BAND_COLOR,
  BANNER_BORDER,
  BANNER_FILL,
  bannerPoints,
  bannerShadowsOf,
  CX,
  CY,
  labelOf,
  sweepOf,
  W,
} from '@/features/play-game/model/aceCutIn/shapes'
import type { AceCutInDraw } from '@/features/play-game/model/aceCutIn/types'

/** 0xca911 — C 의 % (0 쪽으로 자르는 나머지) */
const remainder = (value: number, divisor: number) => value - Math.trunc(value / divisor) * divisor

/** 단계 [+0x196c] 의 처음 값 — 0x16 진입 0x3d458 이 −1 로 둔다 */
const STAGE_UNSET = -1
/** 배너가 다 들어와 사선 · 초상 · 글자가 서는 첫 단계 */
const FIRST_SHOW_STAGE = 5
/** 이 단계를 본 그림이 메시지 13 을 보낸다 (0xbcb49(장면, 13)) */
const END_STAGE = 22
/** 함수 머리의 r = 0x50 — 단계 −1 그림은 이 r 로 배너를 그린다 */
const FIRST_BANNER_GAP = 0x50
/** 그림 수 상한 — 원본은 27 그림에 끝난다 */
const DRAW_LIMIT = 64

interface BannerStep {
  readonly stage: number
  readonly speed: number
  /** 배너가 가운데에서 벌어진 폭 r */
  readonly gap: number
}

/**
 * 4752a switch 단계 (표 0xd0130) — 배너 미끄러짐:
 * −1 → 단계 0 · 속도 1 (초상 적재) · r 0x50 / 0 → r = W/2 − 속도, 속도 ×4, r < 0 이면 r −4 · 단계 1 /
 * 1·2 → 단계 + 1 / 3·4 → 단계 + 1 · 속도 1 / 그 밖 그대로, r 은 0
 */
function bannerStepOf(stage: number, speed: number): BannerStep {
  if (stage === STAGE_UNSET) return { stage: 0, speed: 1, gap: FIRST_BANNER_GAP }
  if (stage === 0) {
    const gap = CX - speed
    return gap < 0 ? { stage: 1, speed: speed * 4, gap: -4 } : { stage: 0, speed: speed * 4, gap }
  }
  if (stage === 1 || stage === 2) return { stage: stage + 1, speed, gap: 0 }
  if (stage === 3 || stage === 4) return { stage: stage + 1, speed: 1, gap: 0 }
  return { stage, speed, gap: 0 }
}

/** 47706 — 단계 > 4 이면 game_ui 이미지 96 · 95 (효과 2 · 230) */
function streaksOf(stage: number): AceCutInDraw['streaks'] {
  if (stage < FIRST_SHOW_STAGE) return []
  return [
    { image: 96, x: CX + 5, y: CY - 39 },
    { image: 95, x: CX - 104, y: CY + 12 },
  ]
}

/** 47962 — (늘린 뒤의) 단계 > 4 이면 초상: 단계 ≤ 7 이면 x = W − 단계·5 + 25, 아니면 가운데 맞춤 */
function portraitOf(stage: number): AceCutInDraw['portrait'] {
  if (stage < FIRST_SHOW_STAGE) return null
  return { x: stage <= 7 ? W - stage * 5 + 25 : ('centered' as const), y: CY + 13 }
}

/** 47756 의 단계 + 1 — 5~21 은 한 칸 넘기고 22 는 그대로(이 그림이 끝을 보낸다) */
function nextShowStageOf(stage: number): number {
  return stage >= FIRST_SHOW_STAGE && stage < END_STAGE ? stage + 1 : stage
}

/** 단계 기계를 그림마다 돌린 결과 — 단계 22 를 본 그림(메시지 13)까지 */
export function aceCutInDraws(): readonly AceCutInDraw[] {
  const draws: AceCutInDraw[] = []
  let stage = STAGE_UNSET
  let speed = 0
  for (let guard = 0; guard < DRAW_LIMIT; guard += 1) {
    const startStage = stage
    const speedLines = stage === STAGE_UNSET ? null : { frame: 0x55 + remainder(stage, 5), x: CX, y: CY - 39 }
    const step = bannerStepOf(stage, speed)
    speed = step.speed
    const points = bannerPoints(step.gap)
    const streaks = streaksOf(step.stage)
    const sweep = sweepOf(step.stage)
    const ends = step.stage === END_STAGE
    stage = nextShowStageOf(step.stage)
    draws.push({
      stage: startStage,
      band: { x: 0, y: CY - 40, width: W, height: 0x52, color: BAND_COLOR },
      speedLines,
      banner: { points, fill: BANNER_FILL, border: BANNER_BORDER },
      bannerShadows: bannerShadowsOf(points),
      streaks,
      sweep,
      portrait: portraitOf(stage),
      label: stage < FIRST_SHOW_STAGE ? null : labelOf(stage),
      ends,
    })
    if (ends) break
  }
  return draws
}

/** 컷인을 다 그리는 그림 수 — 마지막 그림이 메시지 13 을 보낸다 */
export const ACE_CUT_IN_DRAWS = aceCutInDraws().length
