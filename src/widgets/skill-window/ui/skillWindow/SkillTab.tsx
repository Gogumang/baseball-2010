import type { ReactNode } from 'react'
import { FrameSprite, MarkupText } from '@/shared/ui'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import type { AnimationEntry, FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { isMinusSkill, isSkillEquipped } from '@/entities/career/model/playerCareer'
import {
  CELL_FRAME,
  DESCRIPTION_BOX,
  EMPTY_CELL_OFFSET,
  NAME_BOX,
  SIDE_LABEL_FRAME,
  SKILL_CELL_BOXES,
  SKILL_COLUMNS,
  SKILL_SIGN_ANIMATION,
  SKILL_SIGN_POSITION,
  SKILL_TEXT_OFFSET,
  gridIndexOf,
  skillCellFrameOf,
} from '@/widgets/skill-window/lib/skillWindowLayout'
import type { LayoutBox } from '@/widgets/skill-window/lib/skillWindowLayout'
import { skillNameOf, skillTableIdOf, type SkillWindowSide } from '@/widgets/skill-window/lib/skillWindowText'
import type { SkillWindowCareer } from '@/widgets/skill-window/model/skillWindowCareer'
import type { SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'
import { equipCountRowOf } from '@/widgets/skill-window/ui/skillWindow/equipCountRow'
import { cellLabelOf, centeredTextFrameOf, MODE_UI } from '@/widgets/skill-window/ui/skillWindow/glyphs'
import * as styles from '@/widgets/skill-window/ui/SkillWindow.css'

export interface SkillTabProps {
  readonly state: SkillWindowState
  readonly career: SkillWindowCareer
  readonly side: SkillWindowSide
  readonly modeUiOrigins: FrameOrigins | null
  readonly textOrigins: FrameOrigins | null
  readonly animations: readonly (readonly AnimationEntry[])[] | null
  readonly update: number
  readonly isBlinkOn: boolean
}

/** 스킬 탭 — 이름 딱지(타자/투수 + 장착 수 / 상한) · 스킬 칸 · 커서 칸의 +/− 표지와 설명 */
export function SkillTab(props: SkillTabProps) {
  const { state, side, textOrigins } = props
  const cursorSkill = state.focus === '격자' ? state.skills[gridIndexOf(state.skillCursor, SKILL_COLUMNS)] : undefined
  return (
    <>
      {centeredTextFrameOf(textOrigins, SIDE_LABEL_FRAME[side], NAME_BOX)}
      {equipCountRowOf(props.career, textOrigins)}
      {SKILL_CELL_BOXES.map((area, cell) => skillCellOf(props, area, cell))}
      {cursorSkill !== undefined && <CursorSkillDescription {...props} skillId={cursorSkill} />}
    </>
  )
}

/** 스킬 칸 하나 — 빈 칸이면 회색 칸, 아니면 칸 그림 · 이름 · 누름 자리. 깜빡이는 커서 */
function skillCellOf(props: SkillTabProps, area: LayoutBox, cell: number): ReactNode[] {
  const { state, career, modeUiOrigins } = props
  const index = cell + state.topRow * SKILL_COLUMNS
  const skillId = state.skills[index]
  const isCursor = state.focus === '격자' && props.isBlinkOn && index === gridIndexOf(state.skillCursor, SKILL_COLUMNS)
  const cursor = isCursor && <FrameSprite key={`c${cell}`} folder={MODE_UI} frame={CELL_FRAME.커서} origins={modeUiOrigins} x={area.x} y={area.y} />
  if (skillId === undefined) {
    return [
      <FrameSprite
        key={`e${cell}`}
        folder={MODE_UI}
        frame={CELL_FRAME.회색}
        origins={modeUiOrigins}
        x={area.x + EMPTY_CELL_OFFSET.x}
        y={area.y + EMPTY_CELL_OFFSET.y}
      />,
      cursor,
    ]
  }
  const name = skillNameOf(props.side, skillId)
  return [
    <FrameSprite
      key={`f${cell}`}
      folder={MODE_UI}
      frame={skillCellFrameOf(skillId, isSkillEquipped(career, skillId))}
      origins={modeUiOrigins}
      x={area.x}
      y={area.y}
    />,
    ...cellLabelOf(`n${cell}`, name, area),
    cursor,
    <button
      key={`b${cell}`}
      type="button"
      className={styles.hitArea}
      aria-label={name}
      aria-pressed={isSkillEquipped(career, skillId)}
      style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
      onClick={(event) => {
        event.stopPropagation()
        state.setFocus('격자')
        state.setSkillCursor({ column: cell % SKILL_COLUMNS, row: state.topRow + Math.trunc(cell / SKILL_COLUMNS) })
        state.confirm(index)
      }}
    />,
  ]
}

/** 커서 칸의 +/− 표지 애니와 설명 · 효과 (StrSKILL[표] · [40 + 표]) */
function CursorSkillDescription({ side, modeUiOrigins, animations, update, skillId }: SkillTabProps & { readonly skillId: number }) {
  const signStep = signStepOf(animations, skillId, update)
  const { description, effect } = skillTextsOf(side, skillId)
  return (
    <>
      {signStep !== null && (
        <FrameSprite
          folder={MODE_UI}
          frame={signStep.frame}
          origins={modeUiOrigins}
          x={SKILL_SIGN_POSITION.x + signStep.dx}
          y={SKILL_SIGN_POSITION.y + signStep.dy}
        />
      )}
      <div
        className={styles.description}
        data-testid="skill-description"
        style={{ left: DESCRIPTION_BOX.x + SKILL_TEXT_OFFSET.x, top: DESCRIPTION_BOX.y + SKILL_TEXT_OFFSET.introY, width: DESCRIPTION_BOX.width }}
      >
        <MarkupText raw={description} />
      </div>
      <div
        className={styles.description}
        style={{ left: DESCRIPTION_BOX.x + SKILL_TEXT_OFFSET.x, top: DESCRIPTION_BOX.y + SKILL_TEXT_OFFSET.effectY, width: DESCRIPTION_BOX.width }}
      >
        <MarkupText raw={`효과 : !cFFFF00${effect}`} />
      </div>
    </>
  )
}

/** 커서 칸의 +/− 표지 애니 칸 — 애니 표가 없으면 null */
function signStepOf(animations: SkillTabProps['animations'], skillId: number, update: number) {
  const entries = animations?.[isMinusSkill(skillId) ? SKILL_SIGN_ANIMATION.마이너스 : SKILL_SIGN_ANIMATION.플러스]
  return entries === undefined ? null : animationStepAt(entries, update)
}

/** 스킬 설명 · 효과 (StrSKILL[표] · [40 + 표]) */
function skillTextsOf(side: SkillWindowSide, skillId: number): { readonly description: string; readonly effect: string } {
  const skill = ORIGINAL_SKILLS[skillTableIdOf(side, skillId)]
  return { description: skill?.description ?? '', effect: skill?.effect ?? '' }
}
