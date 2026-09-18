import { useEffect, useState } from 'react'
import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import {
  CURSOR_BLINK_PERIOD, CURSOR_VISIBLE_UPDATES, DESCRIPTION_BOX, ITEM_WINDOW, MONEY_BOX, MONEY_LABEL_FRAME,
  NAME_BOX, PRICE_BOX, SLOT_SIZE, TAB_LABEL_FRAMES, TITLE_BOX, itemIconFrameOf, slotPositionOf,
} from '@/widgets/item-window/lib/itemWindowLayout'
import type { ItemBox } from '@/widgets/item-window/lib/itemWindowLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/item-window/ui/ItemWindow.css'

const IMG_TEXT = '/sprites/img_text/frames'
const ITEM_ICON = '/sprites/item_icon'
const LABEL_HEIGHT = 10

export interface ItemWindowEntry {
  readonly name: string
  readonly description: string
  /** 서브는 만원, GP 는 G포인트 */
  readonly price: number
  /** 이미 산 아이템 — 아이콘을 어둡게 한다 */
  readonly isOwned: boolean
}

interface ItemWindowProps {
  readonly tab: '서브' | 'GP'
  readonly entries: readonly ItemWindowEntry[]
  /** 소지금 (만원) */
  readonly money: number
  readonly onSelect: (index: number) => void
}

/** 아이템 창 (0x81dc0) — 아이콘 2줄×5칸, 고른 칸의 이름·설명·가격을 아래에 보여 준다 */
export function ItemWindow({ tab, entries, money, onSelect }: ItemWindowProps) {
  const [cursor, setCursor] = useState(0)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES
  const widthOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const selected = entries[cursor]
  const moneyGlyphs = moneyGlyphsOf(money)
  const centeredLabel = (frame: number, box: ItemBox) => ({
    left: box.x + Math.trunc((box.width - widthOf(frame)) / 2),
    top: box.y + Math.trunc((box.height - LABEL_HEIGHT + 1) / 2),
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      const row = event.key === 'ArrowDown' ? 5 : event.key === 'ArrowUp' ? -5 : 0
      if (step !== 0 || row !== 0) {
        setCursor((current) => (current + step + row + entries.length) % entries.length)
        return
      }
      if (event.key === 'Enter') onSelect(cursor)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <div className={styles.window}
        style={{ left: ITEM_WINDOW.x, top: ITEM_WINDOW.y, width: ITEM_WINDOW.width, height: ITEM_WINDOW.height }} />

      <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <rect x={TITLE_BOX.x} y={TITLE_BOX.y} width={TITLE_BOX.width} height={TITLE_BOX.height} fill={ORIGINAL_COLORS.tabSelected} />
        <rect x={MONEY_BOX.x} y={MONEY_BOX.y} width={MONEY_BOX.width} height={MONEY_BOX.height} fill={ORIGINAL_COLORS.boardFill} />
        {isCursorVisible && (
          <rect x={slotPositionOf(cursor).x - 0.5} y={slotPositionOf(cursor).y - 0.5} width={SLOT_SIZE + 1} height={SLOT_SIZE + 1}
            fill="none" stroke={ORIGINAL_COLORS.text} strokeWidth={1} />
        )}
      </svg>

      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${TAB_LABEL_FRAMES[tab]}.png`}
        style={centeredLabel(TAB_LABEL_FRAMES[tab], TITLE_BOX)} />
      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${MONEY_LABEL_FRAME}.png`}
        style={{ left: MONEY_BOX.x + 4, top: MONEY_BOX.y + Math.trunc((MONEY_BOX.height - LABEL_HEIGHT + 1) / 2) }} />
      <SpriteNumber glyphs={moneyGlyphs} right={MONEY_BOX.x + MONEY_BOX.width - 4}
        boxTop={MONEY_BOX.y} boxHeight={MONEY_BOX.height} />

      {entries.map((entry, index) => {
        const { x, y } = slotPositionOf(index)
        // 아이콘(24×26)은 33×33 칸 가운데에 놓는다
        return (
          <button key={entry.name} type="button" aria-label={entry.name} className={local.slotButton}
            style={{ left: x, top: y, width: SLOT_SIZE, height: SLOT_SIZE }}
            onMouseEnter={() => setCursor(index)} onClick={() => (cursor === index ? onSelect(index) : setCursor(index))}>
            <img className={entry.isOwned ? local.ownedIcon : undefined} alt=""
              src={`${ITEM_ICON}/${String(itemIconFrameOf(tab, index)).padStart(3, '0')}.png`} />
          </button>
        )
      })}

      <div className={local.nameBox} style={{ left: NAME_BOX.x, top: NAME_BOX.y, width: NAME_BOX.width, height: NAME_BOX.height }} />
      <div className={local.nameDot} style={{ left: NAME_BOX.x + 2, top: NAME_BOX.y + 2 }} />
      <div className={local.text} style={{ left: NAME_BOX.x + 5, top: NAME_BOX.y + 1, width: NAME_BOX.width - 8 }}>{selected?.name ?? ''}</div>
      {/* 가격도 num 글자다 — 돈은 억 표기(0x63330), GP 는 그냥 숫자(0xba718) */}
      {selected !== undefined && (
        <SpriteNumber glyphs={tab === '서브' ? moneyGlyphsOf(selected.price) : numberGlyphsOf(selected.price)}
          right={PRICE_BOX.x + PRICE_BOX.width - 4} boxTop={PRICE_BOX.y} boxHeight={PRICE_BOX.height} />
      )}
      <div className={local.description}
        style={{ left: DESCRIPTION_BOX.x, top: DESCRIPTION_BOX.y, width: DESCRIPTION_BOX.width, height: DESCRIPTION_BOX.height }}>
        {selected?.description ?? ''}
      </div>
    </>
  )
}
