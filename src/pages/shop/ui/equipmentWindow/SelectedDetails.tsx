import { SpriteNumber } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import {
  ABILITY_LABEL_BASE,
  ABILITY_LABEL_PALETTE,
  DESCRIPTION_INSET,
  EQUIPMENT_BOXES,
  EQUIPMENT_COLORS,
  VALUE_RIGHT_INSET,
  effectOffsetsOf,
  rowBoxOf,
} from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentEdition } from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import { AlignedFrame, PlusSign } from '@/pages/shop/ui/equipmentWindow/equipmentPictures'
import { IMG_TEXT } from '@/pages/shop/ui/equipmentWindow/spriteFolders'
import * as styles from '@/pages/shop/ui/EquipmentWindow.css'

/** 고른 줄의 노랑 테두리 · 가격 · 효과 · 설명 (0x83c02~0x84334) */
export function SelectedDetails({
  row,
  edition,
  part,
  cursorBox,
  isBlinkOn,
  textOrigins,
  paletteFilterId,
}: {
  readonly row: EquipmentRow
  readonly edition: EquipmentEdition
  readonly part: number
  readonly cursorBox: ShopBox
  readonly isBlinkOn: boolean
  readonly textOrigins: FrameOrigins | null
  readonly paletteFilterId: string
}) {
  const { value: valueBox, description: descriptionBox } = EQUIPMENT_BOXES
  const priceBox = rowBoxOf(valueBox, 1)
  const effectBox = rowBoxOf(valueBox, 2)
  const offsets = effectOffsetsOf(row.bonus)
  const lines = parseGameMarkup(row.description)
  return (
    <>
      {/* 0xb9ed5 노랑 사각 테두리 — 0x6a978 이 폭·높이에 1 을 더해 플랫폼 0x14006d8 에 넘겨 (w + 1) × (h + 1) 칸을 덮는다(U-113 확정 — 플랫폼은 받은 폭 · 높이를 칸 수로 본다) */}
      {isBlinkOn && (
        <svg className={styles.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges" data-testid="장비-줄테두리">
          <rect
            x={cursorBox.x + 0.5}
            y={cursorBox.y + 0.5}
            width={cursorBox.width}
            height={cursorBox.height}
            fill="none"
            stroke={EQUIPMENT_COLORS.cursor}
            strokeWidth={1}
          />
        </svg>
      )}

      {/* 가격 — 박스 2 줄 1 */}
      <SpriteNumber
        glyphs={moneyGlyphsOf(row.price)}
        right={priceBox.x + priceBox.width - VALUE_RIGHT_INSET}
        boxTop={priceBox.y}
        boxHeight={priceBox.height}
      />

      {/* 효과 — 능력치 이름(팔레트 1) · "+" · 보너스 (박스 2 줄 2) */}
      <span data-testid="장비-효과" data-bonus={row.bonus}>
        <AlignedFrame
          folder={IMG_TEXT}
          frame={ABILITY_LABEL_BASE[edition] + part}
          origins={textOrigins}
          target={effectBox}
          align={0x24}
          ox={offsets.labelOx}
          style={{ filter: `url(#${paletteFilterId})` }}
          paletteIndex={ABILITY_LABEL_PALETTE}
        />
        <PlusSign target={effectBox} ox={offsets.plusOx} />
        <SpriteNumber
          glyphs={numberGlyphsOf(row.bonus)}
          right={effectBox.x + effectBox.width - VALUE_RIGHT_INSET}
          boxTop={effectBox.y}
          boxHeight={effectBox.height}
        />
      </span>

      {/* 설명 — 박스 4, 정렬 0x11, (5, 5) */}
      <div
        className={styles.description}
        data-testid="장비-설명"
        style={{ left: descriptionBox.x + DESCRIPTION_INSET, top: descriptionBox.y + DESCRIPTION_INSET }}
      >
        {lines.map((line, lineIndex) => (
          <p key={lineIndex} className={styles.descriptionLine} style={line.isCentered ? { textAlign: 'center' } : undefined}>
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
                {segment.text}
              </span>
            ))}
          </p>
        ))}
      </div>
    </>
  )
}
