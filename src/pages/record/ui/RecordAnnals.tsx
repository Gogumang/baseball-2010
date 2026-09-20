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
  CELL_FRAMES, CELL_GRID, LIST_GRID, LOCKED_MARK, NAME_ROW, PAGER, PAGE_TITLE, PANEL,
  PROGRESS_ROW, SCROLL_MARKS, SKILL_DESCRIPTION, TAB_BAR, TAB_COUNT, TAB_CURSOR, TAB_NAMES,
  TAB_NAME_FRAMES, TAB_PAGE_COUNTS, TAB_SLOT_WIDTH, TOTAL_ROW, cellPositionOf, tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import * as styles from '@/pages/record/ui/RecordAnnals.css'

const SLT_FRAME = './sprites/slt_frame'
const SLT_FRAMES = `${SLT_FRAME}/frames`
const IMG_TEXT = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

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
 * ⚠️ 탭 이름·커서의 x 는 원래 탭 막대 프레임의 **박스**가 정하는데(0x94a65) 박스 값을 아직
 * 못 뽑아 막대를 다섯 칸으로 고르게 나눠 썼다 — 그 부분만 배치 근사다.
 *
 * ⚠️ 탭 0 기록·탭 4 통계는 원본이 **달성 횟수**를 보여 주는데 웹은 그 누계를 아직 저장하지 않는다.
 * 이름만 원본 줄 배치로 보여 주고 값은 비워 둔다.
 */
export function RecordAnnals({ collection, onBack }: RecordAnnalsProps) {
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const [cursor, setCursor] = useState(0)
  const frames = useFrameOrigins(SLT_FRAMES)
  const textFrames = useFrameOrigins(IMG_TEXT)

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
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0 && pageCount > 0) {
        event.preventDefault()
        setPage((previous) => (previous + step + pageCount) % pageCount)
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
      <FrameSprite folder={SLT_FRAMES} frame={TAB_CURSOR.frame} origins={frames}
        x={tabSlotXOf(tab) + TAB_SLOT_WIDTH / 2 - TAB_CURSOR.width / 2} y={TAB_CURSOR.y} />
      {TAB_NAMES.map((name, index) => (
        <div key={name}>
          <FrameSprite folder={IMG_TEXT} frame={TAB_NAME_FRAMES[index]} origins={textFrames}
            x={tabSlotXOf(index) + TAB_SLOT_WIDTH / 2 - 10} y={TAB_BAR.y + 5} />
          <button type="button" className={styles.tab} aria-label={name}
            style={{ left: tabSlotXOf(index), top: TAB_BAR.y, width: TAB_SLOT_WIDTH, height: TAB_BAR.height }}
            onClick={() => changeTab(index)} />
        </div>
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

      {(tab === 0 || tab === 4) && (
        <ListRows page={page} names={tab === 0 ? RECORD_NAMES : STAT_NAMES} />
      )}

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
          owned={tab === 2 ? collection.skills.length : collection.titles.length}
          total={tab === 2 ? ORIGINAL_SKILLS.length : TITLE_NAMES.length}
        />
      )}

      <Button variant="corner" className={styles.backButton} onClick={onBack}>
        ‹ 돌아가기
      </Button>
    </RawScreen>
  )
}

/** 통계 탭 줄 이름 — 원본 StrMAINMENU[129~182] 은 아직 안 옮겼다 */
const STAT_NAMES: readonly string[] = [
  '일반모드 판 수', '나만의리그 판 수', '시즌모드 판 수', '대전모드 판 수',
  '홈런더비 판 수', '미션모드 판 수', '모은 G포인트', '쓴 G포인트',
]

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

/** 아래 합계 줄 — 프레임 15 + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑 */
function TotalRow({
  frames, textFrames, owned, total,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly textFrames: ReturnType<typeof useFrameOrigins>
  readonly owned: number
  readonly total: number
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
      <div className={styles.totalValue} style={{ left: TOTAL_ROW.frameX, top: TOTAL_ROW.y + 1, width: 101 }}>
        {owned}/{total}
      </div>
    </>
  )
}
