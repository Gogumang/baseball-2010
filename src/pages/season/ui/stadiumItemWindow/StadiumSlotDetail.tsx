import { SpriteNumber } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { moneyGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { StadiumKind } from '@/entities/season-mode/model/stadiumItems'
import { windowRowOf } from '@/pages/season/lib/seasonEquipmentWindow'
import { STADIUM_COLORS, STADIUM_WINDOW, stadiumItemDescriptionOf, stadiumPriceTenThousandsOf } from '@/pages/season/lib/stadiumItemWindow'
import { TEXT_LINE, pixel } from '@/pages/season/ui/seasonEquipmentScreen/equipmentAssets'

interface StadiumSlotDetailProps {
  readonly kind: StadiumKind
  readonly slot: number
  readonly valueRight: number
  readonly isHiddenOpen: (unlockId: number) => boolean
}

/** 칸 목록에 들어가 있을 때만 — 박스 2 줄 1 가격 0xd45c0 × 10000 만원, 노랑 (0x83c80 · 0x83d5c) · 설명 글 */
export function StadiumSlotDetail({ kind, slot, valueRight, isHiddenOpen }: StadiumSlotDetailProps) {
  const { values, description } = STADIUM_WINDOW
  const price = stadiumPriceTenThousandsOf(kind, slot)
  const descriptionText = stadiumItemDescriptionOf(kind, slot, isHiddenOpen)
  return (
    <>
      <div data-testid="구장-가격" aria-label={String(price)}>
        <SpriteNumber glyphs={moneyGlyphsOf(price)} right={valueRight} boxTop={windowRowOf(values, 1).y} boxHeight={values.height} />
      </div>
      {descriptionText !== null && (
        <div data-testid="구장-설명" aria-label={descriptionText.replaceAll('!N', '\n')}>
          {descriptionText.split('!N').map((line, index) => (
            <PixelText
              key={index}
              style={{
                ...pixel,
                left: description.x + STADIUM_WINDOW.descriptionInset,
                top: description.y + STADIUM_WINDOW.descriptionInset + index * TEXT_LINE,
                color: STADIUM_COLORS.cursor,
              }}
            >
              {line}
            </PixelText>
          ))}
        </div>
      )}
    </>
  )
}
