/** 메인 메뉴 키 처리 — 창 답 · 커서 · 시작(OK) */
import { MODE_ENTRIES, RANKING_ENTRIES, RANKING_SERVER_NOTICE, entriesOf } from '@/pages/main-menu/model/mainMenu/menuEntries'
import type { MainMenuAction, MainMenuEffect, MainMenuResult, MainMenuState } from '@/pages/main-menu/model/mainMenu/menuTypes'
import {
  NO_NARI_GAME_READY,
  answerGeneralModeWindow,
  generalModeEntryCursorOf,
  nariEditionEffectOf,
  recentGameOf,
} from '@/pages/main-menu/model/mainMenu/menuOpening'
import type { NariGameReady } from '@/pages/main-menu/model/mainMenu/menuOpening'
import { isEntryEnabled, lockedNoticeOf, selectedIdOf } from '@/pages/main-menu/model/mainMenu/menuCursors'

export function reduceMainMenu(
  state: MainMenuState,
  action: MainMenuAction,
  hasSavedGame: boolean,
  /** 일반모드 경기가 중간 저장돼 있는가 (전역기록 +0x4d — 경기정보 OK·이어하기가 1, 경기 끝 정산이 0) */
  isGeneralGameInProgress = false,
  /** 전역기록 +0x3c — 마지막으로 시작한 모드 (새 저장은 1 — 생성자 0x9f26c). [최근게임] 이 이 값으로 갈라진다 */
  lastPlayedMode = 1,
  /** 나리 두 편의 `+0x40+m && +0x4c+m` — [14]·[최근게임] 의 모드 3·4 갈래가 곧장 경기로 갈지 본다 */
  nariGameReady: NariGameReady = NO_NARI_GAME_READY,
): MainMenuResult {
  const popupAnswer = answerOpenPopup(state, action, isGeneralGameInProgress, nariGameReady)
  if (popupAnswer !== null) return popupAnswer
  return answerMenuKey(state, action, hasSavedGame, isGeneralGameInProgress, lastPlayedMode, nariGameReady)
}

/** 떠 있는 창 · 안내가 키를 먼저 받는다 — 아무것도 안 떠 있으면 null */
function answerOpenPopup(
  state: MainMenuState,
  action: MainMenuAction,
  isGeneralGameInProgress: boolean,
  nariGameReady: NariGameReady,
): MainMenuResult | null {
  // 창이 떠 있으면 키는 창 것이다 — 답만 받는다
  if (state.generalModeWindow !== null) {
    if (action.type !== '창답') return stay(state)
    return answerGeneralModeWindow(state, state.generalModeWindow, action.answer, isGeneralGameInProgress)
  }
  // 안내 팝업이 떠 있으면 아무 키나 받아 닫기만 한다 (원본 확인 팝업 0x74189 자리)
  if (state.lockedNotice !== null) return stay({ ...state, lockedNotice: null })
  if (state.isPickingNariEdition) return answerNariEditionWindow(state, action, nariGameReady)
  return null
}

/** 단 목록의 키 — 칸 누름 · 커서 · 시작(OK) · 뒤로(CLR) */
function answerMenuKey(
  state: MainMenuState,
  action: MainMenuAction,
  hasSavedGame: boolean,
  isGeneralGameInProgress: boolean,
  lastPlayedMode: number,
  nariGameReady: NariGameReady,
): MainMenuResult {
  switch (action.type) {
    case '모드선택':
      return stay(selectEntry(state, action.id))
    case '커서':
      return stay(moveCursor(state, action.step))
    case '시작':
      return start(state, hasSavedGame, isGeneralGameInProgress, lastPlayedMode, nariGameReady)
    case '뒤로':
      // 게임시작 목록·랭킹 목록의 CLR(−16) 은 처음 메뉴로 돌아간다 — 0x28cb0 · 0x28ad4 의 `0xbcb49(this+0x18, 4)` (확정).
      // 처음 메뉴 갱신 0x29454 는 CLR 을 아예 안 본다(키 −1~−5 · '2'·'4'·'5'·'6'·'8' 만) — 타이틀로 돌아가는 길은 없다
      return stay(state.tier === 4 ? state : { ...state, tier: 4 })
    default:
      return stay(state)
  }
}

const stay = (next: MainMenuState): MainMenuResult => ({ state: next, effect: null })

/** [14] 편 고르기 답 — 0 타자편 · 1 투수편, −1(CLR) → 상태 5 게임시작 목록 */
function answerNariEditionWindow(state: MainMenuState, action: MainMenuAction, nariGameReady: NariGameReady): MainMenuResult {
  if (action.type !== '창답') return stay(state)
  const close = { ...state, isPickingNariEdition: false }
  if (action.answer === 0) return { state: close, effect: nariEditionEffectOf('타자편', nariGameReady) }
  if (action.answer === 1) return { state: close, effect: nariEditionEffectOf('투수편', nariGameReady) }
  return stay(close)
}

/** 지금 단의 커서 칸을 id 로 */
function withSelectedId(state: MainMenuState, id: string): MainMenuState {
  if (state.tier === 4) return { ...state, selectedTopId: id }
  return state.tier === 9 ? { ...state, selectedRankingId: id } : { ...state, selectedModeId: id }
}

/** 칸 누름 — 잠긴 칸에도 커서는 간다(설명을 읽을 수 있어야 한다, R11 4-1) */
function selectEntry(state: MainMenuState, id: string): MainMenuState {
  const entry = entriesOf(state.tier).find((candidate) => candidate.id === id)
  return entry === undefined ? state : withSelectedId(state, entry.id)
}

/** 키 이동 — 단 안에서 감는다 */
function moveCursor(state: MainMenuState, step: number): MainMenuState {
  const entries = entriesOf(state.tier)
  const index = entries.findIndex((candidate) => candidate.id === selectedIdOf(state))
  const next = entries[(index + step + entries.length) % entries.length]
  return withSelectedId(state, next.id)
}

/** 처음 메뉴 칸 → 그 화면 (표 0xcebdc: 스페셜 6 · 도움말 7 · 환경설정 8 · 게임문의 10, 0x294a2 확정) */
const TOP_EFFECT: ReadonlyMap<string, MainMenuEffect> = new Map<string, MainMenuEffect>([
  ['스페셜', '스페셜'],
  ['도움말', '도움말'],
  ['환경설정', '환경설정'],
  ['게임문의', '게임문의'],
])

/** 게임시작 목록 칸 → 그 화면 — 시즌모드는 저장이 따로라 나만의리그처럼 지워도 되는지 묻지 않는다 (0x22755 는 다른 칸) */
const MODE_EFFECT: ReadonlyMap<string, MainMenuEffect> = new Map<string, MainMenuEffect>([
  ['미션모드', '미션'],
  ['홈런더비', '홈런더비'],
  ['시즌모드', '시즌모드'],
])

function start(
  state: MainMenuState,
  hasSavedGame: boolean,
  isGeneralGameInProgress: boolean,
  lastPlayedMode: number,
  nariGameReady: NariGameReady,
): MainMenuResult {
  const entry = entriesOf(state.tier).find((candidate) => candidate.id === selectedIdOf(state))
  if (entry === undefined) return { state, effect: null }
  if (!isEntryEnabled(entry, hasSavedGame)) {
    const notice = lockedNoticeOf(entry)
    return { state: notice === null ? state : { ...state, lockedNotice: notice }, effect: null }
  }
  if (state.tier === 4) return startTopEntry(state, entry.id)
  // 랭킹 목록 OK → [skin+0xe6] = 커서 · 하위 37 (0x28b34~0x28b4c) — 웹은 서버가 없어 안내만 (근사)
  if (state.tier === 9) return { state: { ...state, lockedNotice: RANKING_SERVER_NOTICE }, effect: null }
  return startModeEntry(state, entry.id, isGeneralGameInProgress, lastPlayedMode, nariGameReady)
}

/** 처음 메뉴 OK → 표 0xcebdc[커서] = 게임시작 5 · 스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10 (0x294a2 확정) */
function startTopEntry(state: MainMenuState, id: string): MainMenuResult {
  // 진입 0x25b88: 앞 상태가 4 면 커서를 0(최근게임)으로 되돌린다 (확정)
  if (id === '게임시작') return { state: { ...state, tier: 5, selectedModeId: MODE_ENTRIES[0].id }, effect: null }
  // 진입 0x23d98: 앞 상태가 4 면 같은 전역 커서 [0x1552d24] 를 0 으로 · 개수 5 · 표 0xcea00
  if (id === '랭킹') return { state: { ...state, tier: 9, selectedRankingId: RANKING_ENTRIES[0].id }, effect: null }
  return { state, effect: TOP_EFFECT.get(id) ?? null }
}

/** 게임시작 목록 OK */
function startModeEntry(
  state: MainMenuState,
  id: string,
  isGeneralGameInProgress: boolean,
  lastPlayedMode: number,
  nariGameReady: NariGameReady,
): MainMenuResult {
  if (id === '최근게임') return recentGameOf(state, lastPlayedMode, isGeneralGameInProgress, nariGameReady)
  // 일반모드 → 하위 12 진입 창 [13] (0x28d8a). 게임시작 목록에서 왔으니 앞 상태는 5다
  if (id === '일반모드') {
    const initialSelected = generalModeEntryCursorOf(5, isGeneralGameInProgress)
    return { state: { ...state, generalModeWindow: { kind: '진입', initialSelected } }, effect: null }
  }
  // 나만의리그 → 하위 13 편 고르기 창 [14] (0x28d9a) — 저장 유무와 상관없이 지울지 묻지 않는다
  if (id === '나만의리그') return { state: { ...state, isPickingNariEdition: true }, effect: null }
  return { state, effect: MODE_EFFECT.get(id) ?? null }
}
