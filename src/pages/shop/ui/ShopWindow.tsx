import { useEffect } from 'react'
import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  CURSOR_BLINK_PERIOD, CURSOR_VISIBLE_UPDATES, DESCRIPTION_BOX, HEAD_LABEL_FRAME, INNER, LABEL_HEIGHT,
  LEFT_TAB_BOX, MODE_UI_FRAME, MONEY_DIGIT_BASE_FRAME, NAME_BOX, RIGHT_TAB_BOX, SHOP_COLORS, SLOT_COLUMNS,
  SLOT_ROWS, SLOT_SIZE, VALUE_BOX, WINDOW_BOX, centeredLeftOf, centeredTopOf, slotPositionOf,
} from '@/pages/shop/lib/shopLayout'
import type { ShopBox, ShopWindowKindName } from '@/pages/shop/lib/shopLayout'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const ITEM_ICON = './sprites/item_icon'

const spriteSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

/** 만원 숫자를 글꼴 36(하늘색)으로 옮긴다 — 0x63331 이 소지금에 쓰는 글자꼴 */
const DIGIT_BASE_FRAME = 20
const withMoneyFont = (glyphs: readonly Glyph[]): Glyph[] =>
  glyphs.map((glyph) =>
    glyph.frame >= DIGIT_BASE_FRAME && glyph.frame < DIGIT_BASE_FRAME + 10
      ? { ...glyph, frame: glyph.frame - DIGIT_BASE_FRAME + MONEY_DIGIT_BASE_FRAME }
      : glyph,
  )

export interface ShopPartTabs {
  readonly names: readonly string[]
  readonly current: number
  readonly onChange: (part: number) => void
}

interface ShopWindowProps {
  readonly kind: ShopWindowKindName
  readonly entries: readonly ShopEntry[]
  readonly cursor: number
  readonly onMoveCursor: (index: number) => void
  readonly onSelect: (index: number) => void
  /** 소지금 (만원) */
  readonly money: number
  /** 팝업이 떠 있으면 창은 키를 안 받는다 */
  readonly isKeyEnabled: boolean
  /** 장비 상점의 부위 탭 (웹이 더한 것 — 원본은 목록의 행이 부위다) */
  readonly partTabs?: ShopPartTabs
}

/**
 * 아이템 창 0x81dc0 — **mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸** (P6 3절).
 *
 *   박스 0 창(24,48,192,212) · 1 왼쪽 탭 · 2 오른쪽 탭 · 3 이름 딱지 · 4 설명 · 5 값 칸
 *   격자 = 33×33 칸 10개 (x 34·69·104·139·174, y 77·115)
 *
 * 창 종류(R12 1a)에 따라 머리만 바뀐다 — 1 서브아이템 · 2 GP아이템 · 3 장비.
 * 아이템이 10 칸을 넘으면(장비 11 레벨) 격자를 한 행씩 굴린다 (근사 — shopLayout 주석 참고).
 */
export function ShopWindow({
  kind, entries, cursor, onMoveCursor, onSelect, money, isKeyEnabled, partTabs,
}: ShopWindowProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES

  const selected = entries[cursor]
  const rowCount = Math.ceil(entries.length / SLOT_COLUMNS)
  const cursorRow = Math.trunc(cursor / SLOT_COLUMNS)
  const topRow = rowCount <= SLOT_ROWS
    ? 0
    : Math.min(Math.max(0, cursorRow - SLOT_ROWS + 1), rowCount - SLOT_ROWS)
  const firstVisible = topRow * SLOT_COLUMNS
  const visible = entries.slice(firstVisible, firstVisible + SLOT_COLUMNS * SLOT_ROWS)

  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      const row = event.key === 'ArrowDown' ? SLOT_COLUMNS : event.key === 'ArrowUp' ? -SLOT_COLUMNS : 0
      if (step !== 0 || row !== 0) {
        onMoveCursor((cursor + step + row + entries.length) % entries.length)
        return
      }
      if (event.key === 'Enter') onSelect(cursor)
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
  /** 값 막대 프레임 52 를 칸 왼쪽에 (0x11 / 0x14) */
  const valueBar = (box: ShopBox) => {
    const size = modeUiOrigins?.[String(MODE_UI_FRAME.valueBar).padStart(3, '0')] ?? null
    if (size === null) return null
    return (
      <img className={styles.layer} alt=""
        src={spriteSrc(MODE_UI, MODE_UI_FRAME.valueBar)}
        style={{ left: box.x, top: centeredTopOf(box, size.height) }} />
    )
  }
  /** 칸 오른쪽 끝에 붙는 글 (정렬 0x21) */
  const rightLabel = (frame: number, box: ShopBox, color: string) => {
    const size = labelSizeOf(frame)
    if (size === null) return null
    return tintedLabel(frame, box.x + INNER.labelBarLeftPadding, centeredTopOf(box, size.height), color)
  }

  const descriptionLines = parseGameMarkup(selected?.description ?? '')

  return (
    <>
      {/* 박스 0 — 공용 판 0x55e61(skin, 24, 48, 192, 212, 정렬 0x11, 16) */}
      <div className={windowStyles.window}
        style={{ left: WINDOW_BOX.x, top: WINDOW_BOX.y, width: WINDOW_BOX.width, height: WINDOW_BOX.height }} />

      {/* 머리 — 창 종류별 (0x81ea2~0x82254) */}
      {kind === '서브' && centeredLabel(HEAD_LABEL_FRAME.서브아이템, LEFT_TAB_BOX, SHOP_COLORS.tabOn)}
      {kind === 'GP' && centeredLabel(HEAD_LABEL_FRAME.GP아이템, LEFT_TAB_BOX, SHOP_COLORS.tabOn)}
      {/* 장비 창의 머리 글은 원본에서 못 찾았다 — 부위 이름을 왼쪽 탭에 글자로 둔다 (근사) */}
      {partTabs !== undefined && partTabs.names.map((name, index) => (
        <button key={name} type="button"
          className={`${styles.partTab}${index === partTabs.current ? ` ${styles.partTabOn}` : ''}`}
          aria-pressed={index === partTabs.current}
          style={{
            left: LEFT_TAB_BOX.x + Math.trunc((LEFT_TAB_BOX.width / partTabs.names.length) * index),
            top: LEFT_TAB_BOX.y + 2,
            width: Math.trunc(LEFT_TAB_BOX.width / partTabs.names.length),
          }}
          onClick={() => partTabs.onChange(index)}>
          {name}
        </button>
      ))}

      {/* 서브·장비는 오른쪽 탭에 소지금 (종류 1·5 — 막대 52 + img_text 302 + 글꼴 36 숫자) */}
      {kind !== 'GP' && (
        <>
          {valueBar(RIGHT_TAB_BOX)}
          {rightLabel(HEAD_LABEL_FRAME.소지금, RIGHT_TAB_BOX, SHOP_COLORS.text)}
          <SpriteNumber glyphs={withMoneyFont(moneyGlyphsOf(money))}
            right={RIGHT_TAB_BOX.x + RIGHT_TAB_BOX.width - INNER.valueRightPadding}
            boxTop={RIGHT_TAB_BOX.y} boxHeight={RIGHT_TAB_BOX.height} />
        </>
      )}
      {/* GP 는 값 칸에 막대 52 + img_text 303 "가격" (종류 2) */}
      {kind === 'GP' && (
        <>
          {valueBar(VALUE_BOX)}
          {rightLabel(HEAD_LABEL_FRAME.가격, VALUE_BOX, SHOP_COLORS.text)}
        </>
      )}

      {/* 격자 커서 — 칸을 1px 둘러싼다 */}
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {isCursorVisible && cursor >= firstVisible && cursor < firstVisible + visible.length && (
          <rect
            x={slotPositionOf(cursor - firstVisible).x - 0.5}
            y={slotPositionOf(cursor - firstVisible).y - 0.5}
            width={SLOT_SIZE + 1} height={SLOT_SIZE + 1}
            fill="none" stroke={SHOP_COLORS.text} strokeWidth={1} />
        )}
      </svg>

      {visible.map((entry, offset) => {
        const index = firstVisible + offset
        const { x, y } = slotPositionOf(offset)
        return (
          <button key={entry.id} type="button" aria-label={entry.name} className={styles.slotButton}
            style={{ left: x, top: y, width: SLOT_SIZE, height: SLOT_SIZE }}
            onMouseEnter={() => onMoveCursor(index)}
            onClick={() => (cursor === index ? onSelect(index) : onMoveCursor(index))}>
            {entry.iconFrame === null
              // 장비 칸은 맞는 아이콘 표를 못 찾아 레벨 숫자만 그린다 (근사)
              ? <span>{index + 1}</span>
              : <img className={entry.isOwned ? styles.ownedIcon : undefined} alt=""
                  src={spriteSrc(ITEM_ICON, entry.iconFrame)} />}
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
      <div className={styles.nameText}
        style={{
          left: NAME_BOX.x + INNER.nameTextLeft,
          top: centeredTopOf(NAME_BOX, LABEL_HEIGHT),
          width: NAME_BOX.width - INNER.nameTextLeft * 2,
        }}>
        {selected?.name ?? ''}
      </div>

      {/* 박스 5 값 칸 — 서브·장비는 만원(억 표기), GP 는 그냥 숫자. 글색 노랑 */}
      {selected !== undefined && (
        <SpriteNumber
          glyphs={kind === 'GP' ? numberGlyphsOf(selected.price) : moneyGlyphsOf(selected.price)}
          right={VALUE_BOX.x + VALUE_BOX.width - INNER.valueRightPadding}
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
