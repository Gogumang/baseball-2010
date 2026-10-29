import { FrameSprite } from '@/shared/ui'
import {
  TAB_BAR,
  TAB_CURSOR,
  TAB_NAMES,
  TAB_NAME_FRAMES,
  TAB_NAME_Y,
  tabIconWidthOf,
  tabIconXOf,
  tabNameXOf,
  tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { IMG_TEXT, SLT_FRAMES, nameWidthOf } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { RecordAnnalsState } from '@/pages/record/ui/recordAnnals/useRecordAnnals'

/** 탭 막대 — 고른 탭만 넓은 칸이라 탭마다 프레임이 다르다. 이름은 고른 탭 하나만 · 안 고른 탭은 막대 그림 안의 아이콘 */
export function AnnalsTabBar({ state }: { readonly state: RecordAnnalsState }) {
  const { tab, frames, textFrames, tabNamePalette, isTabFocused, isBlinking, isPanelOpen, changeTab } = state
  return (
    <>
      <FrameSprite folder={SLT_FRAMES} frame={TAB_BAR.firstFrame + tab} origins={frames} x={TAB_BAR.x} y={TAB_BAR.y} />
      {/* 커서 프레임 9 — 고른 탭 박스 (24 + 박스x, 54). 탭 막대에 초점이 있으면 깜박인다 (0x2e5be) */}
      {(!isTabFocused || isBlinking) && (
        <FrameSprite folder={SLT_FRAMES} frame={TAB_CURSOR.frame} origins={frames} x={tabSlotXOf(tab)} y={TAB_CURSOR.y} />
      )}
      {/* 이름은 고른 탭 하나만 — 박스 안 가운데 맞춤 (0x2e568) */}
      {tabNamePalette.definition}
      <FrameSprite
        folder={IMG_TEXT}
        frame={TAB_NAME_FRAMES[tab]}
        origins={textFrames}
        style={tabNamePalette.style}
        x={tabNameXOf(tab, nameWidthOf(textFrames, TAB_NAME_FRAMES[tab]))}
        y={TAB_NAME_Y}
      />
      {TAB_NAMES.map((name, index) => (
        <button
          key={name}
          type="button"
          className={styles.tab}
          aria-label={name}
          style={{ left: tabIconXOf(index, tab), top: TAB_BAR.y, width: tabIconWidthOf(index, tab), height: TAB_BAR.height }}
          onClick={() => isPanelOpen && changeTab(index)}
        />
      ))}
    </>
  )
}
