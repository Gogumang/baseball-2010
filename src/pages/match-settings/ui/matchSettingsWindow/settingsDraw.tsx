import type { ReactNode } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { IMG_TEXT_PALETTE, centeredLeftOf } from '@/pages/match-settings/lib/matchSettingsLayout'
import { IMG_TEXT } from '@/pages/match-settings/lib/matchSettingsText'
import { OriginSprite } from './OriginSprite'
import { widthOf } from './settingsAssets'

/** img_text 프레임 한 장을 놓는다 — 팔레트는 흰 그림에 색 행렬을 씌운다 */
export type ImgText = (frame: number, x: number, y: number, palette?: number, key?: string) => ReactNode

/** 창 조각들이 같이 쓰는 그리기 재료 — img_text · 가운데 img_text · 두 합성 프레임 원점 · 이 그림의 깜빡임 */
export interface SettingsDraw {
  readonly text: ImgText
  /** 가운데 x 에 놓는 img_text — 원본 `cx − (w >> 1)` */
  readonly centeredText: (frame: number, centerX: number, y: number, palette?: number) => ReactNode
  readonly sltOrigins: FrameOrigins | null
  readonly popupOrigins: FrameOrigins | null
  readonly isBlinkOn: boolean
}

export function imgTextOf(textOrigins: FrameOrigins | null, filterId: string): ImgText {
  return (frame, x, y, palette = IMG_TEXT_PALETTE.흰, key) => (
    <OriginSprite
      key={key ?? `t${frame}-${x}-${y}`}
      folder={IMG_TEXT}
      frame={frame}
      origins={textOrigins}
      x={x}
      y={y}
      style={palette === IMG_TEXT_PALETTE.흰 ? undefined : { filter: `url(#${filterId}-p${palette})` }}
    />
  )
}

export function centeredImgTextOf(text: ImgText, textOrigins: FrameOrigins | null): SettingsDraw['centeredText'] {
  return (frame, centerX, y, palette = IMG_TEXT_PALETTE.흰) => text(frame, centeredLeftOf(centerX, widthOf(textOrigins, frame)), y, palette)
}
