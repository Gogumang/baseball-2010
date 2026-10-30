/** 124 첫 갈래 목록의 화살 · 누름 칸 (5ca52~5ca6c, 깜빡 = `yearArrowBlinkOf`) */
import { PressArea } from '@/shared/ui'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { VISIBLE_YEAR_COLUMNS, YEAR_TABLE_LAYOUT } from '@/pages/nari-record-room/lib/nariRecordRoom'
import {
  DOWN_ARROW_IMAGE,
  SIDE_ARROW_IMAGE,
  SLT_FRAME,
  UP_ARROW_IMAGE,
  imageOf,
  pixel,
} from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'

const layout = YEAR_TABLE_LAYOUT

/** 위 · 아래 화살 — 목록 줄 수 > 1 이면 slt_frame 0x20 · 0x21 (114, 45 − 깜빡 · 277 + 깜빡) */
export function YearUpDownArrows({ blink }: { readonly blink: number }) {
  return (
    <>
      <img alt="위" src={imageOf(SLT_FRAME, UP_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.upArrowY - blink }} />
      <img alt="아래" src={imageOf(SLT_FRAME, DOWN_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.downArrowY + blink }} />
    </>
  )
}

/** 웹 덧붙임 — 위 · 아래 · 앞 열 · 다음 열 화살 위 투명 칸: 원본 ↑ · ↓ · ← · → 키 한 번. 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만) */
export function YearPressAreas({ hasRows, hasColumns }: { readonly hasRows: boolean; readonly hasColumns: boolean }) {
  return (
    <>
      {hasRows && (
        <>
          <PressArea label="위 줄" onPress={() => tapKey('ArrowUp')} rect={{ x: layout.arrowX - 4, y: layout.upArrowY - 4, width: 20, height: 16 }} />
          <PressArea
            label="아래 줄"
            onPress={() => tapKey('ArrowDown')}
            rect={{ x: layout.arrowX - 4, y: layout.downArrowY - 2, width: 20, height: 16 }}
          />
        </>
      )}
      {hasColumns && (
        <>
          <PressArea
            label="앞 열"
            onPress={() => tapKey('ArrowLeft')}
            rect={{ x: layout.statX - 11, y: layout.sideArrowY - 3, width: 11, height: 14 }}
          />
          <PressArea
            label="다음 열"
            onPress={() => tapKey('ArrowRight')}
            rect={{ x: layout.statX + layout.clip.width - 5, y: layout.sideArrowY - 3, width: 11, height: 14 }}
          />
        </>
      )}
    </>
  )
}

/** 앞 열 ◀ (첫 열 ≠ 0) · 다음 열 ▶ (첫 열 + 4 ≠ 열 수) — slt_frame 20, ▶ 은 뒤집어(0x11) */
export function YearSideArrows({
  firstColumn,
  columnCount,
  blink,
}: {
  readonly firstColumn: number
  readonly columnCount: number
  readonly blink: number
}) {
  return (
    <>
      {firstColumn !== 0 && (
        <img alt="앞 열" src={imageOf(SLT_FRAME, SIDE_ARROW_IMAGE)} style={{ ...pixel, left: layout.statX - blink - 5, top: layout.sideArrowY }} />
      )}
      {firstColumn + VISIBLE_YEAR_COLUMNS !== columnCount && (
        <img
          alt="다음 열"
          src={imageOf(SLT_FRAME, SIDE_ARROW_IMAGE)}
          style={{ ...pixel, left: layout.statX + layout.clip.width + blink - 5, top: layout.sideArrowY, transform: 'scaleX(-1)' }}
        />
      )}
    </>
  )
}
