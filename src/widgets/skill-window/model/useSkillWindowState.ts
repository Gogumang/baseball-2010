import { useState } from 'react'
import {
  ITEM_COLUMNS,
  ITEM_ROWS,
  SKILL_COLUMNS,
  gridIndexOf,
  moveGridCursor,
  scrolledTopRowOf,
  skillGridRowsOf,
  skillListOf,
} from '@/widgets/skill-window/lib/skillWindowLayout'
import type { GridCursor, GridDirection } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { SkillWindowSide } from '@/widgets/skill-window/lib/skillWindowText'
import type { SkillWindowCareer, SkillWindowFocus, SkillWindowPrompt } from '@/widgets/skill-window/model/skillWindowCareer'
import { applySkillConfirm } from '@/widgets/skill-window/model/skillConfirm'

const START: GridCursor = { column: 0, row: 0 }

export interface SkillWindowStateInput {
  readonly career: SkillWindowCareer
  readonly side: SkillWindowSide
  readonly onEquip: (skillId: number, on: boolean) => void
  readonly onExpandSlots: () => void
}

/**
 * 창의 칸 — 탭 · 키 자리 · 두 격자 커서 · 굴림 · 대화. **들어올 때** (진입 0x116a0): `[win+0x1a8]` = 0(탭에 커서), 채우기 0x81618 이
 * 탭 커서를 "스킬" 에 두고 목록 셋을 (0,0) 으로 되돌린다
 */
export function useSkillWindowState({ career, side, onEquip, onExpandSlots }: SkillWindowStateInput) {
  const skills = skillListOf(career.skillIds)
  const skillRows = skillGridRowsOf(skills.length)
  const [tab, setTab] = useState(0)
  const [focus, setFocus] = useState<SkillWindowFocus>('탭')
  const [skillCursor, setSkillCursor] = useState<GridCursor>(START)
  const [topRow, setTopRow] = useState(0)
  const [itemCursor, setItemCursor] = useState<GridCursor>(START)
  const [prompt, setPrompt] = useState<SkillWindowPrompt | null>(null)

  /** 확인 키 — 0x13140. 고른 칸은 0x85ad0 `[win+0x1e4 + 4 × 칸번호]` */
  const confirm = (index: number) => {
    const skillId = skills[index]
    if (skillId === undefined) return
    applySkillConfirm({ career, side, showPrompt: setPrompt, onEquip, onExpandSlots }, skillId)
  }
  /** 확인(−5·'5')·아래(−2·'8') = 격자로 들어가며 두 격자 커서를 (0,0) 으로 (0x81a28) */
  const enterGrid = () => {
    setFocus('격자')
    setSkillCursor(START)
    setTopRow(0)
    setItemCursor(START)
  }
  /** 격자의 취소 — 탭으로 돌아가며 스킬 격자 커서·굴림을 (0,0) 으로 (0x8460c) */
  const leaveGrid = () => {
    setFocus('탭')
    setSkillCursor(START)
    setTopRow(0)
  }
  /** 그 탭의 격자 이동(0x6c298, 감기 + 굴림) */
  const moveInGrid = (direction: GridDirection) => {
    if (tab === 0) {
      const next = moveGridCursor(skillCursor, direction, SKILL_COLUMNS, skillRows)
      setSkillCursor(next)
      setTopRow(scrolledTopRowOf(topRow, next.row))
      return
    }
    setItemCursor(moveGridCursor(itemCursor, direction, ITEM_COLUMNS, ITEM_ROWS))
  }
  const confirmAtCursor = () => confirm(gridIndexOf(skillCursor, SKILL_COLUMNS))

  return {
    skills,
    skillRows,
    tab,
    setTab,
    focus,
    setFocus,
    skillCursor,
    setSkillCursor,
    topRow,
    itemCursor,
    setItemCursor,
    prompt,
    setPrompt,
    confirm,
    confirmAtCursor,
    enterGrid,
    leaveGrid,
    moveInGrid,
  }
}

export type SkillWindowState = ReturnType<typeof useSkillWindowState>
