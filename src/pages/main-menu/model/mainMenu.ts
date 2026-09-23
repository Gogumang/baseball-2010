import { GAME_START_MENU, SEASON_FIRST_NOTICE, TOP_MENU } from '@/shared/config/original/mainMenu'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'

/**
 * 원작 메인 메뉴는 **두 단**이다. 장면 0x103 의 하위 상태 번호를 그대로 단 번호로 쓴다
 * (갱신 점프표 0xcefa4 = 상태−2 로 점프, H-modes 1절):
 *   4 = 처음 메뉴 (게임시작·스페셜·도움말·환경설정·랭킹·게임문의 — 갱신 0x29454, 진입 0x24a40)
 *   5 = 게임시작 목록 (최근게임~미션모드 — 갱신 0x28cb0, 진입 0x25b88)
 * 둘 다 같은 판 0x24b1c(반원 바퀴)를 그리고, 5 는 그 위에 하위 목록 0x2524c 를 더 그린다
 * (F-ui-layout 4-0·4-2 · P6-screens 2d).
 */
export type MainMenuTier = 4 | 5

/** 처음 메뉴 6칸. 순서는 StrMAINMENU [0]~[4]·[209] 그대로다. */
export const TOP_ENTRIES: readonly MainMenuEntry[] = TOP_MENU

/** 게임시작 목록 7칸. 순서는 StrMAINMENU [6]~[12] 그대로다. */
export const MODE_ENTRIES: readonly MainMenuEntry[] = GAME_START_MENU

export function entriesOf(tier: MainMenuTier): readonly MainMenuEntry[] {
  return tier === 4 ? TOP_ENTRIES : MODE_ENTRIES
}

export interface MainMenuState {
  /** 지금 보고 있는 단 = 원본 하위 상태 번호 */
  readonly tier: MainMenuTier
  readonly selectedTopId: string
  readonly selectedModeId: string
  readonly isConfirmingNewGame: boolean
  /** 못 들어가는 칸을 골랐을 때 뜨는 안내 (원본 팝업 0x74ef5 종류 1 자리). null 이면 안 뜬다. */
  readonly lockedNotice: string | null
}

export type MainMenuAction =
  | { readonly type: '모드선택'; readonly id: string }
  /**
   * 원본 목록은 ↑↓(−1/−2, '2'/'8' …)로 고른다. **고를 수 없는 칸도 건너뛰지 않고 그대로 지나간다**
   * (R11-special-leftovers 4-1 확정: "항목을 숨기거나 건너뛰는 코드는 없다").
   */
  | { readonly type: '커서'; readonly step: 1 | -1 }
  | { readonly type: '시작' }
  | { readonly type: '뒤로' }
  | { readonly type: '확인'; readonly isAccepted: boolean }

/** 메뉴 밖으로 나가야 하는 결과. null 이면 메뉴 안에서 끝난다. */
export type MainMenuEffect =
  | '이어하기' | '새로하기' | '미션' | '홈런더비' | '시즌모드' | '일반모드' | '타이틀로'
  /** 처음 메뉴에서 갈라지는 화면들 — 원본 하위 상태 6 · 9 · 8 (P6-screens 1-2 · F-ui-layout 4-0) */
  | '스페셜' | '도움말' | '환경설정'
  | null

export interface MainMenuResult {
  readonly state: MainMenuState
  readonly effect: MainMenuEffect
}

/**
 * 처음 메뉴(상태 4)에서 시작한다.
 *
 * 게임시작 목록의 커서는 늘 0(최근게임)이다 — 진입 0x25b88 이 앞 상태가 4 면 커서 [0x1552d24] = 0 으로
 * 둔다 (R11-special-leftovers 4-2, 0x25b88 확정). 저장 유무로 커서를 옮기지 않는다.
 * 처음 메뉴 커서의 첫 자리(진입 0x24a40)는 안 읽어 **추정**으로 0번 칸(게임시작)에 둔다.
 */
export function initialMainMenu(_hasSavedGame: boolean): MainMenuState {
  return {
    tier: 4,
    selectedTopId: TOP_ENTRIES[0].id,
    selectedModeId: MODE_ENTRIES[0].id,
    isConfirmingNewGame: false,
    lockedNotice: null,
  }
}

/** 지금 단에서 커서가 있는 칸의 id */
export function selectedIdOf(state: MainMenuState): string {
  return state.tier === 4 ? state.selectedTopId : state.selectedModeId
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
 * - **랭킹·게임문의**: 원작이 못 들어가는 칸을 어떻게 보이는지(흐리게? 안내 문구?)는 문서에 없다
 *   (해당 하위 상태 번호도 미확인) → 지금 웹 방식(흐리게 + 눌러도 아무 일 없음)을 그대로 둔다. **근사**.
 */
export function lockedNoticeOf(entry: MainMenuEntry): string | null {
  return entry.id === '대전모드' ? SEASON_FIRST_NOTICE : null
}

/** 안내도 없이 막히는 칸만 흐리게 그린다 (랭킹·게임문의 — 근사, 위 `lockedNoticeOf` 참고) */
export function isEntryDimmed(entry: MainMenuEntry, hasSavedGame: boolean): boolean {
  return !isEntryEnabled(entry, hasSavedGame) && lockedNoticeOf(entry) === null
}

export function reduceMainMenu(
  state: MainMenuState,
  action: MainMenuAction,
  hasSavedGame: boolean,
): MainMenuResult {
  const stay = (next: MainMenuState): MainMenuResult => ({ state: next, effect: null })

  // 안내 팝업이 떠 있으면 아무 키나 받아 닫기만 한다 (원본 확인 팝업 0x74189 자리)
  if (state.lockedNotice !== null) return stay({ ...state, lockedNotice: null })

  if (state.isConfirmingNewGame) {
    if (action.type === '확인' && action.isAccepted) return { state, effect: '새로하기' }
    if (action.type === '확인' || action.type === '뒤로') return stay({ ...state, isConfirmingNewGame: false })
    return stay(state)
  }

  const entries = entriesOf(state.tier)
  const select = (id: string): MainMenuState =>
    state.tier === 4 ? { ...state, selectedTopId: id } : { ...state, selectedModeId: id }

  switch (action.type) {
    case '모드선택': {
      // 잠긴 칸에도 커서는 간다 — 설명을 읽을 수 있어야 한다 (R11 4-1)
      const entry = entries.find((candidate) => candidate.id === action.id)
      if (entry === undefined) return stay(state)
      return stay(select(entry.id))
    }
    case '커서': {
      const index = entries.findIndex((candidate) => candidate.id === selectedIdOf(state))
      const next = entries[(index + action.step + entries.length) % entries.length]
      return stay(select(next.id))
    }
    case '시작':
      return start(state, hasSavedGame)
    case '뒤로':
      // 게임시작 목록의 CLR(−16) 은 처음 메뉴로 돌아간다 — 0x28cb0 의 `0xbcb49(this+0x18, 4)` (확정)
      if (state.tier === 5) return stay({ ...state, tier: 4 })
      return { state, effect: '타이틀로' }
    default:
      return stay(state)
  }
}

function start(state: MainMenuState, hasSavedGame: boolean): MainMenuResult {
  const entries = entriesOf(state.tier)
  const entry = entries.find((candidate) => candidate.id === selectedIdOf(state))
  if (entry === undefined) return { state, effect: null }

  if (!isEntryEnabled(entry, hasSavedGame)) {
    const notice = lockedNoticeOf(entry)
    return { state: notice === null ? state : { ...state, lockedNotice: notice }, effect: null }
  }

  if (state.tier === 4) {
    // 처음 메뉴 → 하위 상태: 게임시작 5 · 스페셜 6 · 환경설정 8 · 도움말 9
    // (5 = R11 4-1 진입 0x25b88 "앞 상태가 4", 6·9 = P6-screens 1-2, 8 = F-ui-layout 4-0/P6 5절)
    if (entry.id === '게임시작') {
      // 진입 0x25b88: 앞 상태가 4 면 커서를 0(최근게임)으로 되돌린다 (확정)
      return { state: { ...state, tier: 5, selectedModeId: MODE_ENTRIES[0].id }, effect: null }
    }
    if (entry.id === '스페셜') return { state, effect: '스페셜' }
    if (entry.id === '도움말') return { state, effect: '도움말' }
    if (entry.id === '환경설정') return { state, effect: '환경설정' }
    return { state, effect: null }
  }

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
