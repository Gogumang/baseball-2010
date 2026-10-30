import { LIST_ROW, listCursorOf, listRowTopOf } from '@/pages/match-settings/lib/matchSettingsLayout'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { OriginSprite } from './OriginSprite'
import { Outline } from './Outline'
import { SLT_FRAMES } from './settingsAssets'
import type { SettingsDraw } from './settingsDraw'

/** 종류 줄 · 이닝 값 줄 — slt_frame 프레임 15 위에 이름 그림, 깜빡이면 노랑 커서. 줄을 누르면 그 줄로 옮긴 창으로 OK */
export function SettingsListRows({
  draw,
  frames,
  labels,
  selected,
  moved,
  pressAt,
}: {
  readonly draw: SettingsDraw
  readonly frames: readonly number[]
  readonly labels: readonly string[]
  readonly selected: number
  readonly moved: (index: number) => MatchSettingsWindowState
  readonly pressAt: (moved: MatchSettingsWindowState) => void
}) {
  return (
    <>
      {frames.map((frame, index) => (
        <span key={`row-${frame}`}>
          <OriginSprite folder={SLT_FRAMES} frame={LIST_ROW.frame} origins={draw.sltOrigins} x={LIST_ROW.x} y={listRowTopOf(index)} />
          {draw.centeredText(frame, LIST_ROW.x + (LIST_ROW.width >> 1), listRowTopOf(index) + LIST_ROW.labelDy)}
          <button
            type="button"
            className={styles.hitArea}
            aria-label={labels[index]}
            aria-current={index === selected}
            data-frame={frame}
            style={{ left: LIST_ROW.x, top: listRowTopOf(index), width: LIST_ROW.width, height: LIST_ROW.height }}
            onClick={() => pressAt(moved(index))}
          />
        </span>
      ))}
      {draw.isBlinkOn && <Outline outline={listCursorOf(selected)} />}
    </>
  )
}
