import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { MODE_UI_FRAME, SKILL_WINDOW_COLORS, TAB_BOXES, TAB_LABEL_FRAMES } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'
import { centeredTextFrameOf, MODE_UI } from '@/widgets/skill-window/ui/skillWindow/glyphs'
import * as styles from '@/widgets/skill-window/ui/SkillWindow.css'

interface TabStripProps {
  readonly state: SkillWindowState
  readonly modeUiOrigins: FrameOrigins | null
  readonly textOrigins: FrameOrigins | null
  readonly isBlinkOn: boolean
}

/** 탭 띠 — 고른 탭이 흰 탭인 mode_ui 프레임 36/37 을 원점 (0,0) 에. 탭 글 · 깜빡이는 탭 커서 · 누름 자리 */
export function TabStrip({ state, modeUiOrigins, textOrigins, isBlinkOn }: TabStripProps) {
  const { tab, focus } = state
  return (
    <>
      <FrameSprite folder={MODE_UI} frame={tab === 0 ? MODE_UI_FRAME.스킬탭띠 : MODE_UI_FRAME.서브아이템탭띠} origins={modeUiOrigins} x={0} y={0} />
      {TAB_LABEL_FRAMES.map((frame, index) =>
        centeredTextFrameOf(textOrigins, frame, TAB_BOXES[index], {
          tint: index === tab ? SKILL_WINDOW_COLORS.tabOn : SKILL_WINDOW_COLORS.tabOff,
        }),
      )}
      {focus === '탭' && isBlinkOn && (
        <FrameSprite folder={MODE_UI} frame={MODE_UI_FRAME.탭커서} origins={modeUiOrigins} x={TAB_BOXES[tab].x} y={TAB_BOXES[tab].y} />
      )}
      {TAB_BOXES.map((area, index) => (
        <button
          key={index}
          type="button"
          className={styles.hitArea}
          aria-label={index === 0 ? '스킬' : '서브아이템'}
          aria-pressed={index === tab}
          style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
          onClick={(event) => {
            event.stopPropagation()
            state.setTab(index)
            state.setFocus('탭')
          }}
        />
      ))}
    </>
  )
}
