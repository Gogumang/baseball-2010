import { useEffect, useState } from 'react'
import { Button, FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { Collection } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  ACHIEVEMENT_MARK, RECORD_COUNT, CELL_FRAMES, CELL_GRID, LIST_GRID, LOCKED_MARK, NAME_ROW, PAGER, PAGE_TITLE, PANEL,
  SPECIAL_RECORD_FIRST_CELL, SPECIAL_RECORD_NAMES,
  PROGRESS_ROW, SCROLL_MARKS, SKILL_DESCRIPTION, TAB_BAR, TAB_COUNT, TAB_CURSOR, TAB_NAMES,
  TAB_NAME_FRAMES, TAB_NAME_Y, TAB_PAGE_COUNTS, TOTAL_ROW, cellPositionOf, tabIconWidthOf,
  tabIconXOf, tabNameXOf, tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { STAT_NAMES } from '@/pages/record/lib/statNames'
import {
  INITIAL_SECRET_CODE_STATE, UNLOCKED_STAT_PAGE_COUNT, statNameOffsetOf, statPageCellsOf, statTotalTextOf,
  statValueTextOf, typeSecretDigit,
} from '@/pages/record/lib/statCells'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import { RECORD_COUNT_KINDS, achievementMarkOf, recordCountOf } from '@/entities/collection/model/annalsStats'
import * as styles from '@/pages/record/ui/RecordAnnals.css'

const SLT_FRAME = './sprites/slt_frame'
const SLT_FRAMES = `${SLT_FRAME}/frames`
const IMG_TEXT = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

/** 탭 이름 그림 폭 — 원본은 `0xba815(…, img_text, 276+탭, 1)` 로 크기를 재 가운데를 맞춘다 (0x2e546) */
const nameWidthOf = (origins: ReturnType<typeof useFrameOrigins>, frame: number) =>
  origins?.[String(frame).padStart(3, '0')]?.width ?? 0

interface RecordAnnalsProps {
  readonly collection: Collection
  readonly onBack: () => void
}

/**
 * 기록연감 (메인 메뉴 상태 30, 그리기 0x2e29c — P6 2c 확정).
 *
 * 탭 다섯(기록·진행·스킬·닉네임·통계)이 192×212 판 위에 놓인다.
 *   진행(엔딩)·스킬은 **41×25 칸 격자 4열**, 닉네임은 **164×18 줄 8개**다.
 *
 * 탭 이름·커서의 x 는 탭 막대 프레임의 **박스**가 정한다(0x94a65) — slt_frame 프레임 4~8 의
 * 박스 0 `(2/31/60/89/118, 2, 72, 17)` 을 읽어 확정했다(S12 1절). 간격은 29 다.
 * 원본은 **고른 탭의 이름 하나만** img_text 로 그리고, 안 고른 탭은 막대 그림 안의 아이콘이다.
 *
 * 탭 0 기록 셀 0~39 는 **달성 횟수**(`[mgr+0xc8]+4+n`, 0x22df0 — 경기 끝 0x22e10 이 올린다)를 노랑 오른쪽 맞춤으로
 * 찍고(`RecordCounts`), 셀 40~47(스페셜기록 쪽)은 달성 표시 `+0x106+k` 가 서 있으면 slt_frame 71 을 그린다(`AchievementMarks`).
 * 탭 4 통계는 칸 번호(쪽 × 8 + 줄)마다 이름·값이 정해진 `lib/statCells.ts` 대로 그린다. 값은 웹이 쌓는
 * GP 아이템 구매 수·사용처별 소모 GP 만 있고, 플레이 시간·우승 횟수·획득 GP 는 비운다.
 * 아이템·GP 쪽(2~7)은 숫자 키로 **"1212123"** 을 쳐야 열린다 (`typeSecretDigit`, 0x2b7a0).
 *   ⚠️ 원본은 센 수·열림 표시를 메인 메뉴 객체에 두어(만들 때 0x234d4 만 지운다) 들어올 때(0x2407c) 버퍼만 비우지만,
 *   웹은 이 화면을 열 때마다 처음부터 센다 (근사).
 */
export function RecordAnnals({ collection, onBack }: RecordAnnalsProps) {
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [secretCode, setSecretCode] = useState(INITIAL_SECRET_CODE_STATE)
  const frames = useFrameOrigins(SLT_FRAMES)
  const textFrames = useFrameOrigins(IMG_TEXT)

  // 쪽 넘기기 한도 — 통계 탭은 비밀 번호가 열려 있으면 8쪽 (0x2ba32 · 0x2ba8c). 쪽 번호 "/전체" 는 늘 표 값이다
  const pageLimit = tab === 4 && secretCode.isUnlocked ? UNLOCKED_STAT_PAGE_COUNT : TAB_PAGE_COUNTS[tab]
  const pageCount = TAB_PAGE_COUNTS[tab]
  const changeTab = (next: number) => {
    setTab((next + TAB_COUNT) % TAB_COUNT)
    setPage(0)
    setCursor(0)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        return changeTab(tab + (event.shiftKey ? -1 : 1))
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        return onBack()
      }
      // 숫자 키는 아직 안 열렸으면 비밀 번호 버퍼에 쌓인다 (0x2b7b4~0x2b838, 탭과 상관없다)
      if (/^[0-9]$/.test(event.key)) setSecretCode((previous) => typeSecretDigit(previous, event.key))
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0 && pageLimit > 0) {
        event.preventDefault()
        setPage((previous) => (previous + step + pageLimit) % pageLimit)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <RawScreen>
      <div className={styles.panel}
        style={{ left: PANEL.x, top: PANEL.y, width: PANEL.width, height: PANEL.height }} />

      {/* 탭 막대 — 고른 탭만 넓은 칸이라 탭마다 프레임이 다르다 */}
      <FrameSprite folder={SLT_FRAMES} frame={TAB_BAR.firstFrame + tab} origins={frames}
        x={TAB_BAR.x} y={TAB_BAR.y} />
      {/* 커서 프레임 9 — 고른 탭 박스 (24 + 박스x, 54) */}
      <FrameSprite folder={SLT_FRAMES} frame={TAB_CURSOR.frame} origins={frames}
        x={tabSlotXOf(tab)} y={TAB_CURSOR.y} />
      {/* 이름은 고른 탭 하나만 — 박스 안 가운데 맞춤 (0x2e568) */}
      <FrameSprite folder={IMG_TEXT} frame={TAB_NAME_FRAMES[tab]} origins={textFrames}
        x={tabNameXOf(tab, nameWidthOf(textFrames, TAB_NAME_FRAMES[tab]))} y={TAB_NAME_Y} />
      {TAB_NAMES.map((name, index) => (
        <button key={name} type="button" className={styles.tab} aria-label={name}
          style={{
            left: tabIconXOf(index, tab), top: TAB_BAR.y,
            width: tabIconWidthOf(index, tab), height: TAB_BAR.height,
          }}
          onClick={() => changeTab(index)} />
      ))}

      {pageCount > 0 && (
        <>
          <img className={styles.sprite} alt=""
            src={imageSrc(SLT_FRAME, PAGER.leftArrow.image)}
            style={{ left: PAGER.leftArrow.x, top: PAGER.leftArrow.y }} />
          <img className={styles.sprite} alt=""
            src={imageSrc(SLT_FRAME, PAGER.rightArrow.image)}
            style={{ left: PAGER.rightArrow.x, top: PAGER.rightArrow.y, transform: 'scaleX(-1)' }} />
          <div className={styles.pagerText} style={{ left: PAGER.numberX, top: PAGER.y }}>
            {page + 1}/{pageCount}
          </div>
        </>
      )}

      {tab === 1 && (
        <CellGrid
          frames={frames}
          gainedFrame={CELL_FRAMES.progress}
          cursor={cursor}
          setCursor={setCursor}
          items={ORIGINAL_ENDINGS.map((_ending, index) => ({
            name: `엔딩 ${index + 1}`,
            isGained: collection.endings.includes(index),
          }))}
        />
      )}

      {tab === 2 && (
        <>
          <CellGrid
            frames={frames}
            gainedFrame={CELL_FRAMES.skill}
            cursor={cursor}
            setCursor={setCursor}
            items={ORIGINAL_SKILLS.map((skill) => ({
              name: skill.name,
              isGained: collection.skills.includes(skill.id),
            }))}
          />
          <FrameSprite folder={SLT_FRAMES} frame={SKILL_DESCRIPTION.tabFrame} origins={frames}
            x={SKILL_DESCRIPTION.tabX} y={SKILL_DESCRIPTION.tabY} />
          <div className={styles.descriptionBox}
            style={{
              left: SKILL_DESCRIPTION.box.centerX - SKILL_DESCRIPTION.box.width / 2,
              top: SKILL_DESCRIPTION.box.y,
              width: SKILL_DESCRIPTION.box.width,
              height: SKILL_DESCRIPTION.box.height,
            }} />
          <div className={styles.descriptionText}
            style={{ left: SKILL_DESCRIPTION.text.x, top: SKILL_DESCRIPTION.text.y, width: SKILL_DESCRIPTION.text.width }}>
            {collection.skills.includes(cursor)
              // `"%s!N효과 : !cFFFF00%s"` — 이름 + 효과 (0xcf978)
              ? `${stripGameMarkup(ORIGINAL_SKILLS[cursor]?.description ?? '')}\n효과 : ${stripGameMarkup(ORIGINAL_SKILLS[cursor]?.effect ?? '')}`
              : '???'}
          </div>
        </>
      )}

      {tab === 3 && (
        <NameRows
          frames={frames}
          page={page}
          names={TITLE_NAMES}
          owned={collection.titles}
        />
      )}

      {tab === 0 && <ListRows page={page} names={RECORD_TAB_NAMES} />}
      {tab === 0 && <RecordCounts page={page} stats={collection.stats} />}
      {tab === 0 && <AchievementMarks page={page} stats={collection.stats} />}

      {tab === 4 && <StatRows page={page} stats={collection.stats} />}

      {tab === 1 && (
        <>
          <img className={styles.sprite} alt=""
            src={imageSrc(SLT_FRAME, PAGE_TITLE.bulletImage)}
            style={{ left: PROGRESS_ROW.bulletX, top: PROGRESS_ROW.y + 4 }} />
          <FrameSprite folder={IMG_TEXT} frame={PROGRESS_ROW.labelFrame} origins={textFrames}
            x={PROGRESS_ROW.labelX} y={PROGRESS_ROW.y} />
          <FrameSprite folder={SLT_FRAMES} frame={PROGRESS_ROW.frame} origins={frames}
            x={PROGRESS_ROW.frameX} y={PROGRESS_ROW.y - 3} />
          <div className={styles.progressValue}
            style={{ left: PROGRESS_ROW.frameX, top: PROGRESS_ROW.y + 1, width: 67 }}>
            {Math.trunc((collection.endings.length * 100) / ORIGINAL_ENDINGS.length)}%
          </div>
        </>
      )}

      {(tab === 2 || tab === 3) && (
        <TotalRow
          frames={frames}
          textFrames={textFrames}
          value={tab === 2
            ? `${collection.skills.length}/${ORIGINAL_SKILLS.length}`
            : `${collection.titles.length}/${TITLE_NAMES.length}`}
        />
      )}

      {tab === 4 && (
        // 통계 합계는 `"!R!cFFFF00…G"` 오른쪽 맞춤 (0x58870)
        <TotalRow frames={frames} textFrames={textFrames} value={statTotalTextOf(page) ?? ''} isRightAligned />
      )}

      <Button variant="corner" className={styles.backButton} onClick={onBack}>
        ‹ 돌아가기
      </Button>
    </RawScreen>
  )
}

interface CellItem {
  readonly name: string
  readonly isGained: boolean
}

/** 41×25 칸 격자 4열 (탭 1 진행 · 탭 2 스킬) */
function CellGrid({
  frames, items, gainedFrame, cursor, setCursor,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly items: readonly CellItem[]
  readonly gainedFrame: number
  readonly cursor: number
  readonly setCursor: (index: number) => void
}) {
  const visible = CELL_GRID.columns * CELL_GRID.visibleRows
  const firstRow = Math.max(0, Math.floor(cursor / CELL_GRID.columns) - (CELL_GRID.visibleRows - 1))
  const start = firstRow * CELL_GRID.columns

  return (
    <>
      {items.slice(start, start + visible).map((item, offset) => {
        const index = start + offset
        const { x, y } = cellPositionOf(offset)
        return (
          <div key={item.name + index}>
            <FrameSprite folder={SLT_FRAMES} frame={item.isGained ? gainedFrame : CELL_FRAMES.locked}
              origins={frames} x={x} y={y} />
            {item.isGained ? (
              <>
                <div className={styles.cellShadow} style={{ left: x, top: y + 7, width: CELL_GRID.width }}>
                  {item.name}
                </div>
                <div className={styles.cellName} style={{ left: x - 1, top: y + 6, width: CELL_GRID.width }}>
                  {item.name}
                </div>
              </>
            ) : (
              LOCKED_MARK.dx.map((dx) => (
                <img key={dx} className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, LOCKED_MARK.image)}
                  style={{ left: x + dx, top: y + LOCKED_MARK.dy }} />
              ))
            )}
            {index === cursor && (
              <FrameSprite folder={SLT_FRAMES} frame={CELL_FRAMES.cursor} origins={frames} x={x - 1} y={y - 1} />
            )}
            <button type="button" className={styles.cell} aria-label={item.isGained ? item.name : '???'}
              style={{ left: x, top: y, width: CELL_GRID.width, height: CELL_GRID.height }}
              onClick={() => setCursor(index)} />
          </div>
        )
      })}
      {start > 0 && (
        <FrameSprite folder={SLT_FRAMES} frame={SCROLL_MARKS.up.frame} origins={frames}
          x={SCROLL_MARKS.x} y={SCROLL_MARKS.up.y} />
      )}
      {start + visible < items.length && (
        <FrameSprite folder={SLT_FRAMES} frame={SCROLL_MARKS.down.frame} origins={frames}
          x={SCROLL_MARKS.x} y={SCROLL_MARKS.down.y} />
      )}
    </>
  )
}

/** 164×18 이름 줄 8개 (탭 3 닉네임) */
function NameRows({
  frames, page, names, owned,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly page: number
  readonly names: readonly string[]
  readonly owned: readonly string[]
}) {
  const start = page * NAME_ROW.visibleRows
  return (
    <>
      {names.slice(start, start + NAME_ROW.visibleRows).map((name, offset) => {
        const y = NAME_ROW.firstY + NAME_ROW.step * offset
        return (
          <div key={name}>
            <FrameSprite folder={SLT_FRAMES} frame={NAME_ROW.frame} origins={frames} x={NAME_ROW.x} y={y} />
            <div className={styles.rowText} style={{ left: NAME_ROW.numberX, top: y + 4 }}>
              {start + offset + 1}
            </div>
            <div className={styles.rowText} style={{ left: NAME_ROW.nameX, top: y + 4, width: 110 }}>
              {owned.includes(name) ? name : '???'}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** 기록·통계 탭의 1열 8줄 목록 */
function ListRows({ page, names }: { readonly page: number; readonly names: readonly string[] }) {
  const start = page * LIST_GRID.rows
  return (
    <>
      {names.slice(start, start + LIST_GRID.rows).map((name, offset) => (
        <div key={name} className={styles.rowText}
          style={{ left: LIST_GRID.x, top: LIST_GRID.firstY + LIST_GRID.step * offset, width: LIST_GRID.width }}>
          {name}
        </div>
      ))}
    </>
  )
}

/** 탭 0 의 칸 이름 48개 — StrGAME[8 + n] (경기 기록 40 + 달성 8) */
const RECORD_TAB_NAMES: readonly string[] = [...RECORD_NAMES, ...SPECIAL_RECORD_NAMES]

/** 탭 0 셀 0~39 의 달성 횟수 `"!R!cffff00%d"` — 0 도 찍는다 (0x7a0d0~0x7a0fc) */
function RecordCounts({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => {
        const cell = page * LIST_GRID.rows + row
        if (cell >= RECORD_COUNT_KINDS) return null
        return (
          <div key={cell} className={styles.statValue} data-cell={cell}
            style={{
              left: LIST_GRID.x + RECORD_COUNT.dx,
              top: LIST_GRID.firstY + LIST_GRID.step * row + RECORD_COUNT.dy,
              width: LIST_GRID.width - RECORD_COUNT.widthInset,
            }}>
            {recordCountOf(stats, cell)}
          </div>
        )
      })}
    </>
  )
}

/** 탭 0 셀 40~47 의 달성 표시 — slt_frame 이미지 71 을 칸 오른쪽 끝에 (0x7a102~0x7a156) */
function AchievementMarks({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => {
        const cell = page * LIST_GRID.rows + row
        if (cell < SPECIAL_RECORD_FIRST_CELL || achievementMarkOf(stats, cell - SPECIAL_RECORD_FIRST_CELL) === 0) return null
        return (
          <img key={cell} className={styles.sprite} alt="달성" data-cell={cell}
            src={imageSrc(SLT_FRAME, ACHIEVEMENT_MARK.image)}
            style={{
              left: LIST_GRID.x + LIST_GRID.width - ACHIEVEMENT_MARK.width + ACHIEVEMENT_MARK.dx,
              top: LIST_GRID.firstY + LIST_GRID.step * row + ACHIEVEMENT_MARK.dy,
            }} />
        )
      })}
    </>
  )
}

/** 통계 탭의 1열 8줄 — 칸 번호 = 쪽 × 8 + 줄, 빈 번호는 아무것도 안 그린다 (0x7a08c) */
function StatRows({ page, stats }: { readonly page: number; readonly stats: AnnalsStats }) {
  return (
    <>
      {statPageCellsOf(page).map((cell, row) => {
        if (cell === null) return null
        const top = LIST_GRID.firstY + LIST_GRID.step * row
        const value = cell.valueOf(stats)
        return (
          <div key={cell.nameIndex}>
            <div className={styles.rowText} style={{ left: LIST_GRID.x, top, width: LIST_GRID.width }}>
              {STAT_NAMES[statNameOffsetOf(cell)]}
            </div>
            {value !== null && (
              <div className={styles.statValue} style={{ left: LIST_GRID.x, top, width: LIST_GRID.width }}>
                {statValueTextOf(cell.valueKind, value)}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/** 아래 합계 줄 — 프레임 15 + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑 */
function TotalRow({
  frames, textFrames, value, isRightAligned = false,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly textFrames: ReturnType<typeof useFrameOrigins>
  readonly value: string
  readonly isRightAligned?: boolean
}) {
  return (
    <>
      <img className={styles.sprite} alt=""
        src={imageSrc(SLT_FRAME, PAGE_TITLE.bulletImage)}
        style={{ left: TOTAL_ROW.bulletX, top: TOTAL_ROW.y + 4 }} />
      <FrameSprite folder={IMG_TEXT} frame={TOTAL_ROW.labelFrame} origins={textFrames}
        x={TOTAL_ROW.labelX} y={TOTAL_ROW.y} />
      <FrameSprite folder={SLT_FRAMES} frame={TOTAL_ROW.frame} origins={frames}
        x={TOTAL_ROW.frameX} y={TOTAL_ROW.y - 3} />
      <div className={styles.totalValue}
        style={{ left: TOTAL_ROW.frameX, top: TOTAL_ROW.y + 1, width: 101, textAlign: isRightAligned ? 'right' : undefined }}>
        {value}
      </div>
    </>
  )
}
