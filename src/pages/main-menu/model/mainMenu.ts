import { GAME_START_MENU } from '@/shared/config/original/mainMenu'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'

/** 셀렉트박스에 넣는 게임 모드. 순서는 StrMAINMENU [6]~[12] 그대로다. */
export const MODE_ENTRIES: readonly MainMenuEntry[] = GAME_START_MENU

export interface MainMenuState {
  readonly selectedModeId: string
  readonly isConfirmingNewGame: boolean
}

export type MainMenuAction =
  | { readonly type: '모드선택'; readonly id: string }
  /** 원본 목록은 ↑↓ 로 고른다. 고를 수 없는 칸은 건너뛰지 않고 그대로 머문다 (원본 확인 전이라 추정) */
  | { readonly type: '커서'; readonly step: 1 | -1 }
  | { readonly type: '시작' }
  | { readonly type: '뒤로' }
  | { readonly type: '확인'; readonly isAccepted: boolean }

/** 메뉴 밖으로 나가야 하는 결과. null 이면 메뉴 안에서 끝난다. */
export type MainMenuEffect =
  | '이어하기' | '새로하기' | '미션' | '홈런더비' | '시즌모드' | '일반모드' | '타이틀로' | null

export interface MainMenuResult {
  readonly state: MainMenuState
  readonly effect: MainMenuEffect
}

/** 원본은 저장 유무와 무관하게 늘 커서 0(최근게임)에서 시작한다 (R11-special-leftovers.md 4-2, 0x25b88). */
export function initialMainMenu(_hasSavedGame: boolean): MainMenuState {
  return { selectedModeId: MODE_ENTRIES[0].id, isConfirmingNewGame: false }
}

/**
 * 원본은 최근게임을 저장 유무로 잠그지 않는다 — 7개가 늘 나오고 커서도 그대로 지나간다
 * (R11-special-leftovers.md 4-2, 0x25b88). 이 빌드에서 아직 못 만든 항목(isAvailable)만 막는다.
 */
export function isEntryEnabled(entry: MainMenuEntry, _hasSavedGame: boolean): boolean {
  return entry.isAvailable
}

export function reduceMainMenu(
  state: MainMenuState,
  action: MainMenuAction,
  hasSavedGame: boolean,
): MainMenuResult {
  const stay = (next: MainMenuState): MainMenuResult => ({ state: next, effect: null })

  if (state.isConfirmingNewGame) {
    if (action.type === '확인' && action.isAccepted) return { state, effect: '새로하기' }
    if (action.type === '확인' || action.type === '뒤로') return stay({ ...state, isConfirmingNewGame: false })
    return stay(state)
  }

  switch (action.type) {
    case '모드선택': {
      const entry = MODE_ENTRIES.find((candidate) => candidate.id === action.id)
      // 셀렉트박스가 비활성 옵션을 막지만, 상태 규칙도 스스로 지킨다.
      if (entry === undefined || !isEntryEnabled(entry, hasSavedGame)) return stay(state)
      return stay({ ...state, selectedModeId: entry.id })
    }
    case '커서': {
      const index = MODE_ENTRIES.findIndex((candidate) => candidate.id === state.selectedModeId)
      const next = MODE_ENTRIES[(index + action.step + MODE_ENTRIES.length) % MODE_ENTRIES.length]
      return stay({ ...state, selectedModeId: next.id })
    }
    case '시작':
      return start(state, hasSavedGame)
    case '뒤로':
      return { state, effect: '타이틀로' }
    default:
      return stay(state)
  }
}

function start(state: MainMenuState, hasSavedGame: boolean): MainMenuResult {
  const entry = MODE_ENTRIES.find((candidate) => candidate.id === state.selectedModeId)
  if (entry === undefined || !isEntryEnabled(entry, hasSavedGame)) return { state, effect: null }

  if (entry.id === '최근게임') return { state, effect: '이어하기' }
  if (entry.id === '미션모드') return { state, effect: '미션' }
  if (entry.id === '홈런더비') return { state, effect: '홈런더비' }
  // 시즌모드는 저장이 따로라 나만의리그처럼 지워도 되는지 묻지 않는다 (0x22755 는 다른 칸)
  if (entry.id === '시즌모드') return { state, effect: '시즌모드' }
  // 일반모드는 저장이 아예 없다 — 한 판 치고 끝이다 (H-modes 모드 1)
  if (entry.id === '일반모드') return { state, effect: '일반모드' }
  if (entry.id === '나만의리그') {
    // StrMAINMENU[15] — 저장이 있으면 지워도 되는지 먼저 묻는다.
    return hasSavedGame
      ? { state: { ...state, isConfirmingNewGame: true }, effect: null }
      : { state, effect: '새로하기' }
  }
  return { state, effect: null }
}
