import type { ReactNode } from 'react'
import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_INFO_MENU } from '@/widgets/season/lib/seasonInfoMenu'
import type { SeasonInfoMenuEntry } from '@/widgets/season/lib/seasonInfoMenu'
import { SEASON_SUB_COMMAND_SLOTS, seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export interface SeasonInfoScreenProps {
  readonly state: SeasonState
  /** 칸을 골랐다 — 칸이 하는 일(`SeasonInfoMenuEntry.action`, 키 0x9008)은 부르는 쪽이 한다 */
  readonly onSelect: (entry: SeasonInfoMenuEntry, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 (0x9008 의 0x909a) */
  readonly onBack: () => void
  /**
   * 메뉴 객체 this+0x74 의 커서 — 장면이 사는 동안 남는다. 관리 메뉴에서 들어올 때만 0 이다(0x4d58).
   * 안 주면 화면이 0 에서 들고 시작한다.
   */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
  /** 팝업(기록순위 창 0x80)이 떠 있으면 메뉴는 키를 안 받는다 (0x9008 머리 `[this+0xc0]+0x99`) */
  readonly isKeyEnabled?: boolean
  /** 메뉴 위에 얹을 팝업 */
  readonly overlay?: ReactNode
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint?: number
}

/**
 * 시즌정보 (장면 0x105 상태 **0xcd**) — 관리 메뉴 칸 0 에서 들어오는 네 칸 하위 메뉴
 * (0 구단정보 → 0xd5 · 1 아이템 → 0xd6 · 2 선수정보 → 선수 고르기 0xdf 목적 2 · 3 기록순위 → 창 0x80 → 0xdb).
 * 칸 차례·글은 `widgets/season/lib/seasonInfoMenu.ts` 머리 주석 (0x9008 · 0x7e84c 직접 떴다).
 *
 * 그리기는 공통 틀(`SeasonCommonFrame` — 커맨드 줄 0x7e418 하위 칸(표 0xd47e4 · 0xd47ec) · 부모 칸 시즌정보 ·
 * 상태판 0x7d34c · 가운데 판 0x7f814 · 머리띠 0x7f4ec). 칸 등장은 틀 0x7538 의 0x8003c.
 */
export function SeasonInfoScreen({
  state, onSelect, onBack, cursor: heldCursor, onCursorChange, isKeyEnabled = true, overlay, gamePoint = 0,
}: SeasonInfoScreenProps) {

  const select = (index: number) => {
    const entry = SEASON_INFO_MENU[index]
    if (entry === undefined) return
    onSelect(entry, index)
  }
  const { cursor, moveTo } = useSeasonCursor({
    count: SEASON_INFO_MENU.length, onSelect: select, onCancel: onBack, isEnabled: isKeyEnabled,
    ...(heldCursor === undefined ? {} : { cursor: heldCursor }),
    ...(onCursorChange === undefined ? {} : { onCursorChange }),
  })

  return (
    <RawScreen>
      <div role="group" aria-label="시즌정보">
        <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={onBack}
          commandBar={{
            slots: SEASON_SUB_COMMAND_SLOTS.시즌정보, cursor, parent: seasonParentSlotOf('시즌정보'),
            onHover: moveTo,
            onSelect: (id) => select(SEASON_INFO_MENU.findIndex((entry) => entry.label === id)),
          }} />
      </div>
      {overlay}
    </RawScreen>
  )
}
