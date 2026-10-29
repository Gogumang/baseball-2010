import { SPECIAL_ITEMS, SPECIAL_REEL_STATE } from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  MENU_DESCRIPTION_PANEL,
  MENU_PANEL_HEADING_COLOR,
  menuPanelHeadingFrameOf,
  menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf,
} from '@/pages/special/ui/specialScreen/otherSlices'
import { IMG_TEXT_FRAMES, MAIN_UI, MAIN_UI_FRAMES, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'
import { TintedLabel } from '@/pages/special/ui/specialScreen/TintedLabel'

type SpecialItem = (typeof SPECIAL_ITEMS)[number]

/** 판 왼쪽 위 회색 제목 img_text 1 "스페셜" (0x257cc~0x257ee) — 크기를 모르면 안 그린다 */
function PanelHeading({ textOrigins, dx, dy }: { readonly textOrigins: FrameOrigins | null; readonly dx: number; readonly dy: number }) {
  const headingFrame = menuPanelHeadingFrameOf(SPECIAL_REEL_STATE)
  const headingSize = headingFrame === null ? null : (textOrigins?.[String(headingFrame).padStart(3, '0')] ?? null)
  if (headingFrame === null || headingSize === null) return null
  return (
    <TintedLabel
      src={imageSrc(IMG_TEXT_FRAMES, headingFrame)}
      left={menuPanelHeadingTopLeftOf().x + dx}
      top={menuPanelHeadingTopLeftOf().y + dy}
      width={headingSize.width}
      height={headingSize.height}
      color={MENU_PANEL_HEADING_COLOR}
    />
  )
}

interface SpecialDescriptionPanelProps {
  readonly selected: SpecialItem
  readonly textOrigins: FrameOrigins | null
  /** 설명 판 까딱임 — 표 0xce8bc · 0xce88c */
  readonly shake: { readonly dx: number; readonly dy: number }
}

/** 설명 판 = main_ui 이미지 3 (149×63) 을 (96, 289) — 아래 절반은 화면 밖(원본 그대로). 판 안 큰 글자 = main_ui 프레임(0x25774) */
export function SpecialDescriptionPanel({ selected, textOrigins, shake }: SpecialDescriptionPanelProps) {
  const { dx: shakeDx, dy: shakeDy } = shake
  const panel = { x: MENU_DESCRIPTION_PANEL.x + shakeDx, y: MENU_DESCRIPTION_PANEL.y + shakeDy }
  /** 판 안 큰 글자 자리 — 프레임 크기는 PNG 머리에서 읽어 둔 `labelWidth` · `labelHeight` (0x25794~0x257c4 가운데 + (2, 5)) */
  const panelLabelAt = menuPanelLabelTopLeftOf(selected.labelWidth, selected.labelHeight)
  const isAvailable = selected.availability === '됨'
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        data-testid="스페셜-설명판"
        src={imageSrc(MAIN_UI, MENU_DESCRIPTION_PANEL.frame)}
        style={{ left: panel.x, top: panel.y }}
      />
      <EffectImage
        className={`${styles.sprite} ${isAvailable ? '' : styles.dimmed}`}
        effect={isAvailable ? null : DRAW_EFFECT.GRAY}
        src={imageSrc(MAIN_UI_FRAMES, selected.labelFrame)}
        style={{ left: panelLabelAt.x + shakeDx, top: panelLabelAt.y + shakeDy }}
      />
      <PanelHeading textOrigins={textOrigins} dx={shakeDx} dy={shakeDy} />
    </>
  )
}
