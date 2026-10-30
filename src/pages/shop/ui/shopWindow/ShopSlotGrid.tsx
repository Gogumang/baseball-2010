import { PressArea } from '@/shared/ui'
import { SHOP_COLORS, SLOT_COUNT, SLOT_SIZE, slotCellRectsOf, slotPositionOf } from '@/pages/shop/lib/shopLayout'
import type { ItemGridWindowKind } from '@/pages/shop/lib/shopLayout'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import { ITEM_ICON, spriteSrc } from '@/pages/shop/ui/shopWindow/spriteFolders'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

/** 격자 10칸 — 칸 바탕 · 커서 · 아이콘 · 누름 칸 (0x82420) */
export function ShopSlotGrid({
  kind,
  entries,
  cursor,
  isCursorVisible,
  isKeyEnabled,
  onMoveCursor,
  onSelect,
}: {
  readonly kind: ItemGridWindowKind
  readonly entries: readonly (ShopEntry | null)[]
  readonly cursor: number
  readonly isCursorVisible: boolean
  readonly isKeyEnabled: boolean
  readonly onMoveCursor: (index: number) => void
  readonly onSelect: (index: number) => void
}) {
  return (
    <>
      {/* 칸 바탕 0x7e764 — 10칸 모두 (0x82420, 깃발 0) */}
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges" data-testid="shop-slot-cells">
        {Array.from({ length: SLOT_COUNT }, (_unused, slot) =>
          slotCellRectsOf(slotPositionOf(slot)).map((rect, part) => (
            <rect key={`${slot}-${part}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
          )),
        )}
      </svg>

      {/* 격자 커서 — 칸을 1px 둘러싼다 */}
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {isCursorVisible && cursor >= 0 && cursor < SLOT_COUNT && (
          <rect
            x={slotPositionOf(cursor).x - 0.5}
            y={slotPositionOf(cursor).y - 0.5}
            width={SLOT_SIZE + 1}
            height={SLOT_SIZE + 1}
            fill="none"
            stroke={SHOP_COLORS.text}
            strokeWidth={1}
          />
        )}
      </svg>

      {/* 아이콘 — 33×33 칸 가운데 (그림만, 눌림은 아래 투명 누름 칸 몫) */}
      {Array.from({ length: SLOT_COUNT }, (_unused, index) => {
        const entry = entries[index] ?? null
        if (entry === null || entry.iconFrame === null) return null
        const { x, y } = slotPositionOf(index)
        return (
          <div key={entry.id} className={styles.slotIcon} style={{ left: x, top: y, width: SLOT_SIZE, height: SLOT_SIZE }}>
            <img className={kind === '서브' && entry.isOwned ? styles.ownedIcon : undefined} alt="" src={spriteSrc(ITEM_ICON, entry.iconFrame)} />
          </div>
        )
      })}

      {/* 칸 누름 — 격자 칸 k 자리 = mode_ui 34 박스 k(0x82408 0x94a65(…, 0, k) → 0x82420 칸 바탕 0x7e764 에 그대로 넘긴다).
          목록은 창 0x81618 이 vt+0x1c(5, 2, 1, 0x30) 으로 지은 [창+0x19c] 다. 다른 칸을 누르면 그 칸 고르기,
          고른 칸을 누르면 OK(확인)와 같다 — 투수 등록 · 변화구 칸과 같은 방식. ⚠️ 원본은 터치가 없어 웹 전용 입력이다 */}
      {Array.from({ length: SLOT_COUNT }, (_unused, index) => {
        const entry = entries[index] ?? null
        const { x, y } = slotPositionOf(index)
        return (
          <PressArea
            key={`누름:${index}`}
            label={entry?.name ?? `빈 칸 ${index}`}
            rect={{ x, y, width: SLOT_SIZE, height: SLOT_SIZE }}
            option={{ isSelected: cursor === index }}
            isDisabled={!isKeyEnabled}
            onPress={() => (cursor === index ? onSelect(index) : onMoveCursor(index))}
          />
        )
      })}
    </>
  )
}
