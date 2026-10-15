import { useCallback, useState } from 'react'
import { seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { MessageBox } from '@/shared/ui'
import { SEASON_SHOP_TEXT, seasonShopTextOf } from '@/entities/season-mode/model/seasonItemShop'
import { ENTRY_TAB, openEntryEditor, pointEntryCursor, pressEntryKey } from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import { SEASON_ENTRY_CELL_SOURCE, seasonRecordEntryListsOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'

export interface SeasonStaminaPickScreenProps {
  /** 내 팀 (SR[1]) — 목록은 `0x1f9a9(app, [this+0x15c], 내 팀)` 팀 레코드 */
  readonly teamId: number
  /** 내 팀 명단 **레코드 차례** (투수는 로테이션으로 섞인 차례 — 세션 `tradeRoster`) */
  readonly roster: SeasonTeamRoster
  /** 표 밖 명전 선수의 기록 이름 (세션 `recordSource`) — 없으면 `playerFaceOf` */
  readonly nameOf?: (player: SeasonPlayer, isPitcher: boolean, index: number) => string | undefined
  /** 엔트리 목록 창 칸 재료 (세션 `entryCellSourceOf`) */
  readonly cells?: SeasonEntryCellSource
  /** 공통 틀 0x9f60 의 상태판 · 가운데 판 재료 */
  readonly state: SeasonState
  readonly gamePoint: number
  /** 키 0x7c00 확인 — 레코드 칸(목록 커서) · 글과 회복했는가(결과 0x1d) */
  readonly onPick: (recordIndex: number) => { readonly notice: string; readonly recovered: boolean }
  /** 0x7c00 취소(−16) → 0xdc · 결과 0x1d(0x6f8c) → 0xdc */
  readonly onBack: () => void
}

/** 0x7c00 의 커맨드 줄 — 0xe8 은 0x7e84c 를 안 불러(장면 틀 e9d8~e9e8) 앞 상태 0xdc 가 비운 칸 수 0 그대로다 */
const NO_SLOTS: readonly never[] = []
/** 그리기 0xafd0 의 머리띠 바닥 — 0x54d95(skin, 7, **7**, 0): 되돌아가기 + "0상세정보" */
const STAMINA_PICK_FOOTER = 7

/**
 * **십전대보탕 투수 고르기 — 상태 0xe8** (들어옴 0x5870 · 갱신 0x7c00 · 키 0x6f8c · 그림 0xafd0). GP 상점 칸 3 의 "예" 로 온다.
 *
 * ```
 * 0x5870  0x5561c(ed, &내 팀 레코드, 0, 0, 1) — 보기 전용 · 투수 탭 · 0x55798(ed, 3, 10) · 기본 표 0xcbd74 … ·
 *         ed+0x333 = 1 · +0x334 = 2 · StrMODE[177] 1버튼 팝업
 * 0x7c00  확인(−5 · '5'): 커서 칸 +0x2c == 10000 → StrMODE[211] (결과 1)
 *                         아니면 G −= 0xcbbe3[3] × 100 (0..99999) · 0x22c29(3, 값) · 0x22e35(2, 3) ·
 *                         +0x2c = 10000 · 저장 · StrMODE[178] (결과 0x1d)
 *         취소(−16) → 0xdc
 * 0x6f8c  팝업이 떠 있으면 결과 0x1d(· 0x14) → 0xdc, 아니면 '*'(0x2a) 를 빼고 0x55865(ed, 키) — 위·아래 · '0' 상세
 * 0xafd0  공통 틀 0x9f60(커맨드 줄 · 상태판 · 가운데 판 · 머리띠 0x7f4ec) → 엔트리 목록 창 0x5cfed → 0x54d95(skin, 7, 7, 0)
 * ```
 * 커맨드 줄의 부모 칸 [gfx+0x15c] 은 0xe8 진입 0x5870 · 앞 상태 0xdc(0x5f3c)가 쓰지 않아 아이템 하위 메뉴 0xd0 진입 0x4d04 가
 * 남긴 [this+0x88](4d28~4d3a `str [gfx+0x15c]`)이고 칸 수 [gfx+0x180] 은 0xdc 의 0x7e84c 가 남긴 0 이다 — 0x7e418(7e450~7e45a)이
 * 부모 칸 '아이템'만 그린다(0xdc 화면과 같다, r99).
 */
export function SeasonStaminaPickScreen({
  teamId, roster, nameOf, cells = SEASON_ENTRY_CELL_SOURCE, state, gamePoint, onPick, onBack,
}: SeasonStaminaPickScreenProps) {
  const [notice, setNotice] = useState<{ readonly text: string; readonly leave: boolean } | null>(
    { text: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나선택), leave: false },
  )
  const [editor, setEditor] = useState<EntryEditorState>(() => ({ ...openEntryEditor(false), tab: ENTRY_TAB.투수 }))
  const lists = seasonRecordEntryListsOf(teamId, roster, cells, nameOf)

  const onKey = useCallback((key: EntryKey) => {
    if (notice !== null) return
    // 0x7c00 — 확인 · 취소는 갱신이 먼저 본다
    if (key === '확인') {
      if (editor.cursor >= lists.pitchers.length) return
      const result = onPick(editor.cursor)
      if (result.notice !== '') setNotice({ text: result.notice, leave: result.recovered })
      return
    }
    if (key === '취소') return onBack()
    // 0x6f8c — '*' 는 편집기에 안 간다
    if (key === '별') return
    setEditor((current) => pressEntryKey(current, lists, key).state)
  }, [editor.cursor, lists, notice, onBack, onPick])

  return (
    <EntryEditorScreen
      editor={editor}
      lists={lists}
      teamName=""
      isAceLocked={false}
      gamePoint={gamePoint}
      title="투수엔트리"
      footer={STAMINA_PICK_FOOTER}
      slides={false}
      underlay={(
        <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={null}
          commandBar={{ slots: NO_SLOTS, cursor: 0, parent: seasonParentSlotOf('아이템') }} showsHeader={false} />
      )}
      overlay={notice !== null && (
        <MessageBox text={notice.text} buttons={['OK']} onAnswer={() => {
          setNotice(null)
          if (notice.leave) onBack()
        }} />
      )}
      onKey={onKey}
      onMoveCursor={(index) => setEditor((current) => pointEntryCursor(current, lists, index))}
      onCloseAceLocked={() => undefined}
    />
  )
}
