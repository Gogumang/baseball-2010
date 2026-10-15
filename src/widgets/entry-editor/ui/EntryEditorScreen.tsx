import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { ACE_ENTRY_LOCKED_TEXT, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type {
  EntryBatterRow, EntryEditorState, EntryKey, EntryLists, EntryPitcherRow,
} from '@/entities/season-mode/model/entryEditor'
import { ENTRY_TABLES_BASIC, entrySlideOffsetOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryBatterLine, EntryColumnTables, EntryPitcherLine } from '@/widgets/entry-editor/lib/entryListWindow'
import { EntryListWindow } from '@/widgets/entry-editor/ui/EntryListWindow'
import * as styles from '@/widgets/entry-editor/ui/EntryEditorScreen.css'

/** 편집기 한 줄이 화면에 보여 줄 것 */
export interface EntryFace {
  readonly name: string
  /** 능력치 네 칸 — '0' 상세 창에 적는다 (없으면 빈 배열) */
  readonly ability: readonly number[]
  /** 레코드 `+0xb & 3` — 타자 이름 칸 세로 줄 색 · 투수 보직 딱지 (없으면 비운다) */
  readonly profileLow?: number
  /** 타자 레코드 +0x20~+0x2e — 기록 열 (없으면 비운다) */
  readonly batterLine?: EntryBatterLine
  /** 투수 레코드 +0x20~+0x2f */
  readonly pitcherLine?: EntryPitcherLine
  /** 투수 체력 줄 재료 — 용량 0x66e44(팀, rec, 0) · 퍼센트 */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
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
  /**
   * 머리띠 바닥 — 안 주면 탭대로 0xf / 0x17. 시즌 0xdf 목적 3(선수영입 자리 고르기)은 그리기 0xb010 이 탭과 상관없이 7
   * (되돌아가기 + "0상세정보") 을 넘긴다.
   */
  readonly footer?: number
  /**
   * 머리띠가 미끄러져 들어오는가 (`ScreenFrame` 의 `slides`). 안 주면 미끄러진다 — 나리 143 엔트리 보기(그림 0x16738)는 [skin+0x84] 를
   * 세우는 0x63b14 를 안 불러 false 를 넘긴다
   */
  readonly slides?: boolean
  /**
   * 열 표 — 안 주면 기본 표(타순 · 이름 | 수비 · 타율 · 홈런 / 등판순서 · 이름 | 보직 · 방어 · 삼진). 시즌 선수 고르기 0xdf 와 스페셜
   * 에디트는 넓은 표(`ENTRY_TABLES_WIDE`)다
   */
  readonly tables?: EntryColumnTables
  /** [ed+0x333] — 이름 칸 덧그림 0x571d8 (안 주면 켠다 — 일반 0x2648c · 시즌 진입들이 1 로 세운다) */
  readonly showsNameBars?: boolean
  /** [ed+0x438] — 커서가 이름 칸만 (스페셜 에디트 0x2b424) */
  readonly isCursorNameOnly?: boolean
  /**
   * 그림 한 틀 — 열 밀기([ed+0x331])가 서 있거나 `ticksEveryFrame` 이면 틀마다 부른다. 부르는 쪽이 `advanceEntrySlide` ·
   * `tickEntryEditor` 로 편집기를 고친다
   */
  readonly onFrame?: () => void
  /** 틀마다 0x55864 를 부르는 쪽(메인 메뉴 0x32634 → 0x2a370 · 0x2b2e0)인가 — 키 셈 [ed+0x40c] 이 틀마다 오른다 */
  readonly ticksEveryFrame?: boolean
}

/** 머리띠 0x54d95 셋째 인자 — 투수 탭 0xf · 타자 탭 0x17 (일반 0x2e09e~0x2e0aa · 시즌 0xe0 그림 0xb08c~0xb098) */
const ENTRY_FOOTER = { 투수: 0xf, 타자: 0x17 } as const

const BATTER_ABILITY_LABELS = ['히트', '파워', '수비', '주루'] as const
const PITCHER_ABILITY_LABELS = ['제구', '구속', '변화', '체력'] as const
/** '0' 상세 창 근사 자리 — 판 (15, 55, 210, 220) 아래쪽 */
const DETAIL_BOX = { x: 35, y: 205, width: 170, height: 60 } as const

/**
 * **엔트리 편집 화면** — 시즌 0xe0(그림 `0xb074`) · 0xdf(`0xb010`) · 일반모드 상태 23(그림 `0x2e070`) · 스페셜 에디트 29(`0x2e1e0`):
 * 엔트리 목록 창 `0x5cfec`(`EntryListWindow` — 칸 배치 · 수비/보직 딱지 · 기록 열 · 커서 · 열 밀기 모두 원본에서 떴다)
 * + 머리띠 `0x54d95(skin, 탭 1 ? 7 "투수엔트리"/바닥 0xf : 6 "타자엔트리"/바닥 0x17)`.
 * 키는 `entities/season-mode/model/entryEditor.pressEntryKey`(0x55864)가 다 들고, 이 화면은 그리고 키만 넘긴다.
 * 원본 창에는 팀 이름 · 하위 탭 글이 없다 — 하위 탭(타순 · 수비위치)은 커서 꼴(이름+딱지 칸 / 딱지 칸만)로만 보인다.
 *
 * ⚠️ 근사·미해결: '0' 상세 창 그림 0x5b798 은 아직 엔트리 창에 옮기지 않아 능력치 글로 적는다.
 */
export function EntryEditorScreen<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace>({
  editor, lists, teamName, isAceLocked, gamePoint = 0, title, overlay, underlay, footer, slides, onKey, onMoveCursor, onCloseAceLocked,
  tables = ENTRY_TABLES_BASIC, showsNameBars = true, isCursorNameOnly = false, onFrame, ticksEveryFrame = false,
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

  // 그림 한 틀 — 열 밀기 한 단계(0x5c984) · 메인 메뉴의 틀마다 키 셈
  const isSliding = editor.slide !== null
  const frameRef = useRef(onFrame)
  frameRef.current = onFrame
  const hasFrame = onFrame !== undefined
  useEffect(() => {
    if (!hasFrame || (!isSliding && !ticksEveryFrame)) return undefined
    const timer = window.setInterval(() => frameRef.current?.(), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [hasFrame, isSliding, ticksEveryFrame])

  const isPitcherTab = editor.tab === ENTRY_TAB.투수
  const table = isPitcherTab ? tables.pitcher : tables.batter
  const rows = isPitcherTab ? lists.pitchers : lists.batters
  const cursorRow = rows[editor.cursor]
  const abilityLabels = isPitcherTab ? PITCHER_ABILITY_LABELS : BATTER_ABILITY_LABELS

  return (
    <RawScreen>
      {underlay}
      <div aria-label={teamName}>
        <EntryListWindow
          rows={rows}
          table={table}
          cursor={editor.cursor}
          top={editor.top}
          firstColumn={editor.firstColumn}
          slideOffset={entrySlideOffsetOf(editor.slide, editor.firstColumn, table.scroll.length)}
          keyPresses={editor.keyPresses}
          subTab={editor.subTab}
          picked={editor.first}
          showsNameBars={showsNameBars}
          isCursorNameOnly={isCursorNameOnly}
          // 웹 전용: 처음 누르면 커서만 옮기고, 커서 줄을 다시 누르면 확인 — 원본은 위·아래 키뿐이다
          onPressRow={isAceLocked ? undefined : (index) => {
            if (index === editor.cursor) onKey('확인')
            else onMoveCursor(index)
          }}
          onPressArrow={isAceLocked ? undefined : onKey}
        />
      </div>

      {editor.isDetailOpen && cursorRow !== undefined && (
        <div className={styles.detail} data-testid="엔트리-상세"
          style={{ left: DETAIL_BOX.x, top: DETAIL_BOX.y, width: DETAIL_BOX.width, height: DETAIL_BOX.height }}>
          {[cursorRow.name, ...cursorRow.ability.map((value, i) => `${abilityLabels[i] ?? ''} ${value}`)].join('\n')}
        </div>
      )}

      {/* 바닥 — 투수 탭 0xf "#타자"+"0상세정보"+되돌아가기 · 타자 탭 0x17 "#투수"+… (일반 0x2e0a2 · 시즌 0xb090).
          표시는 "#" 지만 탭을 바꾸는 키는 편집기 0x55864 의 '*'(0x2a, 0x558c4)다 — '#'(0x23)는 아무 일도 안 한다. 원본 그대로 둔다. */}
      <ScreenFrame title={title ?? (isPitcherTab ? '투수엔트리' : '타자엔트리')} gamePoint={gamePoint}
        onBack={() => onKey('취소')} footer={footer ?? (isPitcherTab ? ENTRY_FOOTER.투수 : ENTRY_FOOTER.타자)} slides={slides}
        // 바닥띠 "#타자" · "#투수" 표시 = 탭 바꾸기 '*'(0x558c4) · "0상세정보" = '0' — 그 표시 위 투명 누름 칸. 마선수 잠금 창이 떠 있으면 키를 안 받는다
        footerPresses={isAceLocked ? undefined : {
          [FOOTER_BITS.batter]: { label: '* 타자', onPress: () => onKey('별') },
          [FOOTER_BITS.pitcher]: { label: '* 투수', onPress: () => onKey('별') },
          [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => onKey('영') },
        }} />

      {isAceLocked && (
        <MessageBox text={ACE_ENTRY_LOCKED_TEXT} buttons={['OK']} onAnswer={onCloseAceLocked} />
      )}
      {overlay}
    </RawScreen>
  )
}
