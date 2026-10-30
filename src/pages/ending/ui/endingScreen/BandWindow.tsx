import type { ReactNode } from 'react'
import type { ModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { BAND_BACKGROUND, BAND_WINDOW, SCREEN } from '@/pages/ending/lib/endingLayout'
import * as styles from '@/pages/ending/ui/EndingScreen.css'

/** 띠 창 (0x883b6~0x88556 · 제작진 0x88bcc~0x88d64) — 가운데 박스 검정 + 박스 **바깥** 위·아래 11px 띠 + 선 */
export function BandWindow({ band, children }: { readonly band: ModeBackSprite; readonly children?: ReactNode }) {
  const { x, y, width, height, edgeHeight } = BAND_WINDOW
  const bottom = y + height
  return (
    <>
      <svg
        className={styles.overlay}
        aria-label="띠 창"
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={SCREEN.width} height={SCREEN.height} fill={BAND_WINDOW.fill} />
        <rect data-part="box" x={x} y={y} width={width} height={height} fill={BAND_WINDOW.fill} />
        <rect data-part="top" x={x} y={y - edgeHeight} width={width} height={edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={x} y={y - edgeHeight} width={width} height={1} fill={BAND_WINDOW.outerLine} />
        <rect x={x} y={y - edgeHeight + 1} width={width} height={1} fill={BAND_WINDOW.innerLine} />
        <rect data-part="bottom" x={x} y={bottom} width={width} height={edgeHeight} fill={BAND_WINDOW.edgeColor} />
        <rect x={x} y={bottom + edgeHeight - 2} width={width} height={1} fill={BAND_WINDOW.innerLine} />
        <rect x={x} y={bottom + edgeHeight - 1} width={width} height={1} fill={BAND_WINDOW.outerLine} />
      </svg>
      {/* 띠 안 배경 0x7b9ac(this, 1, y' + 1, −14) — 프레임 = 시간대 [gfx+0x1c] */}
      <div
        className={styles.bandClip}
        style={{
          left: BAND_BACKGROUND.left,
          top: BAND_BACKGROUND.top,
          width: SCREEN.width - BAND_BACKGROUND.left,
          height: BAND_BACKGROUND.height,
        }}
      >
        <img className={styles.sprite} alt="" src={band.src} data-frame={band.slot} style={{ left: 0, top: 0 }} />
      </div>
      {children}
    </>
  )
}
