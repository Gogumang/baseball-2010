import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'

/** 0x7e84c 의 그 밖 갈래 — 칸 수 0 */
const NO_SLOTS: readonly never[] = []

export interface SeasonChainFrameScreenProps {
  readonly state: SeasonState
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint: number
  /**
   * 관리 메뉴 객체 [this+0x70] 의 커서 — 진입 함수가 [gfx+0x158] 에 그 메뉴를 걸고 [gfx+0x15c](하위 메뉴) 를 0 으로 둔다.
   * ⚠️ 이 상태들의 칸 수는 0 이라 그리지 않는다(아래 머리말) — 받아만 둔다
   */
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
 * **커맨드 줄은 칸이 없다**(직접 떴다): 장면 틀 0xe9ac 가 상태가 바뀐 틀마다(0xd3 · 0xdf · 0xe8 밖 — e9d8~e9e8) 0x7e84c(gfx, 상태)를
 * 부르는데, 0xeb · 0xec · 0xed · 0xee · 0xf0 은 그 표의 어느 갈래에도 없어(0x7e870~0x7e8c0 — 0xc9 · 0xcd · 0xce · 0xcf · 0xd0 · 0xde 만)
 * 머리 7e862~7e86e 가 지운 칸 수 [gfx+0x180] = 0 · 표 0 그대로다. 0x7e418 의 칸 고리(7e5a4~7e72a)는 칸 수까지만 돌고,
 * [gfx+0x15c] 는 진입이 0 으로 둬 부모 칸도 없다 — 곧 메뉴를 걸어도 아무 칸도 안 그린다. 예전 웹은 관리 6칸을 그렸다.
 */
export function SeasonChainFrameScreen({ state, gamePoint, cursor, showsCenterStage = true }: SeasonChainFrameScreenProps) {
  return (
    <RawScreen>
      <SeasonCommonFrame record={state.record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={null}
        showsCenterStage={showsCenterStage}
        commandBar={{ slots: NO_SLOTS, cursor, parent: null }} />
    </RawScreen>
  )
}
