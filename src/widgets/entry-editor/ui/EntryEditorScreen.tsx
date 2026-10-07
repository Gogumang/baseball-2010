import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import {
  ACE_ENTRY_LOCKED_TEXT, ENTRY_SUB_TAB, ENTRY_TAB, NO_ENTRY_PICK, fieldPositionLabelOf,
} from '@/entities/season-mode/model/entryEditor'
import type {
  EntryBatterRow, EntryEditorState, EntryKey, EntryLists, EntryPitcherRow,
} from '@/entities/season-mode/model/entryEditor'
import * as styles from '@/widgets/entry-editor/ui/EntryEditorScreen.css'

/** 편집기 한 줄이 화면에 보여 줄 것 */
export interface EntryFace {
  readonly name: string
  /** 능력치 네 칸 — '0' 상세 창에 적는다 (없으면 빈 배열) */
  readonly ability: readonly number[]
}

export interface EntryEditorScreenProps<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace> {
  readonly editor: EntryEditorState
  readonly lists: EntryLists<B, P>
  /** 머리띠 아래 한 줄 — 어느 팀 엔트리인가 */
  readonly teamName: string
  /** 마선수 잠금 팝업(StrTEXT 0xd200c)이 떠 있는가 */
  readonly isAceLocked: boolean
  readonly gamePoint?: number
  /**
   * 머리띠 제목 — 안 주면 탭대로 "투수엔트리"/"타자엔트리"(0x54d95(skin, 탭 1 ? 7 : 6, …)).
   * 스페셜 에디트(상태 29 그리기 0x2e1e0)는 탭과 상관없이 제목 1 "팀선택" 이다.
   */
  readonly title?: ScreenFrameTitle
  /** 화면 맨 위에 얹는 창 — 스페셜 에디트의 이름 입력 창(하위 2)이 엔트리 창 위에 뜬다 */
  readonly overlay?: ReactNode
  readonly onKey: (key: EntryKey) => void
  /** 웹 전용 — 줄을 눌러 커서를 옮긴다 */
  readonly onMoveCursor: (index: number) => void
  readonly onCloseAceLocked: () => void
  /**
   * 화면 맨 밑에 먼저 깔 것 — 시즌 장면 0x105 는 상태별 그리기 앞에 늘 공통 앞그림 0xb810 을 부르고, 0xdf 선수 고르기는 0xdd · 0xe0 · 0xe1 밖이라
   * 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 깐다(0xe9ac 0xefaa). 이 화면을 쓰는 다른 모드는 넘기지 않는다.
   */
  readonly underlay?: ReactNode
}

/** 판 (15, 55, 210, 220) — P6 2f 의 0x5c984 공용 판 (유력) */
const PANEL = { x: 15, y: 55, width: 210, height: 220 } as const
/** `0x55798(ed, 3, 10)` — 한 번에 보이는 줄 10 */
const VISIBLE_ROWS = 10
const ROW = { x: 22, firstY: 92, height: 17, width: 196 } as const

/** 머리띠 0x54d95 셋째 인자 — 투수 탭 0xf · 타자 탭 0x17 (일반 0x2e09e~0x2e0aa · 시즌 0xe0 그림 0xb08c~0xb098) */
const ENTRY_FOOTER = { 투수: 0xf, 타자: 0x17 } as const

const BATTER_ABILITY_LABELS = ['히트', '파워', '수비', '주루'] as const
const PITCHER_ABILITY_LABELS = ['제구', '구속', '변화', '체력'] as const

/**
 * **엔트리 편집 화면** — 시즌 0xe0(그림 `0xb074`) · 일반모드 상태 23(그림 `0x2e070`):
 * 엔트리 목록 창 `0x5cfec` + 머리띠 `0x54d95(skin, 탭 1 ? 7 "투수엔트리"/바닥 0xf : 6 "타자엔트리"/바닥 0x17)`.
 * 키는 `entities/season-mode/model/entryEditor.pressEntryKey`(0x55864)가 다 들고, 이 화면은 그리고 키만 넘긴다.
 *
 * ⚠️ 근사·미해결: 목록 창 안 칸 배치(0x5698d·0x573e9… 가로로 넘기는 열, P6 2f)와 수비 위치 아이콘(0x54591),
 *    투수 보직 아이콘(0x545e9), '0' 상세 창 그림이 미해독이다. 판 자리와 보이는 줄 수(10)만 원본에서 왔고,
 *    줄에는 이름·수비 위치 글자만 적는다. 화면 밀기(0xbdae9, 1000) 연출도 없다.
 */
export function EntryEditorScreen<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace>({
  editor, lists, teamName, isAceLocked, gamePoint = 0, title, overlay, underlay, onKey, onMoveCursor, onCloseAceLocked,
}: EntryEditorScreenProps<B, P>) {
  useEffect(() => {
    if (isAceLocked) return undefined
    const keyOf = (key: string): EntryKey | null => {
      switch (key) {
        case 'ArrowUp': case '2': return '위'
        case 'ArrowDown': case '8': return '아래'
        case 'ArrowLeft': case '4': return '왼'
        case 'ArrowRight': case '6': return '오른'
        case 'Enter': case '5': return '확인'
        case 'Escape': return '취소'
        case '*': return '별'
        case '0': return '영'
        default: return null
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const key = keyOf(event.key)
      if (key === null) return
      event.preventDefault()
      onKey(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAceLocked, onKey])

  const isPitcherTab = editor.tab === ENTRY_TAB.투수
  const rows: readonly (EntryFace & { readonly isAce: boolean; readonly value: string })[] = isPitcherTab
    ? lists.pitchers.map((row) => ({ ...row, value: '' }))
    : lists.batters.map((row) => ({ ...row, value: fieldPositionLabelOf(row.position) }))
  const first = rows.length <= VISIBLE_ROWS
    ? 0
    : Math.min(Math.max(0, editor.cursor - VISIBLE_ROWS + 1), rows.length - VISIBLE_ROWS)
  const visible = rows.slice(first, first + VISIBLE_ROWS)
  const cursorRow = rows[editor.cursor]
  const abilityLabels = isPitcherTab ? PITCHER_ABILITY_LABELS : BATTER_ABILITY_LABELS

  const subTabLine = isPitcherTab
    ? null
    : editor.subTab === ENTRY_SUB_TAB.보기전용
      ? '보기 전용'
      : null

  return (
    <RawScreen>
      {underlay}
      <div className={styles.panel}
        style={{ left: PANEL.x, top: PANEL.y, width: PANEL.width, height: PANEL.height }} />
      <div className={styles.tabLine} style={{ left: PANEL.x, top: PANEL.y + 4, width: PANEL.width }}>
        {teamName}
      </div>
      {/* 타자 탭의 하위 탭 `+0x330` — 0 타순 · 1 수비위치 (좌·우로 옮긴다) */}
      {!isPitcherTab && (
        <div className={styles.tabLine} style={{ left: PANEL.x, top: PANEL.y + 19, width: PANEL.width }}
          data-testid="엔트리-하위탭">
          {subTabLine ?? (
            <>
              <span className={editor.subTab === ENTRY_SUB_TAB.타순 ? styles.tabActive : undefined}>타순</span>
              {' / '}
              <span className={editor.subTab === ENTRY_SUB_TAB.수비위치 ? styles.tabActive : undefined}>수비위치</span>
            </>
          )}
        </div>
      )}

      {visible.map((row, offset) => {
        const index = first + offset
        const classes = [
          styles.row,
          index === editor.cursor ? styles.rowCursor : '',
          index === editor.first && editor.first !== NO_ENTRY_PICK ? styles.rowPicked : '',
          row.isAce ? styles.rowAce : '',
        ].filter(Boolean).join(' ')
        return (
          <button key={`${index}-${row.name}`} type="button" className={classes}
            data-testid={`엔트리-줄-${index}`}
            aria-current={index === editor.cursor}
            style={{ left: ROW.x, top: ROW.firstY + offset * ROW.height, width: ROW.width, height: ROW.height }}
            onClick={() => {
              // 웹 전용: 처음 누르면 커서만 옮기고, 커서 줄을 다시 누르면 확인 — 원본은 위·아래 키뿐이다
              if (index === editor.cursor) onKey('확인')
              else onMoveCursor(index)
            }}>
            <span className={styles.rowNumber}>{index + 1}</span>
            <span className={styles.rowName}>{row.name}</span>
            <span className={styles.rowValue}>{row.value}</span>
          </button>
        )
      })}

      {editor.isDetailOpen && cursorRow !== undefined && (
        <div className={styles.detail} data-testid="엔트리-상세"
          style={{ left: PANEL.x + 20, top: PANEL.y + PANEL.height - 70, width: PANEL.width - 40, height: 60 }}>
          {[cursorRow.name, ...cursorRow.ability.map((value, i) => `${abilityLabels[i] ?? ''} ${value}`)].join('\n')}
        </div>
      )}

      {/* 바닥 — 투수 탭 0xf "#타자"+"0상세정보"+되돌아가기 · 타자 탭 0x17 "#투수"+… (일반 0x2e0a2 · 시즌 0xb090).
          표시는 "#" 지만 탭을 바꾸는 키는 편집기 0x55864 의 '*'(0x2a, 0x558c4)다 — '#'(0x23)는 아무 일도 안 한다. 원본 그대로 둔다. */}
      <ScreenFrame title={title ?? (isPitcherTab ? '투수엔트리' : '타자엔트리')} gamePoint={gamePoint}
        onBack={() => onKey('취소')} footer={isPitcherTab ? ENTRY_FOOTER.투수 : ENTRY_FOOTER.타자} />

      {isAceLocked && (
        <MessageBox text={ACE_ENTRY_LOCKED_TEXT} buttons={['OK']} onAnswer={onCloseAceLocked} />
      )}
      {overlay}
    </RawScreen>
  )
}
