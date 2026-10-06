import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_INFO_MENU } from '@/widgets/season/lib/seasonInfoMenu'
import type { SeasonInfoMenuEntry } from '@/widgets/season/lib/seasonInfoMenu'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
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
}

/**
 * 시즌정보 (장면 0x105 상태 **0xcd**) — 관리 메뉴 칸 0 에서 들어오는 네 칸 하위 메뉴
 * (0 구단정보 → 0xd5 · 1 아이템 → 0xd6 · 2 선수정보 → 선수 고르기 0xdf 목적 2 · 3 기록순위 → 창 0x80 → 0xdb).
 * 칸 차례·글은 `widgets/season/lib/seasonInfoMenu.ts` 머리 주석 (0x9008 · 0x7e84c 직접 떴다).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 그리기는 공통 틀(0x9f60 — 커맨드 줄 0x7e418 · 상태판 0x7d34c · 가운데 판 0x7f814 ·
 * 머리띠 0x7f4ec)이라 하위 메뉴 칸은 커맨드 줄 위에 img_text 글 그림으로 뜬다. 웹은 다른 시즌 하위 메뉴(아이템 0xd0)와
 * 같이 공용 판 목록에 칸 글을 적는다.
 */
export function SeasonInfoScreen({ state, onSelect, onBack, cursor: heldCursor, onCursorChange }: SeasonInfoScreenProps) {
  const rows: readonly SeasonListRow[] = SEASON_INFO_MENU.map((entry) => ({ id: entry.label, label: entry.label }))

  const select = (index: number) => {
    const entry = SEASON_INFO_MENU[index]
    if (entry === undefined) return
    onSelect(entry, index)
  }
  const { cursor, moveTo } = useSeasonCursor({
    count: rows.length, onSelect: select, onCancel: onBack,
    ...(heldCursor === undefined ? {} : { cursor: heldCursor }),
    ...(onCursorChange === undefined ? {} : { onCursorChange }),
  })

  return (
    <RawScreen>
      <SeasonListWindow
        title="시즌정보"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onBack}
      />
      <SeasonStatusBar record={state.record} teamMorale={state.teamMorale} />
    </RawScreen>
  )
}
