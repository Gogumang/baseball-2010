/** 124 첫 갈래 목록의 그림 조각 — 머리 글 · 번호 열 · 커서 (배치는 `YEAR_TABLE_LAYOUT` 머리말) */
import type { CSSProperties } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { YEAR_TABLE_LAYOUT, yearCursorIsInsetOf, yearLabelOffsetOf, yearNumberGlyphsOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom'
import {
  CURSOR_COLOR,
  CURSOR_INSET_COLOR,
  GAME_UI_FRAMES,
  IMG_TEXT,
  NUM,
  NUMBER_CELL_FRAME,
  frameSrc,
  imageOf,
  pixel,
} from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'

const layout = YEAR_TABLE_LAYOUT
const rowYOf = (offsetRow: number) => layout.firstRowY + offsetRow * layout.rowStep

/** 머리 글 img_text — 0x5650c 가 (x, 56, 폭, 15) + dy 2 = (x, 58, 폭, 15) 가운데에 (img_text 크기는 origins.json). 팔레트 3 (0x565ac~0x565b8 `0x913e5(img_text, 3)`) */
export function YearLabel({
  frame,
  x,
  width,
  alt,
  palette,
}: {
  readonly frame: number
  readonly x: number
  readonly width: number
  readonly alt: string
  readonly palette: CSSProperties
}) {
  const origins = useFrameOrigins(IMG_TEXT)
  const size = origins?.[String(frame).padStart(3, '0')]
  const offset = size === undefined ? { x: 0, y: 3 } : yearLabelOffsetOf(width, size.width, size.height)
  return <img alt={alt} src={frameSrc(frame)} style={{ ...pixel, ...palette, left: x + offset.x, top: YEAR_TABLE_LAYOUT.labelY + offset.y }} />
}

/**
 * 둥글기 1 테두리 0x6aa65 — (w + 1)×(h + 1), 네 모서리 점은 빈다.
 *
 * 커서 0x56234 의 나머지 두 갈래는 124 에서 서지 않는다 (직접 떴다):
 * - **두 그림 번쩍임** — [skin+0x2cc] ≠ −1 이면 그 그림은 바깥 불투명 노랑으로 그리고 [skin+0x2c8] + 1 > 1 에서 −1 로 돌린다.
 *   [+0x2cc] 는 부팅 0x2ed8 → 0x53b24 → 0x5390c 가 −1 · [+0x2c8] = 0 으로 두고, 쓰는 곳은 다른 목록 그림 0x58d10(0x639a4) ·
 *   0x593c8(메인 메뉴 0x2db28~ · 경기 0x3cdd0) · 0x63c5e 가 [목록+0x25] 일 때 [skin+0x8c] 를 넣는 것뿐이다(바이너리 전체 `#0xb3 << 2`
 *   전수). 124 의 편집기는 그 전역 skin([장면+0xd8])이라 그 화면들이 남긴 번쩍임이 있을 때만 뜬다 — 106 → 팝업 0x80 → 124 길에는 없다.
 * - **둘째 테두리 0x563dc**(0x5cf8c) — (s8)[편집기+0x330] 이 −1 이면 곧장 돌아간다. 0x5561c 는 셋째 인자(편집 가능)가 0 이면
 *   +0x330 = −1 · +0x418 = −1 로 두고, 124 진입 0x116d4 는 0 으로 부른다(보기 전용) — 바꿀 줄 반투명 빨강 0x80ff0000 은 안 그린다.
 */
function RoundedBorder({
  x,
  y,
  width,
  height,
  color,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}) {
  const line = (left: number, top: number, w: number, h: number) => <span style={{ ...pixel, left, top, width: w, height: h, background: color }} />
  return (
    <div data-testid="개인기록-커서">
      {line(x + 1, y, width - 1, 1)}
      {line(x + 1, y + height, width - 1, 1)}
      {line(x, y + 1, 1, height - 1)}
      {line(x + width, y + 1, 1, height - 1)}
    </div>
  )
}

/** 커서 0x56234 — [+0x40c] % 8 ≤ 3 이면 안쪽 반투명 (x + 1, y + 1, 194, 13), 아니면 바깥 불투명 (x, y, 196, 15) */
export function YearCursor({ view, visibleCount }: { readonly view: YearRecordView; readonly visibleCount: number }) {
  const cursorRow = view.cursor - view.top
  if (cursorRow < 0 || cursorRow >= visibleCount) return null
  if (yearCursorIsInsetOf(view)) {
    return (
      <RoundedBorder
        x={layout.numberX + 1}
        y={rowYOf(cursorRow) + 1}
        width={layout.cursorWidth - 2}
        height={layout.cellHeight - 2}
        color={CURSOR_INSET_COLOR}
      />
    )
  }
  return <RoundedBorder x={layout.numberX} y={rowYOf(cursorRow)} width={layout.cursorWidth} height={layout.cellHeight} color={CURSOR_COLOR} />
}

/** 고정 "연차" 열 0x5658c — 줄마다 번호 칸 0x1b 와 번호 i + 1 */
export function YearNumberRows({ top, count }: { readonly top: number; readonly count: number }) {
  return Array.from({ length: count }, (_unused, offsetRow) => (
    <div key={top + offsetRow} aria-label={String(top + offsetRow + 1)}>
      <img alt="" src={imageOf(GAME_UI_FRAMES, NUMBER_CELL_FRAME)} style={{ ...pixel, left: layout.numberX, top: rowYOf(offsetRow) }} />
      {yearNumberGlyphsOf(top + offsetRow + 1).map((glyph, index) => (
        <img key={index} alt="" src={imageOf(NUM, glyph.frame)} style={{ ...pixel, left: layout.numberX + glyph.x, top: rowYOf(offsetRow) + 3 }} />
      ))}
    </div>
  ))
}
