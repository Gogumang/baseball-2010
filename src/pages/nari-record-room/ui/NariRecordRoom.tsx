import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CommonPanel, RawScreen, ScreenOverlay, useImgTextPalette3 } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { RecordPickPopup } from '@/widgets/record-pick-popup'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { RankingBoard } from '@/pages/nari-record-room/ui/RankingBoard'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { moveRankingPage, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  OPEN_YEAR_RECORD_VIEW, RECORD_ROOM_PICK, RECORD_ROOM_PICK_LABEL_FRAMES, RECORD_ROOM_PICK_LABELS,
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
 * 머리띠 0x7f4ed 의 제목 · 바닥은 124 진입이 아니라 **앞그림 0x16a34 끝의 0x16928** 이 틀마다 세운다 — 124(0x7c)는 0x76 · 0x65 ·
 * 0x6d · 0x80 어느 갈래도 아니라 기본 갈래 0x169ea = 0x7f53c(hdr, [장면+0xcc] == 4 ? 8 : 9, **5**, 0): 편 제목 · 바닥 5(되돌아가기).
 * 앞그림은 장면 틀 0x1cdec 의 0x1d332 가 상태와 상관없이 부르고 그리기표(0xcc884 → 0x16778)보다 앞이라 첫 그림부터 이 값이다.
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
  /** 확인 뒤 창이 124 위에서 다 줄어들었다 */
  readonly onClosed: () => void
}

/**
 * 팝업 0x80 그림 0x19448 · 키 0x196ec — 시즌 0xf334 · 0xf5d4 와 같은 꼴에 글만 106 "개인기록" · 360 "순위기록"
 * (`widgets/record-pick-popup` 머리말). 고른 칸은 [장면+0x166] == 0 이면 칸 0.
 */
export function NariRecordPickPopup({ onChoose, onCancel, onClosed }: NariRecordPickPopupProps) {
  /** [장면+0x166] — 팝업을 열 때 0 (130d4~130dc) */
  const [pick, setPick] = useState<RecordRoomPick>(RECORD_ROOM_PICK.개인기록)
  // 확인 키가 그 갱신에 124 를 걸어(0x19736~0x19750) 다음 틀에 아래 화면이 124 로 갈려도 창은 그 위에서 줄어든다 —
  // 화면 갈래 밖 한 자리(240×320 화면 버퍼 자리)에 그린다. 부르는 쪽도 갈래 밖 같은 자리에 둔다
  return (
    <ScreenOverlay>
      <div style={{ position: 'absolute', left: 0, top: 'calc(50% - 160px)', width: 240, height: 320, pointerEvents: 'none' }}>
        <RecordPickPopup ariaLabel="기록실" testIdPrefix="기록실" selected={pick} closeKind="줄임"
          cells={[
            { label: RECORD_ROOM_PICK_LABELS[0], labelFrame: RECORD_ROOM_PICK_LABEL_FRAMES[0] },
            { label: RECORD_ROOM_PICK_LABELS[1], labelFrame: RECORD_ROOM_PICK_LABEL_FRAMES[1] },
          ]}
          onToggle={() => setPick((held) => (held === RECORD_ROOM_PICK.개인기록 ? RECORD_ROOM_PICK.순위기록 : RECORD_ROOM_PICK.개인기록))}
          onConfirm={() => onChoose(pick)}
          onCancel={onCancel}
          onClosed={onClosed} />
      </div>
    </ScreenOverlay>
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

/** 머리 글 img_text — 0x5650c 가 (x, 56, 폭, 15) + dy 2 = (x, 58, 폭, 15) 가운데에 (img_text 크기는 origins.json). 팔레트 3 (0x565ac~0x565b8 `0x913e5(img_text, 3)`) */
function YearLabel({ frame, x, width, alt, palette }: {
  readonly frame: number; readonly x: number; readonly width: number; readonly alt: string; readonly palette: CSSProperties
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
  const palette3 = useImgTextPalette3()

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`개인기록 ${edition}`}>
        {palette3.definition}
        {/* 5ca4e 공용 판 0x55e60(편집기, W/2, H/2 + 5, 210, 220, 0, 0x22, 위 띠 0x12, 아래 띠, 0, 0) — 아래 띠는
            (s8)[편집기+0x3e8] == 1 이면 0x12, 아니면 0 (5ca00~5ca10). [편집기+0x3e8] 에 쓰는 곳은 편집기 초기화 0x5561c 의
            556a0 `strb 0` 하나뿐이다(binary.mod 전체에서 +0x3e8 쓰기를 상수 추적으로 찾았다 — 읽는 곳도 5ca04 하나). 124 진입
            0x116d4 → 0x5761c → 0x5561c 가 늘 먼저 돌므로 아래 띠는 **늘 0** 이다 — 원본에서도 그려지지 않는 죽은 갈래 */}
        <CommonPanel x={layout.panel.x} y={layout.panel.y} width={layout.panel.width} height={layout.panel.height}
          topBand={0x12} testId="개인기록-판" />
        {rows.length > 1 && (
          <>
            <img alt="위" src={imageOf(SLT_FRAME, UP_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.upArrowY - blink }} />
            <img alt="아래" src={imageOf(SLT_FRAME, DOWN_ARROW_IMAGE)} style={{ ...pixel, left: layout.arrowX, top: layout.downArrowY + blink }} />
          </>
        )}
        <YearLabel frame={YEAR_NUMBER_HEADER_FRAME} x={layout.numberX} width={layout.numberWidth} alt="연차" palette={palette3.style} />
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
                <YearLabel frame={column.labelFrame} x={0} width={layout.statWidth} alt={column.label} palette={palette3.style} />
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
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
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

/**
 * 124 둘째 갈래 — 0x5796c(나리 판 목록) · 키 0x5787d(좌·우로 쪽 [편집기+0x444], 끝에서 멈춘다 · 쪽이 바뀌면 다시 뽑는다).
 * 그림은 시즌 기록순위 0xdb 와 같은 함수다 — `RankingBoard`(배치 `lib/rankingBoard.ts` 머리말). 내 팀 = [편집기+0x448] = S[1].
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
  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`순위기록 ${side} ${category.label}`}>
        <RankingBoard kind={category.kind} kindLabelFrame={category.labelFrame} entries={entries} myTeamId={career.teamId}
          hasPreviousPage={page > 0} hasNextPage={page < categories.length - 1} testIdPrefix="순위기록" />
      </div>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
    </RawScreen>
  )
}
