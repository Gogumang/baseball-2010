import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_ITEM_MENU } from '@/widgets/season/lib/seasonItemMenu'
import type { ItemWindowKind, SeasonItemMenuEntry } from '@/widgets/season/lib/seasonItemMenu'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface SeasonItemMenuScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 그 칸이 여는 **아이템 창 종류**(`[win+0x1a4]`)와 가는 장면 상태를 함께 넘긴다.
   *
   * - 장비(종류 3) → **선수 고르기 0xdf** (`this+0x110 = 1`) → 그 선수의 상점 0xdc.
   *   취소하면 다시 이 화면(0xd0)으로 온다 (P4 5절).
   * - GP아이템(종류 2) → 곧장 **아이템 상점 0xdc**.
   */
  readonly onSelect: (item: SeasonItemMenuEntry, target: SeasonSceneState, windowKind: ItemWindowKind) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 시즌 아이템 하위 메뉴 (장면 0x105 상태 **0xd0**, 갱신 0x4d04 · 키 **0x4da4** · 그리기 0x7538).
 *
 * 관리 메뉴 칸 4 에서 들어와 아이템 상점 **0xdc** 로 가는 길목이다 (P4 1a·1b·5 절).
 *
 * ⚠️ **칸 수·차례는 근사**다 — 0xd0 의 갱신·그리기가 안 풀려서 StrHOWTO[18]
 * "[아이템] : 장비, GP아이템" 두 칸만 뒀다. 서브아이템 상점(창 종류 1)이 어느 칸인지는
 * 문서에 없어 지어내지 않았다 (`widgets/season/lib/seasonItemMenu.ts` 머리 주석).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xd0 의 그리기는 **공통 틀**(0x9f60) 하나뿐이라 줄 좌표가 없다.
 * 다른 시즌 화면들과 같은 공용 판 (24, 54, 192, 212) 목록으로 그린다.
 */
export function SeasonItemMenuScreen({ state, onSelect, onBack }: SeasonItemMenuScreenProps) {
  const rows: readonly SeasonListRow[] = SEASON_ITEM_MENU.map((entry) => ({
    id: entry.label,
    label: entry.label,
  }))

  const select = (index: number) => {
    const entry = SEASON_ITEM_MENU[index]
    if (entry === undefined) return
    onSelect(entry, entry.target, entry.windowKind)
  }
  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: select, onCancel: onBack })

  return (
    <RawScreen>
      <SeasonListWindow
        title="아이템"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onBack}
        footer={SEASON_ITEM_MENU[cursor]?.description ?? ''}
      />
      <SeasonStatusBar record={state.record} teamMorale={state.teamMorale} />
    </RawScreen>
  )
}
