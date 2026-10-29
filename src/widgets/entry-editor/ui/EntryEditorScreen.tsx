import { MessageBox, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'
import { ACE_ENTRY_LOCKED_TEXT, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterRow, EntryEditorState, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor'
import { ENTRY_TABLES_BASIC } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryColumnTables } from '@/widgets/entry-editor/lib/entryListWindow'
import { EntryDetailOverlay } from '@/widgets/entry-editor/ui/EntryDetailOverlay'
import { EntryListPanel } from '@/widgets/entry-editor/ui/entryEditorScreen/EntryListPanel'
import type { EntryEditorScreenProps, EntryFace } from '@/widgets/entry-editor/ui/entryEditorScreen/entryEditorProps'
import { entryFooterPressesOf, entryFrameOfTab } from '@/widgets/entry-editor/ui/entryEditorScreen/entryFooter'
import { useEntryFrameTicks } from '@/widgets/entry-editor/ui/entryEditorScreen/useEntryFrameTicks'
import { useEntryKeyboard } from '@/widgets/entry-editor/ui/entryEditorScreen/useEntryKeyboard'

export type { EntryEditorScreenProps, EntryFace } from '@/widgets/entry-editor/ui/entryEditorScreen/entryEditorProps'

/**
 * **엔트리 편집 화면** — 시즌 0xe0(그림 `0xb074`) · 0xdf(`0xb010`) · 일반모드 상태 23(그림 `0x2e070`) · 스페셜 에디트 29(`0x2e1e0`):
 * 엔트리 목록 창 `0x5cfec`(`EntryListWindow` — 칸 배치 · 수비/보직 딱지 · 기록 열 · 커서 · 열 밀기 모두 원본에서 떴다)
 * + 머리띠 `0x54d95(skin, 탭 1 ? 7 "투수엔트리"/바닥 0xf : 6 "타자엔트리"/바닥 0x17)`.
 * 키는 `entities/season-mode/model/entryEditor.pressEntryKey`(0x55864)가 다 들고, 이 화면은 그리고 키만 넘긴다.
 * 원본 창에는 팀 이름 · 하위 탭 글이 없다 — 하위 탭(타순 · 수비위치)은 커서 꼴(이름+딱지 칸 / 딱지 칸만)로만 보인다.
 *
 * '0' 상세 창은 0x5c984 끝(0x5cfc8)이 부르는 0x5b798(ed, 투수 탭 ? 3 : 2, 커서 줄 레코드) — `PlayerDetailWindow`. 창 자리는 편집기 '0'
 * 0x55920 이 세운 (W/2 + 0x5c, H/2 − 0x60) = (212, 64) 에서 열린다. 키 0x55864 머리(0x5589e~0x558c2)는 창이 떠 있고 목록 객체
 * [목록+0x25](0x6c030 이 커서가 바뀌면 1)가 서면 도형을 다시 만든다([[ed+0xd8]+0x1e3] = 0) — 웹은 커서가 바뀐 그림으로 본다.
 */
export function EntryEditorScreen<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace>({
  editor,
  lists,
  teamName,
  isAceLocked,
  gamePoint = 0,
  title,
  overlay,
  underlay,
  footer,
  slides,
  onKey,
  onMoveCursor,
  onCloseAceLocked,
  tables = ENTRY_TABLES_BASIC,
  showsNameBars,
  isCursorNameOnly,
  onFrame,
  ticksEveryFrame = false,
}: EntryEditorScreenProps<B, P>) {
  useEntryKeyboard(isAceLocked, onKey)
  useEntryFrameTicks(onFrame, editor.slide !== null, ticksEveryFrame)

  const { isPitcherTab, rows, table } = entryTabOf(editor, lists, tables)
  const tabFrame = entryFrameOfTab(isPitcherTab)

  return (
    <RawScreen>
      {underlay}
      <EntryListPanel
        editor={editor}
        rows={rows}
        table={table}
        teamName={teamName}
        isAceLocked={isAceLocked}
        showsNameBars={showsNameBars}
        isCursorNameOnly={isCursorNameOnly}
        onKey={onKey}
        onMoveCursor={onMoveCursor}
      />

      {/* '0' 상세 창 — [ed+0x424] 를 켠 그림부터 창이 열리고(0x5c8aa), 커서가 움직이면 도형을 다시 만든다 */}
      <EntryDetailOverlay isOpen={editor.isDetailOpen} cursor={editor.cursor} row={rows[editor.cursor]} isPitcherTab={isPitcherTab} />

      {/* 바닥 — 투수 탭 0xf "#타자"+"0상세정보"+되돌아가기 · 타자 탭 0x17 "#투수"+… (일반 0x2e0a2 · 시즌 0xb090).
          표시는 "#" 지만 탭을 바꾸는 키는 편집기 0x55864 의 '*'(0x2a, 0x558c4)다 — '#'(0x23)는 아무 일도 안 한다. 원본 그대로 둔다. */}
      <ScreenFrame
        title={title ?? tabFrame.title}
        gamePoint={gamePoint}
        onBack={() => onKey('취소')}
        footer={footer ?? tabFrame.footer}
        slides={slides}
        footerPresses={entryFooterPressesOf(isAceLocked, onKey)}
      />

      {isAceLocked && <MessageBox text={ACE_ENTRY_LOCKED_TEXT} buttons={['OK']} onAnswer={onCloseAceLocked} />}
      {overlay}
    </RawScreen>
  )
}

/** 탭 [ed+0x33f] 대로 명단 · 열 표 — 투수 탭이면 투수 명단과 투수 표 */
function entryTabOf<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace>(
  editor: EntryEditorState,
  lists: EntryLists<B, P>,
  tables: EntryColumnTables,
) {
  const isPitcherTab = editor.tab === ENTRY_TAB.투수
  return isPitcherTab
    ? { isPitcherTab, rows: lists.pitchers as readonly (B | P)[], table: tables.pitcher }
    : { isPitcherTab, rows: lists.batters as readonly (B | P)[], table: tables.batter }
}
