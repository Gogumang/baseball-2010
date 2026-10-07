import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_COMMAND_SLOTS } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'

export interface SeasonChainFrameScreenProps {
  readonly state: SeasonState
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint: number
  /** 관리 메뉴 객체 [this+0x70] 의 커서 — 진입 함수가 [gfx+0x158] 에 그 메뉴를 걸고 [gfx+0x15c](하위 메뉴) 를 0 으로 둔다 */
  readonly cursor: number
  /** 0xee 는 공통 틀이 가운데 판을 뺀다 */
  readonly showsCenterStage?: boolean
}

/**
 * 시즌 끝 사슬 상태 0xee · 0xeb · 0xec · 0xed · 0xf0 의 그림 (직접 떴다).
 * ```
 * 그리기 표 0xcc024: 0xf0 0x9ff0 · 0xeb 0x9ffc · 0xee 0xa008 · 0xec 0xa014 · 0xed (같은 꼴) → 모두 0x9fe4 → 공통 틀 0x9f60
 * 진입 0xe854(0xeb) · 0xe900(0xec) · 0xe7ac(0xed): phase · 저장 → 0x8dad5(evmgr, 0xc | 0xd) / 0x8dd61(evmgr) →
 *   이벤트 370 · 371 · 376(0x8bdc9) → [gfx+0x158] = 메뉴 [this+0x70] · [gfx+0x15c] = 0 → 이전 = 다음 사슬 상태 · 다음 = 0xd3
 * ```
 * 그래서 이 상태들은 한 틀만 공통 틀(커맨드 줄 · 상태판 · 가운데 판 · 머리띠)을 그리고 곧장 이벤트 재생 0xd3 으로 넘어간다.
 * 발표 내용은 이벤트의 system 3 · 4 창(0x8b3bc · 0x8b23c)이 띄우고, 결과 이벤트(372~375 · 378 · 379)는 실행기 끝
 * 0x8b04c · 0x8b370 이 고른다 — 세션(`useSeasonSession`)이 맡는다. 키는 없다.
 * 커맨드 줄 켬 표는 장면을 지을 때 다 켜고(memset 1) 0xc9 진입만 끈다 — 경기 뒤 새로 지은 장면에서 0xc9 를 안 지나므로 다 켜져 있다.
 */
export function SeasonChainFrameScreen({ state, gamePoint, cursor, showsCenterStage = true }: SeasonChainFrameScreenProps) {
  return (
    <RawScreen>
      <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={null}
        showsCenterStage={showsCenterStage}
        commandBar={{ slots: SEASON_COMMAND_SLOTS, cursor, parent: null }} />
    </RawScreen>
  )
}
