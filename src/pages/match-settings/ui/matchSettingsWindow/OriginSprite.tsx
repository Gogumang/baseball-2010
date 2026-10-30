import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { pngOf } from '@/pages/match-settings/ui/matchSettingsWindow/settingsAssets'

/** 합성 프레임 한 장 — 원점(origins)만큼 옮겨 놓는다. 원점을 아직 못 읽었으면 그리지 않는다 */
export function OriginSprite({
  folder,
  frame,
  origins,
  x,
  y,
  style,
}: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
  readonly style?: CSSProperties
}) {
  const origin = origins?.[String(frame).padStart(3, '0')]
  if (origin === undefined) return null
  return (
    <img className={styles.layer} alt="" data-frame={frame} src={pngOf(folder, frame)} style={{ left: x + origin.x, top: y + origin.y, ...style }} />
  )
}
