import { PressArea } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { LINE_HEIGHT, measurePixelTextWidth } from '@/shared/lib/font/layout'
import { isBlinkOn, windowRowOf } from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowBox } from '@/pages/season/lib/seasonEquipmentWindow'
import { STADIUM_COLORS, STADIUM_WINDOW, stadiumRowLookOf, stadiumRowNameOf, stadiumSlotCountOf } from '@/pages/season/lib/stadiumItemWindow'
import { MODE_UI, imageOf, pixel } from '@/pages/season/ui/seasonEquipmentScreen/equipmentAssets'
import type { StadiumItemWindowProps } from '@/pages/season/ui/StadiumItemWindow'

/** 0xba411(박스, 글, 정렬 0x22) → 0xba2e4 — 가로 (w − 글폭) asr 1 · 세로 d > 0 이면 ceil(d/2) (d = h − 11) */
function CenteredText({ text, box, color }: { readonly text: string; readonly box: WindowBox; readonly color: string }) {
  const d = box.height - LINE_HEIGHT
  const dy = d > 0 ? (d >> 1) + (d % 2) : d >> 1
  return <PixelText style={{ ...pixel, left: box.x + ((box.width - measurePixelTextWidth(text)) >> 1), top: box.y + dy, color }}>{text}</PixelText>
}

/** 칸 목록에서 보이는 줄 — 맨 윗줄부터 다섯 줄, 칸 수에서 자른다 */
const visibleSlotsOf = (top: number, count: number) =>
  Array.from({ length: STADIUM_WINDOW.visibleRows }, (_unused, row) => top + row).filter((index) => index < count)

/** 칸 목록 — 산 칸 막대 · 이름(가운데) · 깜빡이는 노랑 테두리 · 누름 칸 */
export function StadiumSlotRows({ record, kind, slot, top, isSlotFocus, tick, isShop, isHiddenOpen, onPickSlot }: StadiumItemWindowProps) {
  return visibleSlotsOf(top, stadiumSlotCountOf(kind)).map((index, row) => {
    const box = windowRowOf(STADIUM_WINDOW.items, row)
    const look = stadiumRowLookOf(record, kind, index, isShop)
    const name = stadiumRowNameOf(kind, index, isHiddenOpen)
    const isCursor = isSlotFocus && index === slot
    return (
      <div key={index} data-testid={`구장-칸-${index}`}>
        {look.bar !== null && <img alt="" src={imageOf(MODE_UI, look.bar)} style={{ ...pixel, left: box.x, top: box.y }} />}
        <CenteredText text={name} box={box} color={look.color} />
        {/* 노랑 테두리 0xb9ed5 (0x83c4e) — 0x6a978 이 (w + 1) × (h + 1) 칸을 덮는다 (U-113) */}
        {isCursor && isBlinkOn(tick) && (
          <div
            data-testid="구장-커서"
            style={{
              ...pixel,
              left: box.x,
              top: box.y,
              width: box.width + 1,
              height: box.height + 1,
              boxSizing: 'border-box',
              border: `1px solid ${STADIUM_COLORS.cursor}`,
            }}
          />
        )}
        <PressArea label={`${kind} ${name}`} rect={box} option={{ isSelected: isCursor }} onPress={() => onPickSlot(index)} />
      </div>
    )
  })
}
