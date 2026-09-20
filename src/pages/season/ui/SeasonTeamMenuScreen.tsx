import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { TEAM_MENU, teamMenuTarget } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'

export type TeamMenuItem = (typeof TEAM_MENU)[number]

export interface SeasonTeamMenuScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 원본 하위 4칸(키 `0x4e40`)이 가는 장면 상태를 함께 넘긴다:
   * 0 구장관리 0xea · 1 트레이드 0xe4 · 2 선수영입 0xe2 · 3 코치채용 = 선수단 0xd7(this+0x11c = 2).
   */
  readonly onSelect: (item: TeamMenuItem, target: SeasonSceneState) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 구단관리 하위 메뉴 (장면 0x105 상태 **0xce**, 갱신 0x47d8 · 키 0x4e40) — P4 1b 확정.
 *
 * StrHOWTO[21] "구단 관리 커맨드" 가 네 칸을 그대로 설명한다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xce 에는 그리기 함수가 따로 없고(상태표의 그림 칸이 비어 있다)
 * 관리 메뉴 화면 위에서 하위 메뉴만 바뀌는 것으로 보이지만 좌표를 확인하지 못했다.
 * 여기서는 관리 메뉴와 같은 공용 판 목록으로 그린다.
 */
export function SeasonTeamMenuScreen({ state, onSelect, onBack }: SeasonTeamMenuScreenProps) {
  const rows: readonly SeasonListRow[] = TEAM_MENU.map((label) => ({ id: label, label }))

  const select = (index: number) => {
    const target = teamMenuTarget(index)
    if (target === null) return
    onSelect(TEAM_MENU[index], target)
  }
  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: select, onCancel: onBack })

  return (
    <RawScreen>
      <SeasonListWindow
        title="구단관리"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onBack}
        footer={'구장관리 · 트레이드 · 선수영입 · 코치채용'}
      />
      <SeasonStatusBar record={state.record} teamMorale={state.teamMorale} />
    </RawScreen>
  )
}
