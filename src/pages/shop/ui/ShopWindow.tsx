import { useEffect } from 'react'
import { CommonPanel, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  CURSOR_BLINK_PERIOD, CURSOR_VISIBLE_UPDATES, DESCRIPTION_BOX, HEAD_LABEL_FRAME, INNER, LABEL_HEIGHT,
  LEFT_TAB_BOX, MODE_UI_FRAME, MONEY_BAR_OFFSET, MONEY_DIGIT_OFFSET, MONEY_LABEL_OFFSET, NAME_BOX, RIGHT_TAB_BOX, SHOP_COLORS,
  SLOT_COUNT, SLOT_SIZE, VALUE_BOX, VALUE_DIGIT_RIGHT_INSET, WINDOW_BOX, centeredLeftOf, centeredTopOf, movedSlotOf, slotCellRectsOf,
  slotGridKeyOf, slotPositionOf, valueBarPositionOf,
} from '@/pages/shop/lib/shopLayout'
import type { ItemGridWindowKind, ShopBox } from '@/pages/shop/lib/shopLayout'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const ITEM_ICON = './sprites/item_icon'

const spriteSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface ShopWindowProps {
  readonly kind: ItemGridWindowKind
  /** 칸 k 의 내용 — 없거나 null 이면 빈 칸(바탕만, 커서는 선다 · 이름 · 값 · 설명 없음) */
  readonly entries: readonly (ShopEntry | null)[]
  readonly cursor: number
  readonly onMoveCursor: (index: number) => void
  readonly onSelect: (index: number) => void
  /** 소지금 (만원) */
  readonly money: number
  /** 팝업이 떠 있으면 창은 키를 안 받는다 */
  readonly isKeyEnabled: boolean
}

/**
 * 아이템 창 0x81dc0 — **mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸** (P6 3절).
 *
 *   박스 0 창(24,48,192,212) · 1 왼쪽 탭 · 2 오른쪽 탭 · 3 이름 딱지 · 4 설명 · 5 값 칸
 *   격자 = 33×33 칸 10개 (x 34·69·104·139·174, y 77·115)
 *
 * 창 종류(R12 1a)에 따라 머리만 바뀐다 — 1 서브아이템 · 2 GP아이템 · 5 보유 아이템(머리는 1 과 같다). 장비(종류 3)는 이 창이
 * 아니라 장비 창 0x83378(`EquipmentWindow`)이다.
 * 칸마다 칸 바탕 0x7e764 를 먼저 깔고(10칸 모두 — 빈 칸도) 그 위에 아이콘을 얹는다.
 * 격자는 늘 5 열 × 2 줄 10칸이고 커서는 줄 · 열 안에서 감긴다(`movedSlotOf` — 목록 vt+0x1c(5, 2, 1, 0x30)).
 * 커서 칸이 비었으면 이름 · 값 · 설명을 그리지 않는다(종류 2 칸 > 6 은 0x826a6 · 0x827c6 · 0x828b4, 종류 5 안 가진 칸은 0x82646).
 */
export function ShopWindow({
  kind, entries, cursor, onMoveCursor, onSelect, money, isKeyEnabled,
}: ShopWindowProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES

  const selected = entries[cursor] ?? undefined

  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const key = slotGridKeyOf(event.key)
      if (key === null) return
      if (key === '확인') onSelect(cursor)
      else onMoveCursor(movedSlotOf(cursor, key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const labelSizeOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')] ?? null
  /** img_text 글 그림을 단색으로 찍는다 (효과 11) */
  const tintedLabel = (frame: number, left: number, top: number, color: string) => {
    const size = labelSizeOf(frame)
    if (size === null) return null
    return (
      <div
        key={`${frame}-${left}`}
        className={styles.tintedLabel}
        style={{
          left, top, width: size.width, height: size.height, background: color,
          maskImage: `url(${spriteSrc(IMG_TEXT, frame)})`,
          WebkitMaskImage: `url(${spriteSrc(IMG_TEXT, frame)})`,
        }}
      />
    )
  }
  const centeredLabel = (frame: number, box: ShopBox, color: string) => {
    const size = labelSizeOf(frame)
    if (size === null) return null
    return tintedLabel(frame, centeredLeftOf(box, size.width), centeredTopOf(box, size.height), color)
  }
  /** 값 막대 프레임 52 — 정렬 0x11 · (ox, oy) 또는 0x14(오른쪽 위) */
  const valueBar = (box: ShopBox, align: 0x11 | 0x14, ox = 0, oy = 0) => {
    const size = modeUiOrigins?.[String(MODE_UI_FRAME.valueBar).padStart(3, '0')] ?? null
    if (size === null) return null
    const { x, y } = valueBarPositionOf(box, align, size.width, ox, oy)
    return (
      <img className={styles.layer} alt="" src={spriteSrc(MODE_UI, MODE_UI_FRAME.valueBar)} style={{ left: x, top: y }} />
    )
  }
  /** 칸 왼쪽 · 세로 가운데에 붙는 글 (정렬 0x21) */
  const leftLabel = (frame: number, box: ShopBox, color: string, ox = 0, oy = 0) => {
    const size = labelSizeOf(frame)
    if (size === null) return null
    return tintedLabel(frame, box.x + ox, centeredTopOf(box, size.height) + oy, color)
  }

  const descriptionLines = parseGameMarkup(selected?.description ?? '')

  return (
    <>
      {/* 박스 0 — 81e66 공용 판 0x55e61(skin, 24, 48, 192, 212, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
          (81e3e~81e68 직접 뜸 — [창+0x1a4] ≠ 0 인 서브 · GP 갈래. 0 이면 81e20 → 0x81d0c 스킬 창 판). 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel x={WINDOW_BOX.x} y={WINDOW_BOX.y} width={WINDOW_BOX.width} height={WINDOW_BOX.height}
        topBand={0x10} titleTab testId="상점-판" />

      {/* 머리 — 창 종류별 (0x81ea2~0x82254) */}
      {kind !== 'GP' && centeredLabel(HEAD_LABEL_FRAME.서브아이템, LEFT_TAB_BOX, SHOP_COLORS.tabOn)}
      {kind === 'GP' && centeredLabel(HEAD_LABEL_FRAME.GP아이템, LEFT_TAB_BOX, SHOP_COLORS.tabOn)}
      {/* 서브 · 보유는 박스 2 에 소지금 (종류 1·5 — 막대 52 · img_text 302 · 주황 숫자, 모두 oy 4) */}
      {kind !== 'GP' && (
        <>
          {valueBar(RIGHT_TAB_BOX, 0x11, MONEY_BAR_OFFSET.x, MONEY_BAR_OFFSET.y)}
          {leftLabel(HEAD_LABEL_FRAME.소지금, RIGHT_TAB_BOX, SHOP_COLORS.text, MONEY_LABEL_OFFSET.x, MONEY_LABEL_OFFSET.y)}
          <SpriteNumber glyphs={moneyGlyphsOf(money)}
            right={RIGHT_TAB_BOX.x + RIGHT_TAB_BOX.width + MONEY_DIGIT_OFFSET.x}
            boxTop={RIGHT_TAB_BOX.y + MONEY_DIGIT_OFFSET.y} boxHeight={RIGHT_TAB_BOX.height} />
        </>
      )}
      {/* 값 칸 — 서브·GP 둘 다 막대 52(정렬 0x14) + img_text 303 "가격"(정렬 0x21) */}
      {valueBar(VALUE_BOX, 0x14)}
      {leftLabel(HEAD_LABEL_FRAME.가격, VALUE_BOX, SHOP_COLORS.text)}

      {/* 칸 바탕 0x7e764 — 10칸 모두 (0x82420, 깃발 0) */}
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges"
        data-testid="shop-slot-cells">
        {Array.from({ length: SLOT_COUNT }, (_unused, slot) => slotCellRectsOf(slotPositionOf(slot)).map((rect, part) => (
          <rect key={`${slot}-${part}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
        )))}
      </svg>

      {/* 격자 커서 — 칸을 1px 둘러싼다 */}
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {isCursorVisible && cursor >= 0 && cursor < SLOT_COUNT && (
          <rect
            x={slotPositionOf(cursor).x - 0.5}
            y={slotPositionOf(cursor).y - 0.5}
            width={SLOT_SIZE + 1} height={SLOT_SIZE + 1}
            fill="none" stroke={SHOP_COLORS.text} strokeWidth={1} />
        )}
      </svg>

      {Array.from({ length: SLOT_COUNT }, (_unused, index) => {
        const entry = entries[index] ?? null
        const { x, y } = slotPositionOf(index)
        return (
          <button key={entry?.id ?? `빈칸:${index}`} type="button" aria-label={entry?.name ?? `빈 칸 ${index}`}
            aria-current={cursor === index} className={styles.slotButton}
            style={{ left: x, top: y, width: SLOT_SIZE, height: SLOT_SIZE }}
            onClick={() => (cursor === index ? onSelect(index) : onMoveCursor(index))}>
            {entry !== null && entry.iconFrame !== null && (
              <img className={kind === '서브' && entry.isOwned ? styles.ownedIcon : undefined} alt=""
                src={spriteSrc(ITEM_ICON, entry.iconFrame)} />
            )}
          </button>
        )
      })}

      {/* 박스 3 이름 딱지 — 검정 그림자 뒤 흰 글 가운데 (0x8225e) */}
      <div className={styles.nameTag}
        style={{ left: NAME_BOX.x, top: NAME_BOX.y, width: NAME_BOX.width, height: NAME_BOX.height }} />
      <div className={styles.nameShadow}
        style={{
          left: NAME_BOX.x + INNER.nameTextLeft + INNER.nameShadow,
          top: centeredTopOf(NAME_BOX, LABEL_HEIGHT) + INNER.nameShadow,
          width: NAME_BOX.width - INNER.nameTextLeft * 2,
        }}>
        {selected?.name ?? ''}
      </div>
      <div className={styles.nameText} data-testid="shop-name"
        style={{
          left: NAME_BOX.x + INNER.nameTextLeft,
          top: centeredTopOf(NAME_BOX, LABEL_HEIGHT),
          width: NAME_BOX.width - INNER.nameTextLeft * 2,
        }}>
        {selected?.name ?? ''}
      </div>

      {/* 박스 5 값 칸 — 서브는 만원(억 표기), GP 는 그냥 숫자. 글색 노랑 */}
      {selected !== undefined && (
        <SpriteNumber
          glyphs={kind === 'GP' ? numberGlyphsOf(selected.price) : moneyGlyphsOf(selected.price)}
          right={VALUE_BOX.x + VALUE_BOX.width - VALUE_DIGIT_RIGHT_INSET}
          boxTop={VALUE_BOX.y} boxHeight={VALUE_BOX.height} />
      )}

      {/* 박스 4 설명 — 왼쪽 위 정렬 (0x802dd + 조건 문구) */}
      <div className={styles.description} data-testid="shop-description"
        style={{
          left: DESCRIPTION_BOX.x + INNER.descriptionPadding,
          top: DESCRIPTION_BOX.y + INNER.descriptionPadding,
          width: DESCRIPTION_BOX.width - INNER.descriptionPadding * 2,
          height: DESCRIPTION_BOX.height - INNER.descriptionPadding * 2,
          lineHeight: `${INNER.descriptionLineHeight}px`,
        }}>
        {descriptionLines.map((line, lineIndex) => (
          <p key={lineIndex} className={styles.descriptionLine}
            style={line.isCentered ? { textAlign: 'center' } : undefined}>
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
                {segment.text}
              </span>
            ))}
            {line.segments.length === 0 && ' '}
          </p>
        ))}
      </div>
    </>
  )
}
