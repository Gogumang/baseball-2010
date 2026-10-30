import type { CSSProperties } from 'react'
import { toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import type { DefenseFielder } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { zoomSourceRect } from '@/features/defense-play/model/laserPresentation'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

/** 월드 (x, z) → 화면 — 카메라 오프셋만큼 민다 */
export type ScreenOf = (point: { readonly x: number; readonly z: number }) => ScreenPoint

export function screenOfOffset(offset: ScreenPoint): ScreenOf {
  return (point) => ({ x: toScreenX(point.x) + offset.x, y: toScreenY(point.z) + offset.y })
}

/** 야수 그림 자리 — 0x43278(432f0~43318)이 0xb94b4(카메라, x, z − y)로 투영한다. 결과 판 0x46844 도 이 자리를 쓴다 */
export function fielderScreenOf(screenOf: ScreenOf, fielder: DefenseFielder): ScreenPoint {
  return screenOf({ x: fielder.x, z: fielder.z - (fielder.y ?? 0) })
}

/** 결과 판 0x46844 의 자리 — 공 가진 야수(+0x1088)의 그림 자리, 없으면 화면 가운데 (46866) */
export function popupPointOf(state: DefenseViewState, screenOf: ScreenOf, holderSlot: number): ScreenPoint {
  const holder = state.fielders.find((fielder) => fielder.slot === holderSlot)
  return holder === undefined ? { x: styles.SCREEN_WIDTH >> 1, y: styles.SCREEN_HEIGHT >> 1 } : fielderScreenOf(screenOf, holder)
}

/**
 * 레이저 줌 펀치 0xbb84c → 0xbb43c — 원본 사각형(화면 W·100/s × H·100/s, 중심 = 바탕 좌표 + 카메라 오프셋, 화면 안으로 자름)을
 * 화면 전체로 늘린다. 결과 판(큰 OUT)까지 늘린다(`laserPresentation`). 줌이 없거나 100% 면 undefined
 */
export function zoomStyleOf(zoom: DefenseViewState['zoom'], offset: ScreenPoint): CSSProperties | undefined {
  if (zoom == null || zoom.percent === 100) return undefined
  const rect = zoomSourceRect(zoom, offset, { width: styles.SCREEN_WIDTH, height: styles.SCREEN_HEIGHT })
  return {
    transformOrigin: '0 0',
    transform: `scale(${styles.SCREEN_WIDTH / rect.width}, ${styles.SCREEN_HEIGHT / rect.height}) translate(${-rect.x}px, ${-rect.y}px)`,
  }
}

/** 공 그림 자리 — 바닥(z)에서 높이만큼 위에 그린다 (높이 단위도 월드 단위다 — R3 1-3) */
export function liftedPointOf(screenOf: ScreenOf, point: { readonly x: number; readonly z: number; readonly height: number }): ScreenPoint {
  const ground = screenOf(point)
  return { x: ground.x, y: ground.y - toScreenY(point.height) }
}

/** 번쩍임 자리 — 따로 정한 자리(x, z)가 있으면 그 땅점, 아니면 공 그림 자리 */
export function flashBaseOf(flash: DefenseViewState['flash'], screenOf: ScreenOf, ballPoint: ScreenPoint): ScreenPoint {
  if (flash == null || flash.x === undefined || flash.z === undefined) return ballPoint
  return screenOf({ x: flash.x, z: flash.z })
}
