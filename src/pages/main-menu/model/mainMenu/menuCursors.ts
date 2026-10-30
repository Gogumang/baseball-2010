/** 커서 칸 · 칸 잠김 판정 */
import { SEASON_FIRST_NOTICE } from '@/shared/config/original/mainMenu'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'
import { MODE_ENTRIES, RANKING_ENTRIES, TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu/menuEntries'
import type { MainMenuState } from '@/pages/main-menu/model/mainMenu/menuTypes'

/**
 * 게임시작 목록 커서 전역 `[0x1552d24]`(.bss 바이트) — 장면 0x103 이 내려가도 남는다. 하위 5 진입 0x25b88(앞 상태 4)과 켤 때의
 * 0x23908 만 0 으로 되감는다. 웹 메인 메뉴는 다른 화면을 다녀오면 다시 마운트되므로 루트가 이 값을 들고 화면이 고쳐 적는다.
 */
export interface GameStartCursor {
  current: number
}

export function createGameStartCursor(): GameStartCursor {
  return { current: 0 }
}

/** 게임시작 목록 커서 칸 번호 (`[0x1552d24]` 에 적는 값) */
export function modeCursorOf(state: MainMenuState): number {
  return Math.max(
    MODE_ENTRIES.findIndex((entry) => entry.id === state.selectedModeId),
    0,
  )
}

/**
 * 하위 목록 전역 커서 `[0x1552d24]` 에 지금 적혀 있을 값 — 하위 5 는 게임시작 목록 칸, 하위 9 는 랭킹 칸
 * (진입 0x23d98 이 앞 상태 4 면 같은 전역을 0 으로 되감는다). 처음 메뉴(하위 4)는 전역을 안 건드리므로 null.
 */
export function listCursorOf(state: MainMenuState): number | null {
  if (state.tier === 5) return modeCursorOf(state)
  if (state.tier === 9)
    return Math.max(
      RANKING_ENTRIES.findIndex((entry) => entry.id === state.selectedRankingId),
      0,
    )
  return null
}

/** 처음 메뉴 바퀴 커서 `[this+0xe8]` 칸 번호 */
export function topCursorOf(state: MainMenuState): number {
  return Math.max(
    TOP_ENTRIES.findIndex((entry) => entry.id === state.selectedTopId),
    0,
  )
}

/** 지금 단에서 커서가 있는 칸의 id */
export function selectedIdOf(state: MainMenuState): string {
  if (state.tier === 4) return state.selectedTopId
  return state.tier === 9 ? state.selectedRankingId : state.selectedModeId
}

/**
 * 원본은 최근게임을 저장 유무로 잠그지 않는다 — 7개가 늘 나오고 커서도 그대로 지나간다
 * (R11-special-leftovers 4-2, 0x25b88). 이 빌드에서 아직 못 만든 항목(isAvailable)만 막는다.
 */
export function isEntryEnabled(entry: MainMenuEntry, _hasSavedGame: boolean): boolean {
  return entry.isAvailable
}

/**
 * 못 들어가는 칸을 시작했을 때 뜨는 안내. null 이면 안내 없이 아무 일도 안 일어난다.
 *
 * - **대전모드**(확정): 원본도 목록에 그대로 나오고 커서도 지나가며, OK 를 누르면
 *   StrMAINMENU[115] "시즌모드를 먼저 시작해주세요" 팝업(0x74ef5 종류 1)만 뜨고 상태는 그대로다
 *   (R11-special-leftovers 4-1, 갱신 0x28cb0 / 0x28dcc).
 *   ⚠️ **근사**: 원본은 전역기록 +0x42(시즌 커리어 있음)가 0 이 아니면 상태 15(통신 대전)로 들어간다.
 *   웹판은 통신이 없어 늘 막히므로 같은 문구를 늘 띄운다.
 * 처음 메뉴의 [랭킹]·[게임문의] 는 이제 둘 다 들어간다(`TOP_ENTRIES`) — 안내도 없이 막히는 칸은 지금 없다.
 */
export function lockedNoticeOf(entry: MainMenuEntry): string | null {
  return entry.id === '대전모드' ? SEASON_FIRST_NOTICE : null
}

/** 안내도 없이 막히는 칸만 흐리게 그린다 (웹판에 아직 못 만든 칸 — 지금은 없다, 위 `lockedNoticeOf` 참고) */
export function isEntryDimmed(entry: MainMenuEntry, hasSavedGame: boolean): boolean {
  return !isEntryEnabled(entry, hasSavedGame) && lockedNoticeOf(entry) === null
}
