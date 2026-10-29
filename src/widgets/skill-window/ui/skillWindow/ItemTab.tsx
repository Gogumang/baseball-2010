import { MarkupText } from '@/shared/ui'
import { DESCRIPTION_BOX, ITEM_CELL_BOXES, ITEM_COLUMNS, ITEM_TEXT_INSET, NAME_BOX, gridIndexOf } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { LayoutBox } from '@/widgets/skill-window/lib/skillWindowLayout'
import { subItemDescriptionOf, subItemNameOf, type SkillWindowSide } from '@/widgets/skill-window/lib/skillWindowText'
import type { SkillWindowCareer } from '@/widgets/skill-window/model/skillWindowCareer'
import type { SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'
import { cellLabelOf, ITEM_ICON, pad } from '@/widgets/skill-window/ui/skillWindow/glyphs'
import * as styles from '@/widgets/skill-window/ui/SkillWindow.css'

interface ItemTabProps {
  readonly state: SkillWindowState
  readonly career: SkillWindowCareer
  readonly side: SkillWindowSide
}

/** 서브아이템 탭 — 가진 칸의 아이콘 · 누름 자리 · 커서 칸(가진 것)의 이름과 설명 */
export function ItemTab({ state, career, side }: ItemTabProps) {
  const itemCursorIndex = gridIndexOf(state.itemCursor, ITEM_COLUMNS)
  const cursorItemOwned = state.focus === '격자' && career.subItemIds.includes(itemCursorIndex)
  return (
    <>
      {ITEM_CELL_BOXES.map((area, index) => {
        const isOwned = career.subItemIds.includes(index)
        return [
          // 아이콘 = [win+0x1a0] 그림 표 0xd463a[i] = i (item_icon), 0xb9d35 가운데 — 가진 칸만 (0x82514)
          isOwned && <ItemIcon key={`i${index}`} index={index} area={area} />,
          <button
            key={`b${index}`}
            type="button"
            className={styles.hitArea}
            aria-label={isOwned ? subItemNameOf(index) : `빈 칸 ${index + 1}`}
            style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
            onClick={(event) => {
              event.stopPropagation()
              state.setFocus('격자')
              state.setItemCursor({ column: index % ITEM_COLUMNS, row: Math.trunc(index / ITEM_COLUMNS) })
            }}
          />,
        ]
      })}
      {cursorItemOwned && (
        <>
          {cellLabelOf('item', subItemNameOf(itemCursorIndex) ?? '', NAME_BOX)}
          <div
            className={styles.description}
            data-testid="skill-description"
            style={{
              left: DESCRIPTION_BOX.x + ITEM_TEXT_INSET,
              top: DESCRIPTION_BOX.y + ITEM_TEXT_INSET,
              width: DESCRIPTION_BOX.width - ITEM_TEXT_INSET * 2,
              height: DESCRIPTION_BOX.height - ITEM_TEXT_INSET * 2,
            }}
          >
            <MarkupText raw={subItemDescriptionOf(side, itemCursorIndex)} />
          </div>
        </>
      )}
    </>
  )
}

/** item_icon 그림 0~9 의 크기 (PNG 를 읽어 적었다) — 0xb9d35 가 가운데 맞춤에 쓴다 */
const ITEM_ICON_SIZES: readonly (readonly [number, number])[] = [
  [24, 26],
  [26, 23],
  [23, 24],
  [25, 24],
  [29, 22],
  [29, 26],
  [27, 18],
  [24, 22],
  [27, 25],
  [29, 23],
]

/** 서브아이템 아이콘 — 0xb9d35(그림) 가운데: 가로 올림, 세로 내림 (0xb9c5c) */
function ItemIcon({ index, area }: { readonly index: number; readonly area: LayoutBox }) {
  const [width, height] = ITEM_ICON_SIZES[index]
  return (
    <img
      className={styles.layer}
      src={`${ITEM_ICON}/${pad(index)}.png`}
      alt=""
      style={{ left: area.x + Math.ceil((area.width - width) / 2), top: area.y + Math.trunc((area.height - height) / 2) }}
    />
  )
}
