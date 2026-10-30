import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import * as styles from '@/pages/ending/ui/EndingScreen.css'

/** 프레임 한 장 — 팔레트를 갈아 끼우고, 뒤집기 깃발이면 원점을 거울로 놓는다 */
export function FramePiece({
  folder,
  frame,
  origins,
  x,
  y,
  palette = null,
  isFlipped = false,
}: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
  readonly palette?: number | null
  readonly isFlipped?: boolean
}) {
  const key = String(frame).padStart(3, '0')
  const url = useRecoloredSprite(`${folder}/${key}.png`, palette)
  const origin = origins?.[key]
  if (origin === undefined) return null
  const style: CSSProperties = isFlipped
    ? { left: x - origin.x - origin.width, top: y + origin.y, transform: 'scaleX(-1)' }
    : { left: x + origin.x, top: y + origin.y }
  return <img className={styles.sprite} style={style} src={url} alt="" data-frame={frame} />
}
