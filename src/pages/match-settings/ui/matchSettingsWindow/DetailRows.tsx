import { DETAIL_ROW } from '@/pages/match-settings/lib/matchSettingsMenu'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import { DETAIL_ARROWS, DETAIL_OK, detailDownArrowYOf, detailUpArrowYOf } from '@/pages/match-settings/lib/matchSettingsLayout'
import { DETAIL_CONFIRM_LABEL, DETAIL_ROW_LABELS } from '@/pages/match-settings/lib/matchSettingsText'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { DetailRow } from './DetailRow'
import { OriginSprite } from './OriginSprite'
import { POPUP_FRAMES, SLT_IMAGES, pngOf } from './settingsAssets'
import type { SettingsDraw } from './settingsDraw'

/** 상세 단계 — 위아래 화살표(깜빡이면 출렁) · 상세 줄들 · 확인 칸. 칸을 누르면 그 줄 · 칸으로 옮긴 창으로 OK */
export function DetailRows({
  draw,
  state,
  pressAt,
}: {
  readonly draw: SettingsDraw
  readonly state: MatchSettingsWindowState
  readonly pressAt: (moved: MatchSettingsWindowState) => void
}) {
  const bob = draw.isBlinkOn ? DETAIL_ARROWS.bob : 0
  const isOkRow = state.detailRow === DETAIL_ROW.확인
  return (
    <>
      <img className={styles.layer} alt="" src={pngOf(SLT_IMAGES, DETAIL_ARROWS.up)} style={{ left: DETAIL_ARROWS.x, top: detailUpArrowYOf(bob) }} />
      <img
        className={styles.layer}
        alt=""
        src={pngOf(SLT_IMAGES, DETAIL_ARROWS.down)}
        style={{ left: DETAIL_ARROWS.x, top: detailDownArrowYOf(bob) }}
      />
      {DETAIL_ROW_LABELS.map((label, row) => (
        <DetailRow
          key={label}
          row={row}
          label={label}
          state={state}
          isBlinkOn={draw.isBlinkOn}
          text={draw.text}
          sltOrigins={draw.sltOrigins}
          onPress={(cell) => pressAt({ ...state, detailRow: row, detailCell: cell })}
        />
      ))}
      <OriginSprite
        folder={POPUP_FRAMES}
        origins={draw.popupOrigins}
        frame={isOkRow ? DETAIL_OK.selectedFrame : DETAIL_OK.frame}
        x={DETAIL_OK.x}
        y={DETAIL_OK.y}
      />
      <button
        type="button"
        className={styles.hitArea}
        aria-label={DETAIL_CONFIRM_LABEL}
        aria-current={isOkRow}
        style={{ left: DETAIL_OK.x, top: DETAIL_OK.y, width: DETAIL_OK.width, height: DETAIL_OK.height }}
        onClick={() => pressAt({ ...state, detailRow: DETAIL_ROW.확인 })}
      />
    </>
  )
}
