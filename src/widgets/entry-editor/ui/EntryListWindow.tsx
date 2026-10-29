import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useMirrorSkinStepCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { useMarkSkinNameBars } from '@/shared/lib/skinNameBars/skinNameBars'
import { CommonPanel, useImgTextPalette3 } from '@/shared/ui'
import { ENTRY_LIST_LAYOUT, entryListGeometryOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryColumnTable } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListRow } from '@/widgets/entry-editor/ui/entryListWindow/entryListRow'
import { CursorBorder, Rect } from '@/widgets/entry-editor/ui/entryListWindow/entryListAtoms'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES, pixel } from '@/widgets/entry-editor/ui/entryListWindow/entryListAssets'
import { EntryColumnCells } from '@/widgets/entry-editor/ui/entryListWindow/EntryColumnCells'
import { EntryListPresses, type EntryArrowDirection } from '@/widgets/entry-editor/ui/entryListWindow/EntryListPresses'
import { EntrySideArrows, EntryVerticalArrows } from '@/widgets/entry-editor/ui/entryListWindow/EntryListArrows'
import { entryListRectsOf } from '@/widgets/entry-editor/ui/entryListWindow/entryListRects'
import { roundFillRectsOf } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'

export type { EntryListRow } from '@/widgets/entry-editor/ui/entryListWindow/entryListRow'

/** 고른 줄 칠 0x563dc — 반투명 빨강 */
const PICKED_FILL_COLOR = 'rgba(255, 0, 0, 0.502)'

export interface EntryListWindowProps {
  readonly rows: readonly EntryListRow[]
  /** 그 탭의 열 표 (고정 열 · 넘기는 열) */
  readonly table: EntryColumnTable
  readonly cursor: number
  /** 목록 윗줄 [목록+0x30] */
  readonly top: number
  /** [ed+0x335] */
  readonly firstColumn: number
  /** 이번 그림의 열 밀림 (px) */
  readonly slideOffset: number
  /** [ed+0x40c] */
  readonly keyPresses: number
  /** s8 [ed+0x330] — 0 타순 · 1 수비위치 · −1 보기 전용 */
  readonly subTab: number
  /** s8 [ed+0x418] — −1 없음 */
  readonly picked: number
  /** [ed+0x333] — 이름 칸 덧그림(0x571d8) */
  readonly showsNameBars: boolean
  /** [ed+0x438] — 커서가 이름 칸만 (스페셜 에디트) */
  readonly isCursorNameOnly?: boolean
  /** 웹 전용 — 줄 누름 칸 (커서 줄이면 확인, 아니면 커서 옮김 — 부르는 쪽이 정한다) */
  readonly onPressRow?: (index: number) => void
  /** 웹 전용 — ▲▼ · 옆 화살 그림 자리 누름 칸 */
  readonly onPressArrow?: (direction: EntryArrowDirection) => void
  readonly testId?: string
}

/**
 * **엔트리 목록 창 0x5cfec → 0x5c984** — 배치 근거는 `lib/entryListWindow` 머리말(직접 떴다).
 * 그림 차례: 판 → ▲▼ → 고정 열 → 옆 화살 → 자르기 안 넘기는 열 → 커서 0x56234 → 고른 줄 0x563dc. 조각은 `entryListWindow/`.
 */
export function EntryListWindow(props: EntryListWindowProps) {
  const { rows, table, cursor, top, firstColumn, slideOffset, keyPresses, subTab, picked, showsNameBars } = props
  const testId = props.testId ?? '엔트리-목록'
  const gameUi = useFrameOrigins(GAME_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const L = ENTRY_LIST_LAYOUT
  // [ed+0x40c] 는 전역 스킨 칸이다 — 편집기가 0x5561c 의 0 에서 센 값을 그대로 옮겨 다음 화면(경기설정 창 · 순위 판 · 명전)이 잇게 한다
  useMirrorSkinStepCounter(keyPresses)
  // [ed+0x333] 도 전역 스킨 칸 — 이 창을 1 로 세우는 진입(시즌 0x5870 … · 0x16af8 · 0x2648c)이 적은 값을 다음 화면(스페셜 에디트)이 본다
  useMarkSkinNameBars(showsNameBars)
  const geometry = entryListGeometryOf({ table, firstColumn, slideOffset, keyPresses })
  const isCursorNameOnly = props.isCursorNameOnly === true
  const { visibleCount, cursorRect, pickedRect } = entryListRectsOf({
    geometry,
    rowCount: rows.length,
    cursor,
    top,
    subTab,
    picked,
    isCursorNameOnly,
  })
  const visibleRows = rows.slice(top, top + visibleCount)
  const hasVerticalArrows = rows.length > 1

  const columnProps = { rows: visibleRows, top, gameUi, imgText, palette3: palette3.style, showsNameBars }
  return (
    <div role="group" aria-label="엔트리 목록" data-testid={testId}>
      {palette3.definition}
      {/* 5ca4e 공용 판 — 아래 띠 (s8)[ed+0x3e8] 은 0x5561c 가 늘 0 으로 둔다 */}
      <CommonPanel x={L.panel.x} y={L.panel.y} width={L.panel.width} height={L.panel.height} topBand={L.panel.topBand} testId="엔트리-판" />
      {hasVerticalArrows && <EntryVerticalArrows keyPresses={keyPresses} />}
      {geometry.fixed.map((placed) => (
        <EntryColumnCells key={placed.column.word} placed={placed} {...columnProps} />
      ))}
      <EntrySideArrows geometry={geometry} />
      <div
        style={{
          ...pixel,
          left: geometry.clip.x,
          top: geometry.clip.y,
          width: geometry.clip.width,
          height: geometry.clip.height,
          overflow: 'hidden',
        }}
        data-testid={`${testId}-넘기는-열`}
      >
        <div style={{ ...pixel, left: -geometry.clip.x, top: -geometry.clip.y }}>
          {geometry.scroll.map((placed) => (
            <EntryColumnCells key={placed.index} placed={placed} {...columnProps} />
          ))}
        </div>
      </div>
      {cursorRect !== null && <CursorBorder rect={cursorRect} keyPresses={keyPresses} />}
      {pickedRect !== null && (
        <div data-testid={`${testId}-고른줄`}>
          {roundFillRectsOf({ ...pickedRect, round: 1 }).map((rect, index) => (
            <Rect key={index} {...rect} color={PICKED_FILL_COLOR} />
          ))}
        </div>
      )}
      <EntryListPresses
        geometry={geometry}
        rows={visibleRows}
        top={top}
        cursor={cursor}
        onPressRow={props.onPressRow}
        onPressArrow={props.onPressArrow}
        hasVerticalArrows={hasVerticalArrows}
      />
    </div>
  )
}
