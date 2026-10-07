import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { TEAM_MENU, teamMenuTarget } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_SUB_COMMAND_SLOTS, seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

export type TeamMenuItem = (typeof TEAM_MENU)[number]

/** 0x47d8 — SR+0x56 == 1 이면 켬 표 칸 1(트레이드)을 0 으로 */
const TRADE_USED_GRAY: ReadonlySet<string> = new Set([TEAM_MENU[1]])

export interface SeasonTeamMenuScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 원본 하위 4칸(키 `0x4e40`)이 가는 장면 상태를 함께 넘긴다:
   * 0 구장관리 0xea · 1 트레이드 0xe4 · 2 선수영입 0xe2 · 3 코치채용 = 선수단 0xd7(this+0x11c = 2).
   */
  readonly onSelect: (item: TeamMenuItem, target: SeasonSceneState) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
  /** 메뉴 커서 — 원본 메뉴 객체 this+0x78 은 장면이 사는 동안 남는다(세션이 든다). 안 주면 화면이 0 에서 든다 */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint?: number
}

/**
 * 구단관리 하위 메뉴 (장면 0x105 상태 **0xce**, 갱신 0x47d8 · 키 0x4e40) — P4 1b 확정.
 *
 * StrHOWTO[21] "구단 관리 커맨드" 가 네 칸을 그대로 설명한다.
 *
 * 그리기 0x9fcc → 공통 틀 0x9f60(`SeasonCommonFrame`) — 커맨드 줄 하위 칸(표 0xd47d4 · 0xd47dc)과 부모 칸 구단관리.
 * 0x7e418 은 상태 0xce 일 때만 하위 메뉴 켬 표([gfx+0x15c] = this+0x78 의 +0x28)로 칸을 흑백 0xc37a8 로 그린다 — 칸마다
 * (선택 칸 포함) 아이콘 칸 위에. 그 표를 쓰는 곳은 진입 0x47d8 하나다(직접 떴다):
 * ```
 * [[this+0x78]+0x28][1] = (SR+0x56 == 1) ? 0 : 1        ; 트레이드 칸 — 이번 주기에 트레이드를 썼으면 흑백
 * ```
 * 키 0x4e40 은 이 표를 안 본다 — 흑백이어도 트레이드 0xe4 로 간다(그리기만 바꾼다).
 * ⚠️ 원본 그대로의 어긋남(미해결): this+0x78 은 0x28 바이트짜리 0xd2e60 객체(0xf704 · 0x6bd7d)라 +0x28 은 객체 **밖**이다 —
 * 진입이 쓰는 칸 1 말고 칸 0 · 2 · 3 의 값은 힙 이웃에 달려 정할 수 없어 켠 것으로 둔다.
 */
export function SeasonTeamMenuScreen({
  state, onSelect, onBack, cursor: heldCursor, onCursorChange, gamePoint = 0,
}: SeasonTeamMenuScreenProps) {

  const select = (index: number) => {
    const target = teamMenuTarget(index)
    if (target === null) return
    onSelect(TEAM_MENU[index], target)
  }
  const { cursor, moveTo } = useSeasonCursor({
    count: TEAM_MENU.length, onSelect: select, onCancel: onBack,
    ...(heldCursor === undefined ? {} : { cursor: heldCursor }),
    ...(onCursorChange === undefined ? {} : { onCursorChange }),
  })

  return (
    <RawScreen>
      <div role="group" aria-label="구단관리">
        <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={onBack}
          commandBar={{
            slots: SEASON_SUB_COMMAND_SLOTS.구단관리, cursor, parent: seasonParentSlotOf('구단관리'),
            grayedIds: state.record.tradeUsed === 1 ? TRADE_USED_GRAY : undefined,
            onHover: moveTo,
            onSelect: (id) => select(TEAM_MENU.findIndex((label) => label === id)),
          }} />
      </div>
    </RawScreen>
  )
}
