import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { gridIndexOf, isBlinkVisible, ITEM_CELL_BOXES, ITEM_COLUMNS, SKILL_VISIBLE_ROWS } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { SkillWindowSide } from '@/widgets/skill-window/lib/skillWindowText'
import type { SkillWindowCareer } from '@/widgets/skill-window/model/skillWindowCareer'
import { useSkillWindowState, type SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'
import { useSkillWindowKeys } from '@/widgets/skill-window/model/useSkillWindowKeys'
import { DescriptionPlate, ItemCellPlate, ItemCursor, NameTag, WindowPlate } from '@/widgets/skill-window/ui/skillWindow/windowPlates'
import { IMG_TEXT, MODE_UI } from '@/widgets/skill-window/ui/skillWindow/glyphs'
import { TabStrip } from '@/widgets/skill-window/ui/skillWindow/TabStrip'
import { SkillTab } from '@/widgets/skill-window/ui/skillWindow/SkillTab'
import { ItemTab } from '@/widgets/skill-window/ui/skillWindow/ItemTab'
import { SkillWindowPromptBox } from '@/widgets/skill-window/ui/skillWindow/SkillWindowPromptBox'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'

export type { SkillWindowCareer } from '@/widgets/skill-window/model/skillWindowCareer'

interface SkillWindowProps {
  readonly career: SkillWindowCareer
  readonly side?: SkillWindowSide
  /** 대화 번호 4(장착)·3(해제) 의 "예" — 0x1483c `0xa4b04(P, s, on)` */
  readonly onEquip: (skillId: number, on: boolean) => void
  /** 대화 번호 6(확장) 의 "예" — 0x1484c. G 가 넉넉할 때만 부른다 */
  readonly onExpandSlots: () => void
  /** 탭에 있을 때의 취소(−16) — 원본은 상태 106(선수정보 하위 메뉴)으로 간다 (0x13168) */
  readonly onClose: () => void
}

/**
 * 아이템/스킬 창 — 하위 상태 122. 창 종류 0 (0x81dc0 · 키 0x13140 → 0x819ad · 대화 0x147b0).
 * 칸 · 확인 키 갈래는 `model/useSkillWindowState` · `model/skillConfirm`, 키는 `model/useSkillWindowKeys`, 그림 조각은 `ui/skillWindow/`.
 */
export function SkillWindow({ career, side = '타자', onEquip, onExpandSlots, onClose }: SkillWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const animations = useAnimations(MODE_UI)
  const update = useUpdateCounter()
  const isBlinkOn = isBlinkVisible(update)
  const state = useSkillWindowState({ career, side, onEquip, onExpandSlots })
  const { tab, prompt } = state

  // 터치 기기 — 스킬이 3행을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 칸은 눌러 고르지만 넷째 행부터는 커서로만 닿는다
  useTouchScrollKeys(offersScrollKeysOf(state))
  useSkillWindowKeys(state, onClose)

  return (
    <div
      className={prompt !== null ? `${windowStyles.overlay} ${windowStyles.overlayWithPopup}` : windowStyles.overlay}
      role="dialog"
      aria-label="아이템/스킬"
      onClick={onClose}
    >
      <WindowPlate />
      <TabStrip state={state} modeUiOrigins={modeUiOrigins} textOrigins={textOrigins} isBlinkOn={isBlinkOn} />

      <InfoPlates state={state} isBlinkOn={isBlinkOn} />

      {tab === 0 && (
        <SkillTab
          state={state}
          career={career}
          side={side}
          modeUiOrigins={modeUiOrigins}
          textOrigins={textOrigins}
          animations={animations}
          update={update}
          isBlinkOn={isBlinkOn}
        />
      )}
      {tab === 1 && <ItemTab state={state} career={career} side={side} />}
      <SkillWindowPromptBox state={state} />
    </div>
  )
}

function offersScrollKeysOf(state: SkillWindowState): boolean {
  return state.prompt === null && state.tab === 0 && state.skillRows > SKILL_VISIBLE_ROWS
}

/** 이름 딱지 · 설명 판, 서브아이템 탭이면 칸 바탕과 깜빡이는 커서 */
function InfoPlates({ state, isBlinkOn }: { readonly state: SkillWindowState; readonly isBlinkOn: boolean }) {
  const isItemTab = state.tab === 1
  const showsItemCursor = isItemTab && state.focus === '격자' && isBlinkOn
  return (
    <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
      <NameTag />
      <DescriptionPlate />
      {isItemTab && ITEM_CELL_BOXES.map((area, index) => <ItemCellPlate key={index} {...area} />)}
      {showsItemCursor && <ItemCursor {...ITEM_CELL_BOXES[gridIndexOf(state.itemCursor, ITEM_COLUMNS)]} />}
    </svg>
  )
}
