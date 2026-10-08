import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_ITEM_MENU } from '@/widgets/season/lib/seasonItemMenu'
import type { ItemWindowKind, SeasonItemMenuEntry } from '@/widgets/season/lib/seasonItemMenu'
import { SEASON_SUB_COMMAND_SLOTS, seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface SeasonItemMenuScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 그 칸이 여는 **아이템 창 종류**(`[win+0x1a4]`)와 가는 장면 상태를 함께 넘긴다.
   *
   * - 칸 0 장착아이템(종류 3) → **선수 고르기 0xdf** (`this+0x110 = 1`) → 그 선수의 상점 0xdc.
   *   취소하면 다시 이 화면(0xd0)으로 온다 (P4 5절).
   * - 칸 1 구장아이템(4) · 2 서브아이템(1) · 3 GP아이템(2) → 곧장 **아이템 상점 0xdc**.
   */
  readonly onSelect: (item: SeasonItemMenuEntry, target: SeasonSceneState, windowKind: ItemWindowKind) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint?: number
  /**
   * 메뉴 객체 this+0x88 의 커서 — 장면이 사는 동안 남는다. 0x4d04 는 **이전 상태가 0xc9 일 때만** (0,0) 으로 지워
   * 상점·선수 고르기에서 돌아오면 고른 칸에 그대로 있다 (`menuCursorsOnEnter`). 안 주면 화면이 0 부터 들고 있다.
   */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
}

/**
 * 시즌 아이템 하위 메뉴 (장면 0x105 상태 **0xd0**, 갱신 0x4d04 · 키 **0x4da4** · 그리기 공통 틀 0x9f60).
 *
 * 관리 메뉴 칸 4 에서 들어와 칸 0 은 선수 고르기 0xdf, 나머지는 아이템 상점 **0xdc** 로 간다.
 * 칸 넷과 차례·창 종류는 `widgets/season/lib/seasonItemMenu.ts` 머리 주석 (0x4da4 · 0x5f3c 직접 떴다).
 *
 * 그리기는 공통 틀(`SeasonCommonFrame`) — 커맨드 줄 하위 칸(표 0xd47b0 · 0xd47b8: 100 장착아이템 · 288 구장아이템 ·
 * 105 서브아이템 · 110 GP아이템)과 부모 칸 아이템.
 */
export function SeasonItemMenuScreen({
  state, onSelect, onBack, gamePoint = 0, cursor: heldCursor, onCursorChange,
}: SeasonItemMenuScreenProps) {

  const select = (index: number) => {
    const entry = SEASON_ITEM_MENU[index]
    if (entry === undefined) return
    onSelect(entry, entry.target, entry.windowKind)
  }
  const { cursor, moveTo } = useSeasonCursor({
    count: SEASON_ITEM_MENU.length, onSelect: select, onCancel: onBack, cursor: heldCursor, onCursorChange,
  })

  return (
    <RawScreen>
      <div role="group" aria-label="아이템">
        <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={onBack}
          commandBar={{
            slots: SEASON_SUB_COMMAND_SLOTS.아이템, cursor, parent: seasonParentSlotOf('아이템'),
            onHover: moveTo,
            onSelect: (id) => select(SEASON_ITEM_MENU.findIndex((entry) => entry.label === id)),
          }} />
      </div>
    </RawScreen>
  )
}
