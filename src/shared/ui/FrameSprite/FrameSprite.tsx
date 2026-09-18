import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/shared/ui/FrameSprite/FrameSprite.css'

interface FrameSpriteProps {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  /** 프레임 원점이 놓일 화면 좌표 */
  readonly x: number
  readonly y: number
}

/** PZX 합성 프레임 한 장을 원점에 맞춰 놓는다. 원점을 아직 못 읽었으면 그리지 않는다. */
export function FrameSprite({ folder, frame, origins, x, y }: FrameSpriteProps) {
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    <img
      className={styles.sprite}
      style={{ left: x + origin.x, top: y + origin.y }}
      src={`${folder}/${key}.png`}
      alt=""
    />
  )
}
