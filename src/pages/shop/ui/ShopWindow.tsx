import { useEffect } from 'react'
import { CommonPanel, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { moneyGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  CURSOR_BLINK_PERIOD,
  CURSOR_VISIBLE_UPDATES,
  HEAD_LABEL_FRAME,
  LEFT_TAB_BOX,
  MONEY_BAR_OFFSET,
  MONEY_DIGIT_OFFSET,
  MONEY_LABEL_OFFSET,
  RIGHT_TAB_BOX,
  SHOP_COLORS,
  VALUE_BOX,
  WINDOW_BOX,
  movedSlotOf,
  slotGridKeyOf,
} from '@/pages/shop/lib/shopLayout'
import type { ItemGridWindowKind } from '@/pages/shop/lib/shopLayout'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import { CenteredLabel, LeftLabel, ValueBar } from '@/pages/shop/ui/shopWindow/shopLabels'
import { ShopSelectedText } from '@/pages/shop/ui/shopWindow/ShopSelectedText'
import { ShopSlotGrid } from '@/pages/shop/ui/shopWindow/ShopSlotGrid'
import { IMG_TEXT, MODE_UI } from '@/pages/shop/ui/shopWindow/spriteFolders'

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
  /**
   * 취소 키(CLR) — 상점 111 키 0x13460 의 종류 1(1364e → 13722) · 2(1372e → 13b16)는 확인이 아닌 키가 −16 이면
   * `0xbcb49(0x6e)` 로 110 아이템 하위 메뉴에 돌아간다(13b1e). 안 주면 받지 않는다.
   */
  readonly onCancel?: () => void
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
export function ShopWindow({ kind, entries, cursor, onMoveCursor, onSelect, money, isKeyEnabled, onCancel }: ShopWindowProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES

  const selected = entries[cursor] ?? undefined

  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel !== undefined) {
        event.preventDefault()
        return onCancel()
      }
      const key = slotGridKeyOf(event.key)
      if (key === null) return
      if (key === '확인') onSelect(cursor)
      else onMoveCursor(movedSlotOf(cursor, key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      {/* 박스 0 — 81e66 공용 판 0x55e61(skin, 24, 48, 192, 212, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
          (81e3e~81e68 직접 뜸 — [창+0x1a4] ≠ 0 인 서브 · GP 갈래. 0 이면 81e20 → 0x81d0c 스킬 창 판). 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel x={WINDOW_BOX.x} y={WINDOW_BOX.y} width={WINDOW_BOX.width} height={WINDOW_BOX.height} topBand={0x10} titleTab testId="상점-판" />

      {/* 머리 — 창 종류별 (0x81ea2~0x82254) */}
      <CenteredLabel
        frame={kind === 'GP' ? HEAD_LABEL_FRAME.GP아이템 : HEAD_LABEL_FRAME.서브아이템}
        box={LEFT_TAB_BOX}
        color={SHOP_COLORS.tabOn}
        origins={textOrigins}
      />
      {/* 서브 · 보유는 박스 2 에 소지금 (종류 1·5 — 막대 52 · img_text 302 · 주황 숫자, 모두 oy 4) */}
      {kind !== 'GP' && (
        <>
          <ValueBar box={RIGHT_TAB_BOX} align={0x11} origins={modeUiOrigins} ox={MONEY_BAR_OFFSET.x} oy={MONEY_BAR_OFFSET.y} />
          <LeftLabel
            frame={HEAD_LABEL_FRAME.소지금}
            box={RIGHT_TAB_BOX}
            color={SHOP_COLORS.text}
            origins={textOrigins}
            ox={MONEY_LABEL_OFFSET.x}
            oy={MONEY_LABEL_OFFSET.y}
          />
          <SpriteNumber
            glyphs={moneyGlyphsOf(money)}
            right={RIGHT_TAB_BOX.x + RIGHT_TAB_BOX.width + MONEY_DIGIT_OFFSET.x}
            boxTop={RIGHT_TAB_BOX.y + MONEY_DIGIT_OFFSET.y}
            boxHeight={RIGHT_TAB_BOX.height}
          />
        </>
      )}
      {/* 값 칸 — 서브·GP 둘 다 막대 52(정렬 0x14) + img_text 303 "가격"(정렬 0x21) */}
      <ValueBar box={VALUE_BOX} align={0x14} origins={modeUiOrigins} />
      <LeftLabel frame={HEAD_LABEL_FRAME.가격} box={VALUE_BOX} color={SHOP_COLORS.text} origins={textOrigins} />

      <ShopSlotGrid
        kind={kind}
        entries={entries}
        cursor={cursor}
        isCursorVisible={isCursorVisible}
        isKeyEnabled={isKeyEnabled}
        onMoveCursor={onMoveCursor}
        onSelect={onSelect}
      />
      <ShopSelectedText kind={kind} selected={selected} />
    </>
  )
}
