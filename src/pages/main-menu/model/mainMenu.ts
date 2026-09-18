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
  | { readonly type: '시작' }
  | { readonly type: '뒤로' }
  | { readonly type: '확인'; readonly isAccepted: boolean }

/** 메뉴 밖으로 나가야 하는 결과. null 이면 메뉴 안에서 끝난다. */
export type MainMenuEffect = '이어하기' | '새로하기' | '미션' | '타이틀로' | null

export interface MainMenuResult {
  readonly state: MainMenuState
  readonly effect: MainMenuEffect
}

/** 저장이 있으면 이어하기가 가장 흔한 선택이라 최근게임을 먼저 골라 둔다. */
export function initialMainMenu(hasSavedGame: boolean): MainMenuState {
  return { selectedModeId: hasSavedGame ? '최근게임' : '나만의리그', isConfirmingNewGame: false }
}

/** 최근게임은 저장이 있어야 고를 수 있다 (StrMAINMENU[6] "마지막으로 진행한 게임 모드를 재시작"). */
export function isEntryEnabled(entry: MainMenuEntry, hasSavedGame: boolean): boolean {
  if (!entry.isAvailable) return false
  return entry.id !== '최근게임' || hasSavedGame
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
  if (entry.id === '나만의리그') {
    // StrMAINMENU[15] — 저장이 있으면 지워도 되는지 먼저 묻는다.
    return hasSavedGame
      ? { state: { ...state, isConfirmingNewGame: true }, effect: null }
      : { state, effect: '새로하기' }
  }
  return { state, effect: null }
}
