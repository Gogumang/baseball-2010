import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FrameSprite, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import type { Collection } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { parseGameMarkup, stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { RECORD_DESCRIPTIONS } from '@/pages/record/lib/recordDescriptions'
import {
  ACHIEVEMENT_MARK, DESCRIPTION_BAR, LIST_CURSOR, LIST_ROW_FRAME_DY, listFirstYOf, listRowFrameOf, NICKNAME_SCROLLBAR, NICKNAME_TAB_LABEL, DESCRIPTION_TICKER, RECORD_COUNT, tickerTextXOf, CELL_FRAMES, CELL_GRID, LIST_GRID, LOCKED_MARK, NAME_ROW, PAGER, PAGE_TITLE, PANEL,
  SPECIAL_RECORD_FIRST_CELL, SPECIAL_RECORD_NAMES,
  ENDING_CELL_NAMES, NARI_ENDING_CELL_COUNT, PROGRESS_ROW, SCROLL_MARKS, endingCellFrameOf, endingProgressOf, SKILL_DESCRIPTION, TAB_BAR, TAB_COUNT, TAB_CURSOR, TAB_NAMES,
  TAB_NAME_FRAMES, TAB_NAME_Y, TAB_PAGE_COUNTS, TOTAL_ROW, cellPositionOf, tabIconWidthOf,
  tabIconXOf, tabNameXOf, tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { STAT_NAMES } from '@/pages/record/lib/statNames'
import type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
import {
  ANNALS_GRID_SHAPES, DIRECTION_CODES, PANEL_ANIMATION_DRAWS, PANEL_FULL_HEIGHT, VISIBLE_GRID_ROWS,
  NICKNAME_PAGE_FIRST_NAMES, NICKNAME_PAGE_TITLE_FRAMES, NICKNAME_PAGE_TOTALS, NICKNAME_SCROLL_TRACK,
  NICKNAME_VISIBLE_ROWS, closingPanelHeightOf, cursorShakeOf, hasDownMark, isBlinkOn, isListCursorBlinkOn, moveGridCursor,
  nicknameScrollDirectionOf, openingPanelHeightOf, panelTopOf, scrollNicknames, scrollTopAfter, startNicknameScroll,
} from '@/pages/record/lib/annalsGrid'
import type { NicknameScroll } from '@/pages/record/lib/annalsGrid'
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
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
}

/** 화면 크기 — 판 안 그림을 자르는 clip-path 를 잴 때 쓴다 */
const SCREEN = { width: 240, height: 320 } as const

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
 *
 * 키 처리는 원본 갱신 0x2b7a0 그대로다(`lib/annalsGrid.ts`): 들어오면 **탭 막대에 초점**이 있어 ←→ 가 탭을 바꾸고,
 * OK·↓ 로 본문에 들어가 ←→ 는 쪽(진행·스킬은 같은 줄 안 커서 감기), ↑↓ 는 커서 — 진행·스킬은 보이는 3줄 창이
 * 커서를 따라 한 줄씩 움직인다. 취소는 본문 → 탭 막대 → 닫기. 탭 아이콘·칸 누르기는 웹 덧붙임이다.
 */
export function RecordAnnals({ collection, onBack, gamePoint = 0 }: RecordAnnalsProps) {
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const [cursor, setCursor] = useState(0)
  /** [skin+0xf6] — 들어올 때 1 (0x2407c) */
  const [isTabFocused, setIsTabFocused] = useState(true)
  /** 보이는 줄 창 윗줄 [skin+0x1f4] (아랫줄 [skin+0x1f8] = 윗줄 + 3) */
  const [gridTop, setGridTop] = useState(0)
  const tick = useUpdateCounter()
  const isBlinking = isBlinkOn(tick)
  /** 탭 막대에서 CLR 을 누른 틱 — 판을 닫는 중 ([skin+0x99] = 0) */
  const [closingAt, setClosingAt] = useState<number | null>(null)
  const panelHeight = closingAt === null ? openingPanelHeightOf(tick) : closingPanelHeightOf(tick - closingAt)
  /** 키를 받는가 — 여는 중이고 끝났고 높이 212 (0x2b87c~0x2b8b6) */
  const isPanelOpen = closingAt === null && tick >= PANEL_ANIMATION_DRAWS
  const hasLeftRef = useRef(false)
  // 닫기가 끝난(넷째 그림) 다음 갱신에 스페셜 목록으로 (0x2bb0a)
  useEffect(() => {
    if (closingAt === null || tick - closingAt < PANEL_ANIMATION_DRAWS || hasLeftRef.current) return
    hasLeftRef.current = true
    onBack()
  }, [closingAt, tick, onBack])
  /** 고른 칸 흔들림 — 방향 [this+0xfc] 과 시작 틱 ([this+0xf8] = 지금 틱 − 시작) */
  const [shake, setShake] = useState<{ readonly directionCode: number; readonly startedAt: number } | null>(null)
  const cursorShake = !isTabFocused && shake !== null ? cursorShakeOf(shake.directionCode, tick - shake.startedAt) : null
  /** 탭 0·4 목록 격자를 마지막으로 다시 지은 틱 — 깜박임 카운터 +0x18 = 지금 틱 − 이 값 (0x7a005) */
  const [listBuiltAt, setListBuiltAt] = useState(0)
  const [secretCode, setSecretCode] = useState(INITIAL_SECRET_CODE_STATE)
  const frames = useFrameOrigins(SLT_FRAMES)
  const textFrames = useFrameOrigins(IMG_TEXT)
  /** 진행 탭 칸 20 — 0~14 나리 엔딩(전역기록 +0xa8 + i) · 15~19 시즌 엔딩(+0xa0 + j) (0x58b5c) */
  const endingCells = ENDING_CELL_NAMES.map((name, index) => ({
    name,
    isGained: index < NARI_ENDING_CELL_COUNT
      ? collection.endings.includes(index)
      : collection.seasonEndings.includes(index - NARI_ENDING_CELL_COUNT),
    gainedFrame: endingCellFrameOf(index),
  }))

  // 쪽 넘기기 한도 — 통계 탭은 비밀 번호가 열려 있으면 8쪽 (0x2ba32 · 0x2ba8c). 쪽 번호 "/전체" 는 늘 표 값이다
  const pageLimit = tab === 4 && secretCode.isUnlocked ? UNLOCKED_STAT_PAGE_COUNT : TAB_PAGE_COUNTS[tab]
  const pageCount = TAB_PAGE_COUNTS[tab]
  /** 탭 3 닉네임 스크롤 객체 (skin +0x108~+0x120) — 탭 3 을 새로 시작하거나 탭 3 에서 쪽을 넘길 때만 다시 세운다 */
  const [nicknameScroll, setNicknameScroll] = useState<NicknameScroll>(() => startNicknameScroll(NICKNAME_PAGE_TOTALS[0]))
  /** 0x2b640 — 탭 새로 시작: 쪽 0 · 커서 (0, 0) · 창 0~3 · 탭 3 이면 스크롤 0x61c54(…, 0x20) */
  const restartTab = (next: number) => {
    setTab(next)
    setPage(0)
    setCursor(0)
    setGridTop(0)
    setListBuiltAt(tick)
    if (next === 3) setNicknameScroll(startNicknameScroll(NICKNAME_PAGE_TOTALS[0]))
  }
  const changeTab = (next: number) => restartTab((next + TAB_COUNT) % TAB_COUNT)
  /** CLR — 본문이면 탭 막대로(0x2b95c), 탭 막대면 판을 닫기 시작한다(0x2b946) */
  const pressClear = () => {
    if (isTabFocused) return setClosingAt(tick)
    setIsTabFocused(true)
    // 0x2b95c~0x2b964 — [skin+0x80] = 0 이라 다음 그림이 목록 격자를 커서 없이(+6 = 0) 다시 짓는다
    setListBuiltAt(tick)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event
      // 숫자 키는 아직 안 열렸으면 비밀 번호 버퍼에 쌓인다 (0x2b7b4~0x2b838, 탭·초점과 상관없다)
      if (/^[0-9]$/.test(key)) setSecretCode((previous) => typeSecretDigit(previous, key))
      // 판이 다 열리기 전·닫는 중에는 키를 안 받는다 (0x2b87c — 비밀 번호 버퍼 0x2b7b4 는 그 앞이라 받는다)
      if (!isPanelOpen) return
      if (key === 'Escape' || key === 'Backspace') {
        event.preventDefault()
        return pressClear()
      }
      if (isTabFocused) {
        // 날 키 그대로 (격자 키 처리를 안 거친다): ← '4' · → '6' 은 탭, OK · '5' · ↓ 는 본문으로. '2' · '8' · ↑ 은 아무것도 안 한다
        if (key === 'ArrowLeft' || key === '4') {
          event.preventDefault()
          return changeTab(tab - 1)
        }
        if (key === 'ArrowRight' || key === '6') {
          event.preventDefault()
          return changeTab(tab + 1)
        }
        if (key === 'Enter' || key === ' ' || key === '5' || key === 'ArrowDown') {
          event.preventDefault()
          restartTab(tab)
          return setIsTabFocused(false)
        }
        return
      }
      // 본문: 날 키를 스크롤 객체에도 넘긴다 (0x2b876 → 0x61ce4 — 세운 적이 있는 탭 3 에서만 보인다)
      const scrollDirection = nicknameScrollDirectionOf(key)
      if (scrollDirection !== null) setNicknameScroll((previous) => scrollNicknames(previous, scrollDirection))
      // 격자가 숫자 2·4·6·8 을 방향으로 바꾼다 (표 0xd2e7c)
      const direction = annalsDirectionOf(key)
      if (direction === null) return
      event.preventDefault()
      const nextCursor = moveGridCursor(ANNALS_GRID_SHAPES[tab], cursor, direction)
      setCursor(nextCursor)
      // 커서가 옮겨 갔으면(격자 +0x25) 흔들림을 새로 건다 (0x2eaec)
      if (nextCursor !== cursor) setShake({ directionCode: DIRECTION_CODES[direction], startedAt: tick })
      if (direction === 'up' || direction === 'down') {
        setGridTop(scrollTopAfter(tab, gridTop, nextCursor, direction))
        return
      }
      // ← → 는 쪽 넘기기 (0x2ba10 · 0x2ba5a) — 쪽이 없는 탭(진행·스킬)은 보이는 것이 없다.
      // 끝에 [skin+0x80] = 0 (0x2babe) — 탭 0·4 그림이 0 일 때만 목록 객체 [mgr+0xe0] 를 새 쪽으로 다시 짓고(0x79ed5 ·
      // 0x7a005, 0x2e8e0~0x2e996) 1 올리는 "다시 지어라" 깃발이다. 웹은 그릴 때마다 쪽에서 줄을 새로 뽑으므로 따로 둘 것이 없다
      const step = direction === 'right' ? 1 : -1
      if (pageLimit === 0) return
      const nextPage = (page + step + pageLimit) % pageLimit
      setPage(nextPage)
      setListBuiltAt(tick)
      // 탭 3 이면 새 쪽의 개수로 스크롤을 다시 세운다 (0x2bac6: 쪽 0 ? 0x20 : 0x10)
      if (tab === 3) setNicknameScroll(startNicknameScroll(nextPage === 0 ? 0x20 : 0x10))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  /** 웹 덧붙임 — 보이는 칸을 누르면 본문에 들어가 그 칸을 고른다 (창은 그대로) */
  const selectCell = (index: number) => {
    if (!isPanelOpen) return
    setIsTabFocused(false)
    setCursor(index)
  }

  return (
    <RawScreen>
      {/* 판 (24, 160 − h/2, 192, h) — 들어올 때 32 에서 그림마다 커진다 (0x55e60 · 0x2fb94) */}
      <div className={styles.panel}
        style={{ left: PANEL.x, top: panelTopOf(panelHeight), width: PANEL.width, height: panelHeight }} />
      {/* 판 안 그림 — 높이 ≤ 211 동안은 (24, 160 − h/2 + 5, 192, h − 10) 로 잘린다 (0x2e42e~0x2e452) */}
      <div className={styles.content}
        style={panelHeight >= PANEL_FULL_HEIGHT ? undefined : {
          clipPath: `inset(${panelTopOf(panelHeight) + 5}px ${SCREEN.width - PANEL.x - PANEL.width}px `
            + `${SCREEN.height - (panelTopOf(panelHeight) + panelHeight - 5)}px ${PANEL.x}px)`,
        }}>

      {/* 탭 막대 — 고른 탭만 넓은 칸이라 탭마다 프레임이 다르다 */}
      <FrameSprite folder={SLT_FRAMES} frame={TAB_BAR.firstFrame + tab} origins={frames}
        x={TAB_BAR.x} y={TAB_BAR.y} />
      {/* 커서 프레임 9 — 고른 탭 박스 (24 + 박스x, 54). 탭 막대에 초점이 있으면 깜박인다 (0x2e5be) */}
      {(!isTabFocused || isBlinking) && (
        <FrameSprite folder={SLT_FRAMES} frame={TAB_CURSOR.frame} origins={frames}
          x={tabSlotXOf(tab)} y={TAB_CURSOR.y} />
      )}
      {/* 이름은 고른 탭 하나만 — 박스 안 가운데 맞춤 (0x2e568) */}
      <FrameSprite folder={IMG_TEXT} frame={TAB_NAME_FRAMES[tab]} origins={textFrames}
        x={tabNameXOf(tab, nameWidthOf(textFrames, TAB_NAME_FRAMES[tab]))} y={TAB_NAME_Y} />
      {TAB_NAMES.map((name, index) => (
        <button key={name} type="button" className={styles.tab} aria-label={name}
          style={{
            left: tabIconXOf(index, tab), top: TAB_BAR.y,
            width: tabIconWidthOf(index, tab), height: TAB_BAR.height,
          }}
          onClick={() => isPanelOpen && changeTab(index)} />
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
          top={gridTop}
          hasDownMark={hasDownMark(1, gridTop)}
          isCursorShown={!isTabFocused && isBlinking}
          isBlinking={isBlinking}
          cursorShake={cursorShake}
          onSelect={selectCell}
          items={endingCells}
        />
      )}

      {tab === 2 && (
        <>
          <CellGrid
            frames={frames}
            gainedFrame={CELL_FRAMES.skill}
            cursor={cursor}
            top={gridTop}
            hasDownMark={hasDownMark(2, gridTop)}
            isCursorShown={!isTabFocused && isBlinking}
            isBlinking={isBlinking}
            cursorShake={cursorShake}
            onSelect={selectCell}
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
          textFrames={textFrames}
          page={page}
          scroll={nicknameScroll}
          owned={collection.titles}
        />
      )}

      {(tab === 0 || tab === 4) && <ListRowFrames frames={frames} tab={tab} page={page} />}
      {tab === 0 && <ListRows page={page} names={RECORD_TAB_NAMES} />}
      {tab === 0 && <RecordCounts page={page} stats={collection.stats} />}
      {tab === 0 && <AchievementMarks page={page} stats={collection.stats} />}
      {tab === 0 && (
        <FrameSprite folder={SLT_FRAMES} frame={DESCRIPTION_BAR.frame} origins={frames} x={DESCRIPTION_BAR.x} y={DESCRIPTION_BAR.y} />
      )}
      {tab === 0 && !isTabFocused && (
        <DescriptionTicker text={RECORD_DESCRIPTIONS[page * LIST_GRID.rows + cursor] ?? ''} tick={tick} />
      )}

      {tab === 4 && <StatRows page={page} stats={collection.stats} />}
      {/* 줄 커서 — 칸을 다 그린 뒤 0x7a571 꼬리가 고른 칸 위에 (본문 초점 + 깜박임 켜짐) */}
      {(tab === 0 || tab === 4) && !isTabFocused && isListCursorBlinkOn(tick - listBuiltAt) && (
        <FrameSprite folder={SLT_FRAMES} frame={LIST_CURSOR.frame} origins={frames}
          x={LIST_GRID.x + (cursorShake?.dx ?? 0)}
          y={listFirstYOf(tab) + LIST_GRID.step * cursor + LIST_CURSOR.dy + (cursorShake?.dy ?? 0)} />
      )}

      {tab === 1 && PROGRESS_ROW.modeFrames.map((modeFrame, row) => {
        const y = PROGRESS_ROW.firstY + PROGRESS_ROW.step * row
        const gained = endingCells
          .filter((cell, index) => cell.isGained && (row === 0) === (index < NARI_ENDING_CELL_COUNT)).length
        return (
          <div key={modeFrame}>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, PROGRESS_ROW.bulletImage)}
              style={{ left: PROGRESS_ROW.bulletX, top: y + PROGRESS_ROW.bulletDy }} />
            <FrameSprite folder={IMG_TEXT} frame={modeFrame} origins={textFrames}
              x={PROGRESS_ROW.modeLabelX} y={y} />
            <FrameSprite folder={IMG_TEXT} frame={PROGRESS_ROW.labelFrame} origins={textFrames}
              x={PROGRESS_ROW.modeLabelX + nameWidthOf(textFrames, modeFrame) + PROGRESS_ROW.labelGap} y={y} />
            <FrameSprite folder={SLT_FRAMES} frame={PROGRESS_ROW.frame} origins={frames}
              x={PROGRESS_ROW.frameX} y={y + PROGRESS_ROW.frameDy} />
            <div className={styles.progressValue}
              style={{ left: PROGRESS_ROW.frameX, top: y, width: PROGRESS_ROW.frameWidth }}>
              {endingProgressOf(row, gained)}%
            </div>
          </div>
        )
      })}

      {(tab === 2 || tab === 3) && (
        <TotalRow
          frames={frames}
          textFrames={textFrames}
          value={tab === 2
            ? `${collection.skills.length}/${ORIGINAL_SKILLS.length}`
            // 탭 3 은 쪽(갈래)마다 얻은 수 [skin+0x124] / 칸 수 — "!C!cffff00%d/%d" (0x2f8ee~0x2f8fa)
            : `${ownedNicknameCountOf(page, collection.titles)}/${NICKNAME_PAGE_TOTALS[page] ?? 0}`}
        />
      )}

      {tab === 4 && (
        // 통계 합계는 `"!R!cFFFF00…G"` 오른쪽 맞춤 (0x58870)
        <TotalRow frames={frames} textFrames={textFrames} value={statTotalTextOf(page) ?? ''} isRightAligned />
      )}

      </div>

      {/* 머리띠·바닥 — 그리기 꼬리 0x2fc1e `0x54d95(skin, 0, 5)` (판 자르기를 푼 뒤라 안 잘린다).
          들어옴 0x2407c 가 [skin+0x84] = 0 이라 미끄러지지 않는다. 되돌아가기는 CLR 과 같은 일 */}
      <ScreenFrame title="2010프로야구" gamePoint={gamePoint} footer={5} slides={false}
        onBack={() => isPanelOpen && pressClear()} />
    </RawScreen>
  )
}

interface CellItem {
  readonly name: string
  readonly isGained: boolean
  /** 얻은 칸 프레임 — 없으면 격자 공통 값 (진행 탭은 칸마다 다르다, `endingCellFrameOf`) */
  readonly gainedFrame?: number
}

/**
 * 41×25 칸 격자 4열 (탭 1 진행 · 탭 2 스킬). 칸 번호 `윗줄 × 4` ~ `(윗줄 + 3) × 4 − 1` 을 그린다(0x2ebcc~0x2ebe0) —
 * 보이는 i 번째 칸 = 번호 − 윗줄 × 4.
 */
function CellGrid({
  frames, items, gainedFrame, cursor, top, hasDownMark: isDownMarkShown, isCursorShown, isBlinking, cursorShake, onSelect,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly items: readonly CellItem[]
  readonly gainedFrame: number
  readonly cursor: number
  readonly top: number
  readonly hasDownMark: boolean
  readonly isCursorShown: boolean
  readonly isBlinking: boolean
  /** 고른 칸만 이만큼 옮겨 그린다 — 칸·이름·테두리 모두 (0x2ec52 가 x·y 자체를 바꾼다) */
  readonly cursorShake: { readonly dx: number; readonly dy: number } | null
  readonly onSelect: (index: number) => void
}) {
  const visible = CELL_GRID.columns * VISIBLE_GRID_ROWS
  const start = top * CELL_GRID.columns

  return (
    <>
      {items.slice(start, start + visible).map((item, offset) => {
        const index = start + offset
        const base = cellPositionOf(offset)
        const shift = index === cursor && cursorShake !== null ? cursorShake : { dx: 0, dy: 0 }
        const x = base.x + shift.dx
        const y = base.y + shift.dy
        return (
          <div key={item.name + index}>
            <FrameSprite folder={SLT_FRAMES} frame={item.isGained ? (item.gainedFrame ?? gainedFrame) : CELL_FRAMES.locked}
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
            {index === cursor && isCursorShown && (
              <FrameSprite folder={SLT_FRAMES} frame={CELL_FRAMES.cursor} origins={frames} x={x - 1} y={y - 1} />
            )}
            <button type="button" className={styles.cell} aria-label={item.isGained ? item.name : '???'}
              style={{ left: x, top: y, width: CELL_GRID.width, height: CELL_GRID.height }}
              onClick={() => onSelect(index)} />
          </div>
        )
      })}
      {top > 0 && (
        <FrameSprite folder={SLT_FRAMES} frame={SCROLL_MARKS.up.frame} origins={frames}
          x={SCROLL_MARKS.x} y={isBlinking ? SCROLL_MARKS.up.yOn : SCROLL_MARKS.up.yOff} />
      )}
      {isDownMarkShown && (
        <FrameSprite folder={SLT_FRAMES} frame={SCROLL_MARKS.down.frame} origins={frames}
          x={SCROLL_MARKS.x} y={isBlinking ? SCROLL_MARKS.down.yOn : SCROLL_MARKS.down.yOff} />
      )}
    </>
  )
}

/**
 * 흐르는 글 카운터 [skin+0x284] — 메인 메뉴 객체(앱에 하나, 0x2ed8 → 0x53b24 → 0x5390c 가 만든다)의 칸이라
 * 기록연감을 나갔다 들어와도, 탭·초점·고른 줄이 바뀌어도 이어진다. 0 으로 지우는 곳은 둘뿐이다(직접 떴다):
 * 객체를 만들 때 0x5390c(0x53a00~0x53a08) · 메인 메뉴 상태 15(대전, 0x31918) 의 0x31c60~0x31c6a.
 * 같은 칸을 0x5a8c8 을 부르는 다른 화면(0x2785c · 0x4a384 · 0x5b798 선수 정보 창 · 0x7c450)도 올리지만
 * 웹은 아직 그 화면들의 흐르는 글을 이 칸에 잇지 않았다 — 기록연감 설명만 센다.
 */
const skinTickerCounter = { value: 0 }
/** 앱을 새로 띄운 것과 같다 (0x5390c) — 테스트용 */
export const resetSkinTickerCounter = () => {
  skinTickerCounter.value = 0
}

/**
 * 탭 0 설명 — 흐르는 글 0x5a8c8. [skin+0x284] 로 x 를 정해 그린 **뒤** 3 올린다(0x5a958~0x5a962) —
 * 그래서 올리기는 그림이 화면에 나간 뒤(effect)에 한다.
 */
function DescriptionTicker({ text, tick }: { readonly text: string; readonly tick: number }) {
  const lastDrawnTick = useRef(tick - 1)
  useEffect(() => {
    skinTickerCounter.value += DESCRIPTION_TICKER.step * Math.max(0, tick - lastDrawnTick.current)
    lastDrawnTick.current = tick
  }, [tick])
  // 건너뛴 갱신(그림을 못 낸 틱)도 원본에선 한 번씩 그렸다 — 그만큼 앞당겨 센 값으로 그린다
  const counter = skinTickerCounter.value + DESCRIPTION_TICKER.step * Math.max(0, tick - lastDrawnTick.current - 1)
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)
  useLayoutEffect(() => setTextWidth(textRef.current?.offsetWidth ?? 0), [text])
  const segments = parseGameMarkup(`!cffffff${text}`).flatMap((line) => line.segments)
  const { x, y, width, height, clipInset } = DESCRIPTION_TICKER
  return (
    <div className={styles.tickerClip} data-testid="기록-설명"
      style={{ left: x + clipInset, top: y, width: width - clipInset * 2, height }}>
      <span ref={textRef} className={styles.tickerText}
        style={{ left: tickerTextXOf(counter, textWidth) - (x + clipInset) }}>
        {segments.map((segment, index) => (
          <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
        ))}
      </span>
    </div>
  )
}

/** 본문 키 → 방향. 격자 꼴 1 은 숫자 2·4·6·8 을 ↑ ← → ↓ 로 바꾼다 (0x6c096, 표 0xd2e7c) */
function annalsDirectionOf(key: string): AnnalsDirection | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  if (key === 'ArrowLeft' || key === '4') return 'left'
  if (key === 'ArrowRight' || key === '6') return 'right'
  return null
}

/** 쪽(갈래) p 의 칸 i 를 얻었는가 — 0x61d90(mgr, p, i). 웹은 칭호를 이름으로 들고 있어 이름 첫 번호를 더해 찾는다 */
const isNicknameOwned = (page: number, index: number, owned: readonly string[]) =>
  owned.includes(TITLE_NAMES[(NICKNAME_PAGE_FIRST_NAMES[page] ?? 0) + index] ?? '')
/** 쪽(갈래)에서 얻은 수 [skin+0x124] — 그릴 때마다 0 에서 센다 (0x2f5d8~0x2f692) */
const ownedNicknameCountOf = (page: number, owned: readonly string[]) =>
  Array.from({ length: NICKNAME_PAGE_TOTALS[page] ?? 0 }, (_, index) => index)
    .filter((index) => isNicknameOwned(page, index, owned)).length

/**
 * 탭 3 닉네임 (0x2f4ee~0x2f920) — 쪽 제목 · 164×18 이름 줄 8개 · 스크롤 막대.
 * ```
 * 노란 네모 slt_frame 이미지 38 (34, 78) · 쪽 제목 img_text 표 0xced88[쪽] (42, 76) · "닉네임" img_text 279 (44 + 제목폭, 76)
 * 0x58c10 → 보이는 칸 [윗줄, min(윗줄 + 8, 개수)) + 스크롤 막대 (203, 94)
 * 칸 i (k = i − 윗줄): 프레임 12 (33, 89 + 19k) · 번호 i + 1 (48, 93 + 19k)
 *                     얻었으면 이름 StrNICKNAME[첫 번호 + i] (70, 93 + 19k) — 못 얻었으면 이름 자리를 비운다
 * ```
 * 줄 커서는 그리지 않는다 (탭 3 은 0x7a571 을 안 부른다).
 */
function NameRows({
  frames, textFrames, page, scroll, owned,
}: {
  readonly frames: ReturnType<typeof useFrameOrigins>
  readonly textFrames: ReturnType<typeof useFrameOrigins>
  readonly page: number
  readonly scroll: NicknameScroll
  readonly owned: readonly string[]
}) {
  const end = Math.min(scroll.top + NICKNAME_VISIBLE_ROWS, scroll.total)
  const indices = Array.from({ length: Math.max(0, end - scroll.top) }, (_, offset) => scroll.top + offset)
  const titleFrame = NICKNAME_PAGE_TITLE_FRAMES[page] ?? NICKNAME_PAGE_TITLE_FRAMES[0]
  const { x: barX, y: barY } = NICKNAME_SCROLLBAR
  return (
    <>
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, PAGE_TITLE.bulletImage)}
        style={{ left: PAGE_TITLE.bulletX, top: PAGE_TITLE.bulletY }} />
      <FrameSprite folder={IMG_TEXT} frame={titleFrame} origins={textFrames} x={PAGE_TITLE.x} y={PAGE_TITLE.y} />
      <FrameSprite folder={IMG_TEXT} frame={NICKNAME_TAB_LABEL.frame} origins={textFrames}
        x={PAGE_TITLE.x + nameWidthOf(textFrames, titleFrame) + NICKNAME_TAB_LABEL.gap} y={PAGE_TITLE.y} />
      {indices.map((index, offset) => {
        const y = NAME_ROW.firstY + NAME_ROW.step * offset
        const name = TITLE_NAMES[(NICKNAME_PAGE_FIRST_NAMES[page] ?? 0) + index] ?? ''
        return (
          <div key={index} data-testid={`닉네임-줄-${index}`}>
            <FrameSprite folder={SLT_FRAMES} frame={NAME_ROW.frame} origins={frames} x={NAME_ROW.x} y={y} />
            <div className={styles.rowText} style={{ left: NAME_ROW.numberX, top: y + 4 }}>
              {index + 1}
            </div>
            {isNicknameOwned(page, index, owned) && (
              <div className={styles.rowText} style={{ left: NAME_ROW.nameX, top: y + 4, width: 110 }}>
                {name}
              </div>
            )}
          </div>
        )
      })}
      {/* 스크롤 막대 0x58c10 — 길 · ▲▼ · 흰 막대 */}
      <div className={styles.scrollTrack} data-testid="닉네임-스크롤"
        style={{ left: barX, top: barY, width: NICKNAME_SCROLLBAR.width, height: NICKNAME_SCROLL_TRACK + 2,
          background: NICKNAME_SCROLLBAR.trackColor }} />
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, NICKNAME_SCROLLBAR.arrowImage)}
        style={{ left: barX, top: barY + NICKNAME_SCROLLBAR.arrowDy }} />
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, NICKNAME_SCROLLBAR.arrowImage)}
        style={{ left: barX, top: barY + NICKNAME_SCROLL_TRACK + 1, transform: 'scaleY(-1)' }} />
      <div className={styles.scrollThumb} data-testid="닉네임-스크롤-막대"
        style={{ left: barX + 1, top: barY + scroll.thumb + 1, width: NICKNAME_SCROLLBAR.thumbWidth, height: scroll.thumbLength }} />
    </>
  )
}

/** 탭 0·4 칸 바탕 — slt_frame 프레임 10 · 11(탭 0 쪽 5) · 13(탭 4) 을 (칸 x − 1, 칸 y − 1) 에 (0x7a916 · 0x7a9cc) */
function ListRowFrames({
  frames, tab, page,
}: { readonly frames: ReturnType<typeof useFrameOrigins>; readonly tab: number; readonly page: number }) {
  return (
    <>
      {Array.from({ length: LIST_GRID.rows }, (_, row) => (
        <FrameSprite key={row} folder={SLT_FRAMES} frame={listRowFrameOf(tab, page)} origins={frames}
          x={LIST_GRID.x} y={listFirstYOf(tab) + LIST_GRID.step * row + LIST_ROW_FRAME_DY} />
      ))}
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
        const top = listFirstYOf(4) + LIST_GRID.step * row
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
