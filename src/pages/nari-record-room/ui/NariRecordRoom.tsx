import { useEffect, useRef, useState } from 'react'
import { MarkupText, RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  SEASON_RANKING_SIZE, moveRankingPage, rankingCategoriesOf, seasonRankingValueTextOf,
} from '@/entities/season-mode/model/seasonRecordRanking'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  OPEN_YEAR_RECORD_VIEW, RECORD_ROOM_PICK, RECORD_ROOM_PICK_LABEL_FRAMES, RECORD_ROOM_PICK_LABELS, RECORD_ROOM_PICK_TITLE_ID,
  VISIBLE_YEAR_COLUMNS, YEAR_NUMBER_HEADER_FRAME, YEAR_TABLE_LAYOUT, advanceYearSlide, batterYearCellNumberOf, batterYearCellTextOf,
  batterYearRowsOf, nariRankingEntriesOf, nariRankingSideOf, pitcherYearCellNumberOf, pitcherYearCellTextOf, pitcherYearRowsOf,
  pressYearRecordKey, visibleYearRowCountOf, yearArrowBlinkOf, yearCellDrawingOf, yearColumnsOf, yearCursorIsInsetOf,
  yearLabelOffsetOf, yearNumberGlyphsOf, yearSlideOffsetOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom'
import type {
  NariRecordEdition, RecordRoomPick, YearCellNumber, YearRecordKey, YearRecordView,
} from '@/pages/nari-record-room/lib/nariRecordRoom'

const IMG_TEXT = './sprites/img_text/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'
/** 내 팀 줄 글색 (0xff, 0xd4, 0x29) — 0x57c70 */
const MY_TEAM_COLOR = '#ffd429'
/** 팀 이름 img_text = 0x41 + 팀 (0x57e76) */
const TEAM_NAME_FRAME_BASE = 0x41
/** 순위표 머리 글 img_text — 136 "순위" · 27 "이름" · 235 "팀명" (0x57a76 · 0x57ab2 · 0x57aec) */
const RANK_HEADER_FRAMES = [136, 27, 235] as const

export type NariRecordViewProps = {
  /** [장면+0x164] — 팝업 0x80 에서 고른 칸 */
  readonly pick: RecordRoomPick
  readonly gamePoint: number
  /** 124 취소 → 106 (0x1463c) */
  readonly onBack: () => void
} & (
  | { readonly edition: '타자'; readonly career: PlayerCareer }
  | { readonly edition: '투수'; readonly career: PitcherCareer }
)

/**
 * **상태 124** — 그림 0x16778: +0x164 ≠ 0 이면 0x5796c(순위기록), 아니면 0x5cfec(개인기록) · 머리띠 0x7f4ed.
 * 화면을 덮는다. 키는 잡는 단계에서 다 가져간다(관리 메뉴가 같은 키를 받지 않게).
 * ⚠️ 머리띠 0x7f4ed 는 124 진입이 바닥비트를 새로 세우지 않아 앞 상태 것을 그린다 — 웹은 편 제목 · 되돌아가기(기본 5)로 둔다.
 */
export function NariRecordView(props: NariRecordViewProps) {
  const title = props.edition === '타자' ? '나만의리그타자편' : '나만의리그투수편'
  if (props.pick === RECORD_ROOM_PICK.순위기록) {
    return <NariRankingScreen edition={props.edition} career={props.career} title={title} gamePoint={props.gamePoint} onBack={props.onBack} />
  }
  return props.edition === '타자'
    ? <YearRecordScreen edition="타자" title={title} gamePoint={props.gamePoint} onBack={props.onBack}
      rows={batterYearRowsOf(props.career).map((stats) => ({
        textOf: (bit: number) => batterYearCellTextOf(stats, bit), numberOf: (bit: number) => batterYearCellNumberOf(stats, bit),
      }))} />
    : <YearRecordScreen edition="투수" title={title} gamePoint={props.gamePoint} onBack={props.onBack}
      rows={pitcherYearRowsOf(props.career).map((stats) => ({
        textOf: (bit: number) => pitcherYearCellTextOf(stats, bit), numberOf: (bit: number) => pitcherYearCellNumberOf(stats, bit),
      }))} />
}

export interface NariRecordPickPopupProps {
  /** 확인(−5 · '5') → [장면+0x164] = (+0x166 ? 1 : 0) · 124 */
  readonly onChoose: (pick: RecordRoomPick) => void
  /** 취소 → 팝업만 닫는다(106 그대로) */
  readonly onCancel: () => void
}

/**
 * 팝업 0x80 그림 0x19448 · 키 0x196ec — 시즌 0xf334 · 0xf5d4 와 같은 꼴에 글만 106 "개인기록" · 360 "순위기록".
 * ⚠️ 근사: 칸 그림 0x858fd(6 / 10) 의 그림 묶음은 안 풀었다 — 시즌 창(`SeasonRecordPickPopup`)처럼 칸 테두리만 그린다.
 */
export function NariRecordPickPopup({ onChoose, onCancel }: NariRecordPickPopupProps) {
  /** [장면+0x166] — 팝업을 열 때 0 (130d4~130dc) */
  const [pick, setPick] = useState<RecordRoomPick>(RECORD_ROOM_PICK.개인기록)
  const onToggle = () => setPick((held) => (held === RECORD_ROOM_PICK.개인기록 ? RECORD_ROOM_PICK.순위기록 : RECORD_ROOM_PICK.개인기록))
  const onConfirm = () => onChoose(pick)
  const latest = useRef({ onToggle, onConfirm, onCancel })
  latest.current = { onToggle, onConfirm, onCancel }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (isCancelKey(event.key)) current.onCancel()
      else if (['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)) current.onToggle()
      else if (event.key === 'Enter' || event.key === '5') current.onConfirm()
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const cells = [
    { value: RECORD_ROOM_PICK.개인기록, x: 120 - 0x38 },
    { value: RECORD_ROOM_PICK.순위기록, x: 120 + 0x18 },
  ]
  return (
    <div role="dialog" aria-label="기록실">
      <div className={windowStyles.window} style={{ left: 120 - 0x54 - 6, top: 160 - 0x28 - 8, width: 0x54 * 2 + 12, height: 100 }} />
      {/* "!C보고 싶은 기록을!N선택해주세요" — 두 줄 가운데 */}
      <div className={styles.title} style={{ left: 120 - 0x54, top: 160 - 0x28, width: 0x54 * 2, whiteSpace: 'normal' }}>
        <MarkupText raw={ORIGINAL_MODE_TEXT[RECORD_ROOM_PICK_TITLE_ID] ?? ''} />
      </div>
      {cells.map((cell) => {
        const isOn = cell.value === pick
        return (
          <button key={cell.value} type="button" aria-pressed={isOn} aria-label={RECORD_ROOM_PICK_LABELS[cell.value]}
            className={windowStyles.layer}
            style={{ left: cell.x, top: 160, width: 32, height: 48, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', pointerEvents: 'auto' }}
            onClick={() => (isOn ? onConfirm() : onToggle())}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 32, height: 32, boxSizing: 'border-box', border: `1px solid ${isOn ? ORIGINAL_COLORS.text : '#b2b2b2'}` }} />
            <img alt="" src={frameSrc(RECORD_ROOM_PICK_LABEL_FRAMES[cell.value])}
              style={{ position: 'absolute', left: 16, top: 36, transform: 'translateX(-50%)', filter: isOn ? undefined : 'brightness(0.7)' }} />
          </button>
        )
      })}
    </div>
  )
}

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const SLT_FRAME = './sprites/slt_frame'
const NUM = './sprites/num'
const imageOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`
/** game_ui 프레임 — 번호 칸 0x1b(25×15) · 넘기는 칸 0x23(36×15) */
const NUMBER_CELL_FRAME = 0x1b
const STAT_CELL_FRAME = 0x23
/** slt_frame 이미지 — ◀ 20(5×8, 뒤집으면 ▶) · ▲ 0x20 · ▼ 0x21 (13×8) */
const SIDE_ARROW_IMAGE = 20
const UP_ARROW_IMAGE = 0x20
const DOWN_ARROW_IMAGE = 0x21
/** 커서 색 — 0x56234 의 0xffff00 · 0x80ffff00(알파 0x80) */
const CURSOR_COLOR = '#ffff00'
const CURSOR_INSET_COLOR = 'rgba(255, 255, 0, 0.502)'
/** 0x6aff8 의 점 — 흰(0x1400748(255, 255, 255)) 점 두 개를 위아래로 */
const DOT_COLOR = '#ffffff'

const pixel = { position: 'absolute', pointerEvents: 'none' } as const

/** 줄 하나 — 칸 글(접근성 · 시험) · 칸 숫자(0x6aff8 입력). null 은 웹이 세지 않는 칸(비운다) */
interface YearRow {
  readonly textOf: (bit: number) => string | null
  readonly numberOf: (bit: number) => YearCellNumber | null
}

interface YearRecordScreenProps {
  readonly edition: NariRecordEdition
  readonly rows: readonly YearRow[]
  readonly title: '나만의리그타자편' | '나만의리그투수편'
  readonly gamePoint: number
  readonly onBack: () => void
}

const YEAR_KEYS: Readonly<Record<string, YearRecordKey>> = {
  ArrowUp: '위', 2: '위', ArrowDown: '아래', 8: '아래', ArrowLeft: '왼', 4: '왼', ArrowRight: '오른', 6: '오른',
  Enter: '기타', 5: '기타', 1: '기타', 3: '기타', 7: '기타', 9: '기타', '#': '기타',
}

/** 머리 글 img_text — 0x5650c 가 (x, 56, 폭, 15) 가운데에 (img_text 크기는 origins.json) */
function YearLabel({ frame, x, width, alt }: { readonly frame: number; readonly x: number; readonly width: number; readonly alt: string }) {
  const origins = useFrameOrigins(IMG_TEXT)
  const size = origins?.[String(frame).padStart(3, '0')]
  const offset = size === undefined ? { x: 0, y: 3 } : yearLabelOffsetOf(width, size.width, size.height)
  return <img alt={alt} src={frameSrc(frame)} style={{ ...pixel, left: x + offset.x, top: YEAR_TABLE_LAYOUT.labelY + offset.y }} />
}

/** 둥글기 1 테두리 0x6aa65 — (w + 1)×(h + 1), 네 모서리 점은 빈다 */
function RoundedBorder({ x, y, width, height, color }: {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string
}) {
  const line = (left: number, top: number, w: number, h: number) => (
    <span style={{ ...pixel, left, top, width: w, height: h, background: color }} />
  )
  return (
    <div data-testid="개인기록-커서">
      {line(x + 1, y, width - 1, 1)}
      {line(x + 1, y + height, width - 1, 1)}
      {line(x, y + 1, 1, height - 1)}
      {line(x + width, y + 1, 1, height - 1)}
    </div>
  )
}

/** 124 첫 갈래 — 0x5cfec → 0x5c984 (고정 "연차" 열 0x5658c + 넘기는 열 0x56ebc 넷). 배치는 `YEAR_TABLE_LAYOUT` 머리말 */
function YearRecordScreen({ edition, rows, title, gamePoint, onBack }: YearRecordScreenProps) {
  const columns = yearColumnsOf(edition)
  const [view, setView] = useState<YearRecordView>(OPEN_YEAR_RECORD_VIEW)
  const latest = useRef({ onBack, rowCount: rows.length })
  latest.current = { onBack, rowCount: rows.length }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 0x1463c: 취소 → 106 · '0' · '*' 는 버린다 · 그 밖은 0x55864 로 간다(보기 전용이라 확인은 [+0x40c] 만 센다)
      if (isCancelKey(event.key)) latest.current.onBack()
      else {
        const key = YEAR_KEYS[event.key]
        if (key !== undefined) setView((held) => pressYearRecordKey(held, key, latest.current.rowCount))
        else if (!['0', '*'].includes(event.key)) return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // 밀기 한 단계 = 그림 한 번 (5cd84 · 5cefa)
  const isSliding = view.slide !== null
  useEffect(() => {
    if (!isSliding) return undefined
    const timer = window.setInterval(() => setView((held) => advanceYearSlide(held, columns.length)), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [isSliding, columns.length])

  const layout = YEAR_TABLE_LAYOUT
  const offset = yearSlideOffsetOf(view, columns.length)
  const visibleCount = visibleYearRowCountOf(rows.length)
  const visibleRows = rows.slice(view.top, view.top + visibleCount)
  const rowY = (offsetRow: number) => layout.firstRowY + offsetRow * layout.rowStep
  const blink = yearArrowBlinkOf(view)
  // 0x5cdae: 첫 열 − 1 부터 첫 열 + 보이는 열 까지 그리고 자르기 밖은 잘린다
  const drawn = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index }) => index >= view.firstColumn - 1 && index <= view.firstColumn + VISIBLE_YEAR_COLUMNS)
  const cursorRow = view.cursor - view.top
  const isInset = yearCursorIsInsetOf(view)

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`개인기록 ${edition}`}>
        <div className={windowStyles.window} style={{ left: layout.panel.x, top: layout.panel.y, width: layout.panel.width, height: layout.panel.height }} />
        {rows.length > 1 && (
          <>
            <img alt="위" src={imageOf(SLT_FRAME, UP_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.upArrowY - blink }} />
            <img alt="아래" src={imageOf(SLT_FRAME, DOWN_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.downArrowY + blink }} />
          </>
        )}
        <YearLabel frame={YEAR_NUMBER_HEADER_FRAME} x={layout.numberX} width={layout.numberWidth} alt="연차" />
        {visibleRows.map((_row, offsetRow) => (
          <div key={view.top + offsetRow} aria-label={String(view.top + offsetRow + 1)}>
            <img alt="" src={imageOf(GAME_UI_FRAMES, NUMBER_CELL_FRAME)} style={{ ...pixel, left: layout.numberX, top: rowY(offsetRow) }} />
            {yearNumberGlyphsOf(view.top + offsetRow + 1).map((glyph, index) => (
              <img key={index} alt="" src={imageOf(NUM, glyph.frame)}
                style={{ ...pixel, left: layout.numberX + glyph.x, top: rowY(offsetRow) + 3 }} />
            ))}
          </div>
        ))}
        {view.firstColumn !== 0 && (
          <img alt="앞 열" src={imageOf(SLT_FRAME, SIDE_ARROW_IMAGE)}
            style={{ ...pixel, left: layout.statX - blink - 5, top: layout.sideArrowY }} />
        )}
        {view.firstColumn + VISIBLE_YEAR_COLUMNS !== columns.length && (
          <img alt="다음 열" src={imageOf(SLT_FRAME, SIDE_ARROW_IMAGE)}
            style={{ ...pixel, left: layout.statX + layout.clip.width + blink - 5, top: layout.sideArrowY, transform: 'scaleX(-1)' }} />
        )}
        <div style={{ ...pixel, left: layout.clip.x, top: layout.clip.y, width: layout.clip.width, height: layout.clip.height, overflow: 'hidden' }}>
          {drawn.map(({ column, index }) => {
            const left = layout.statX - layout.clip.x + (index - view.firstColumn) * layout.columnStep + offset
            return (
              <div key={column.bit} data-testid={`개인기록-열-${column.label}`} style={{ ...pixel, left, top: -layout.clip.y }}>
                <YearLabel frame={column.labelFrame} x={0} width={layout.statWidth} alt={column.label} />
                {visibleRows.map((row, offsetRow) => {
                  const number = row.numberOf(column.bit)
                  const drawing = number === null ? null : yearCellDrawingOf(number)
                  const top = rowY(offsetRow)
                  return (
                    <div key={view.top + offsetRow} data-testid={`개인기록-칸-${view.top + offsetRow}-${column.label}`}
                      aria-label={row.textOf(column.bit) ?? ''}>
                      <img alt="" src={imageOf(GAME_UI_FRAMES, STAT_CELL_FRAME)} style={{ ...pixel, left: 0, top }} />
                      {drawing?.glyphs.map((glyph, glyphIndex) => (
                        <img key={glyphIndex} alt="" src={imageOf(NUM, glyph.frame)} style={{ ...pixel, left: glyph.x, top: top + 3 }} />
                      ))}
                      {drawing?.dots.map((dot, dotIndex) => (
                        <span key={dotIndex} style={{ ...pixel, left: dot.x, top: top + dot.y, width: 1, height: 2, background: DOT_COLOR }} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        {cursorRow >= 0 && cursorRow < visibleCount && (isInset
          ? <RoundedBorder x={layout.numberX + 1} y={rowY(cursorRow) + 1} width={layout.cursorWidth - 2} height={layout.cellHeight - 2}
            color={CURSOR_INSET_COLOR} />
          : <RoundedBorder x={layout.numberX} y={rowY(cursorRow)} width={layout.cursorWidth} height={layout.cellHeight}
            color={CURSOR_COLOR} />)}
      </div>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} />
    </RawScreen>
  )
}

interface NariRankingScreenProps {
  readonly edition: NariRecordEdition
  readonly career: PlayerCareer | PitcherCareer
  readonly title: '나만의리그타자편' | '나만의리그투수편'
  readonly gamePoint: number
  readonly onBack: () => void
}

/** ⚠️ 근사 배치 — 시즌 0xdb(`SeasonRecordRankScreen`)와 같은 0x5796c 판. 시작 x · 칸 사이 3 · 줄 사이 4 만 확정 */
const RANK_TABLE = { x: 20, headerY: 60, firstRowY: 84, rowStep: 18, columns: [24, 76, 64, 36] } as const

/**
 * 124 둘째 갈래 — 0x5796c(나리 판 목록) · 키 0x5787d(좌·우로 쪽 [편집기+0x444], 끝에서 멈춘다 · 쪽이 바뀌면 다시 뽑는다).
 * 그림은 시즌 기록순위 0xdb 와 같은 함수다: 머리 줄 순위 · 이름 · 팀명 · 쪽의 종류 글(옮길 수 있으면 좌우 화살),
 * 줄 i 는 순위 i + 1 · 이름 · 팀 img_text 0x41 + 팀 · 값, 그 줄 팀이 내 팀([편집기+0x448] = S[1])이면 노란 글.
 */
function NariRankingScreen({ edition, career, title, gamePoint, onBack }: NariRankingScreenProps) {
  const side = nariRankingSideOf(edition)
  const [page, setPage] = useState(0)
  const latest = useRef({ onBack })
  latest.current = { onBack }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isCancelKey(event.key)) latest.current.onBack()
      else if (event.key === 'ArrowRight' || event.key === '6') setPage((held) => moveRankingPage(side, held, 1))
      else if (event.key === 'ArrowLeft' || event.key === '4') setPage((held) => moveRankingPage(side, held, -1))
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [side])

  const categories = rankingCategoriesOf(side)
  const category = categories[page] ?? categories[0]
  const entries = nariRankingEntriesOf(edition, career, page)
  const columnX = RANK_TABLE.columns.map((_width, index) => RANK_TABLE.x + RANK_TABLE.columns.slice(0, index).reduce((sum, width) => sum + width + 3, 0))
  const headerFrames = [...RANK_HEADER_FRAMES, category.labelFrame]

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`순위기록 ${side} ${category.label}`}>
        <div className={windowStyles.window} style={{ left: 14, top: 52, width: 212, height: 216 }} />
        {headerFrames.map((frame, index) => (
          <img key={frame} className={windowStyles.layer} alt="" src={frameSrc(frame)}
            style={{ left: columnX[index] + RANK_TABLE.columns[index] / 2, top: RANK_TABLE.headerY, transform: 'translateX(-50%)' }} />
        ))}
        {page > 0 && <span className={styles.title} style={{ left: columnX[3] - 6, top: RANK_TABLE.headerY - 2, width: 6 }}>◀</span>}
        {page < categories.length - 1 && (
          <span className={styles.title} style={{ left: columnX[3] + RANK_TABLE.columns[3], top: RANK_TABLE.headerY - 2, width: 6 }}>▶</span>
        )}
        {Array.from({ length: SEASON_RANKING_SIZE }, (_unused, row) => {
          const entry = entries[row]
          const rowTop = RANK_TABLE.firstRowY + row * RANK_TABLE.rowStep
          const color = entry !== undefined && entry.record.teamId === career.teamId ? MY_TEAM_COLOR : ORIGINAL_COLORS.text
          return (
            <div key={row} data-testid={`순위기록-줄-${row}`} style={{ color }}>
              {entry !== undefined && (
                <>
                  <span className={styles.title} style={{ left: columnX[0], top: rowTop, width: RANK_TABLE.columns[0], color }}>{row + 1}</span>
                  <span className={styles.title} style={{ left: columnX[1], top: rowTop, width: RANK_TABLE.columns[1], color }}>{entry.record.name}</span>
                  <img className={windowStyles.layer} alt="" src={frameSrc(TEAM_NAME_FRAME_BASE + entry.record.teamId)}
                    style={{ left: columnX[2] + RANK_TABLE.columns[2] / 2, top: rowTop + 2, transform: 'translateX(-50%)' }} />
                  <span className={styles.title} data-testid={`순위기록-값-${row}`}
                    style={{ left: columnX[3], top: rowTop, width: RANK_TABLE.columns[3], color }}>
                    {seasonRankingValueTextOf(category.kind, entry.value)}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} />
    </RawScreen>
  )
}
