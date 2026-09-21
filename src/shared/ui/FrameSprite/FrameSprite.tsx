import type { CSSProperties } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/shared/ui/FrameSprite/FrameSprite.css'

interface FrameSpriteProps {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  /** 프레임 원점이 놓일 화면 좌표 */
  readonly x: number
  readonly y: number
  /** 자리(left·top) 위에 덧바를 것 */
  readonly style?: CSSProperties
  /**
   * `x` 를 **가운데**로 삼는다 — 왼쪽 끝이 아니라 `x − 폭/2` 에 놓는다.
   * A·B 딱지 글자가 이렇다: 원본이 `(A.x − w/2, A.y−48)` 로 그린다 (P6 2a-3 끝부분 0x65744).
   */
  readonly centerX?: boolean
}

/** PZX 합성 프레임 한 장을 원점에 맞춰 놓는다. 원점을 아직 못 읽었으면 그리지 않는다. */
export function FrameSprite({ folder, frame, origins, x, y, style, centerX = false }: FrameSpriteProps) {
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  const left = x + origin.x - (centerX ? origin.width / 2 : 0)
  return (
    <img
      className={styles.sprite}
      style={{ left, top: y + origin.y, ...style }}
      src={`${folder}/${key}.png`}
      alt=""
    />
  )
}
