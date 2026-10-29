import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

export interface ZoomPunchState {
  /** [0] */
  readonly active: boolean
  /** [1] — 1 이면 커지는 중 */
  readonly growing: boolean
  /** [4] */
  readonly percent: number
  /** [0x14] · [0x18] — 바탕 그림 좌표 (카메라 오프셋 전) */
  readonly centerX: number
  readonly centerY: number
}

export const NO_ZOOM_PUNCH: ZoomPunchState = { active: false, growing: false, percent: 100, centerX: 0, centerY: 0 }

/** 이 그림에 화면을 늘리는 정도 (`DefenseViewState.zoom`) */
export interface ZoomPunchFrame {
  /** 0xbb43c 의 배율 % ([0xc]) */
  readonly percent: number
  readonly centerX: number
  readonly centerY: number
}

/** 0xbb39d(100, x, z − y, 1, 0) — 바탕 그림 좌표 = x·620/40000 · (z − y)/65 (0 쪽으로 자르는 나눗셈 0xca7b5) */
export function startZoomPunch(holder: WorldPoint): ZoomPunchState {
  return {
    active: true,
    growing: true,
    percent: 100,
    centerX: Math.trunc((holder.x * 620) / 40000),
    centerY: Math.trunc((holder.z - holder.y) / 65),
  }
}

/** 0xbb84c 그림 한 번 — 이 그림의 배율과 다음 상태 */
export function stepZoomPunch(state: ZoomPunchState): { readonly next: ZoomPunchState; readonly frame: ZoomPunchFrame | null } {
  if (!state.active) return { next: state, frame: null }
  if (state.growing) {
    const raised = state.percent + 5
    const next = raised > 109 ? { ...state, percent: 110, growing: false } : { ...state, percent: raised }
    return { next, frame: { percent: 110, centerX: state.centerX, centerY: state.centerY } }
  }
  const lowered = state.percent - 5
  const next = lowered <= 100 ? { ...state, percent: 100, active: false } : { ...state, percent: lowered }
  return { next, frame: { percent: next.percent, centerX: state.centerX, centerY: state.centerY } }
}

/**
 * 0xbb43c 가 늘릴 원본 사각형 — 화면(W × H) 좌표. 이 사각형을 화면 전체로 늘린다.
 * `offset` 은 카메라 화면 오프셋([+0xfec] · [+0xff0]).
 */
export function zoomSourceRect(
  frame: ZoomPunchFrame,
  offset: { readonly x: number; readonly y: number },
  screen: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const width = Math.trunc((screen.width * 100) / frame.percent)
  const height = Math.trunc((screen.height * 100) / frame.percent)
  const clamp = (start: number, size: number, limit: number) => {
    let value = start < 0 ? 0 : start
    if (value + size >= limit) {
      value -= value + size - limit
      if (value < 0) value = 0
    }
    return value
  }
  return {
    x: clamp(frame.centerX + offset.x - (width >> 1), width, screen.width),
    y: clamp(frame.centerY + offset.y - (height >> 1), height, screen.height),
    width,
    height,
  }
}
