import { IMG_TEXT_PALETTE, TAB, TAB_LABEL_FRAMES } from '@/pages/match-settings/lib/matchSettingsLayout'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { SLT_IMAGES, pngOf } from './settingsAssets'
import type { ImgText } from './settingsDraw'

/** 꼬리 탭 — 이미지 40 좌우 뒤집기 + 종류 이름(팔레트 1) */
export function SettingsTab({ text, kind, isDetail }: { readonly text: ImgText; readonly kind: number; readonly isDetail: boolean }) {
  return (
    <>
      <img
        className={`${styles.layer} ${styles.mirrored}`}
        alt=""
        src={pngOf(SLT_IMAGES, TAB.image)}
        style={{ left: TAB.x, top: isDetail ? TAB.detailY : TAB.smallY }}
      />
      {text(TAB_LABEL_FRAMES[kind] ?? 0, TAB.labelX, isDetail ? TAB.detailLabelY : TAB.smallLabelY, IMG_TEXT_PALETTE.노랑)}
    </>
  )
}
