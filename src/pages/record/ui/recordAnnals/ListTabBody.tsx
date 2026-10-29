import { FrameSprite } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { DESCRIPTION_BAR, LIST_CURSOR, LIST_GRID, listFirstYOf } from '@/pages/record/lib/recordAnnalsLayout'
import { RECORD_DESCRIPTIONS } from '@/pages/record/lib/recordDescriptions'
import { isListCursorBlinkOn } from '@/pages/record/lib/annalsGrid'
import { statTotalTextOf } from '@/pages/record/lib/statCells'
import { SLT_FRAMES } from '@/pages/record/ui/recordAnnals/annalsAssets'
import { AchievementMarks, ListRowFrames, ListRows, RecordCounts, StatRows } from '@/pages/record/ui/recordAnnals/ListRows'
import { RECORD_TAB_NAMES } from '@/pages/record/ui/recordAnnals/recordTabNames'
import { DescriptionTicker } from '@/pages/record/ui/recordAnnals/DescriptionTicker'
import { TotalRow } from '@/pages/record/ui/recordAnnals/TotalRow'
import type { RecordAnnalsState } from '@/pages/record/ui/recordAnnals/useRecordAnnals'

/** 탭 0 기록 — 칸 이름 · 달성 횟수 · 달성 표시 · 설명 막대 · (본문 초점) 흐르는 설명 */
function RecordTabRows({ state, collection }: { readonly state: RecordAnnalsState; readonly collection: Collection }) {
  const { page, frames, cursor, isTabFocused, tick } = state
  return (
    <>
      <ListRows page={page} names={RECORD_TAB_NAMES} />
      <RecordCounts page={page} stats={collection.stats} />
      <AchievementMarks page={page} stats={collection.stats} />
      <FrameSprite folder={SLT_FRAMES} frame={DESCRIPTION_BAR.frame} origins={frames} x={DESCRIPTION_BAR.x} y={DESCRIPTION_BAR.y} />
      {!isTabFocused && <DescriptionTicker text={RECORD_DESCRIPTIONS[page * LIST_GRID.rows + cursor] ?? ''} tick={tick} />}
    </>
  )
}

/** 줄 커서 — 칸을 다 그린 뒤 0x7a571 꼬리가 고른 칸 위에 (본문 초점 + 깜박임 켜짐) */
function ListCursor({ state }: { readonly state: RecordAnnalsState }) {
  const { tab, cursor, frames, cursorShake, isTabFocused, tick, listBuiltAt } = state
  if (isTabFocused || !isListCursorBlinkOn(tick - listBuiltAt)) return null
  return (
    <FrameSprite
      folder={SLT_FRAMES}
      frame={LIST_CURSOR.frame}
      origins={frames}
      x={LIST_GRID.x + (cursorShake?.dx ?? 0)}
      y={listFirstYOf(tab) + LIST_GRID.step * cursor + LIST_CURSOR.dy + (cursorShake?.dy ?? 0)}
    />
  )
}

/** 탭 0 기록 · 탭 4 통계 — 1열 8줄 목록 (같은 목록 객체 [mgr+0xe0]) */
export function ListTabBody({ state, collection }: { readonly state: RecordAnnalsState; readonly collection: Collection }) {
  const { tab, page, frames, textFrames } = state
  return (
    <>
      <ListRowFrames frames={frames} tab={tab} page={page} />
      {tab === 0 && <RecordTabRows state={state} collection={collection} />}
      {tab === 4 && <StatRows page={page} stats={collection.stats} />}
      <ListCursor state={state} />
      {/* 통계 합계는 `"!R!cFFFF00…G"` 오른쪽 맞춤 (0x58870) — 탭 4(0x2fa60~0x2faf6)에만 */}
      {tab === 4 && <TotalRow frames={frames} textFrames={textFrames} value={statTotalTextOf(page, collection.stats) ?? ''} isRightAligned />}
    </>
  )
}
