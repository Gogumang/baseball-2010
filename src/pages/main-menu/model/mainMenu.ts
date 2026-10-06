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
  /**
   * 나만의리그 편 고르기 창 [14] — 하위 상태 13. 게임시작 목록 [나만의리그] 가 곧바로 하위 13 으로 간다
   * (0x28cb0 표 0xcebb0[2] = 13 → 0x28d9a). **저장을 지울지 묻는 창은 없다** — [15] 는 0x296f0(일반모드) 안에만 있다.
   *
   * 진입 0x25d78: [14] "어떤 선수로 플레이 하시겠습니까?" 종류 0x10, 격자 2열×1행, 간격 0x74805(창, 0x3c, 0),
   * 버튼 0 타자편(popup 고른 13 / 보통 11) · 1 투수편(14 / 12), CLR → −1. 0x749d5 를 안 불러 처음 커서는 0(타자편).
   * 갱신 0x2464c: 답 0 → this+0x13c = 4(타자편) · 1 → 3(투수편) → 상태 0x27 → 0x327b8(모드) → 장면 0x106,
   * −1 → 상태 5. 장면 셋업 0xf684 가 전역기록 +0x40 + 모드(그 편 커리어 있음)면 이어하기(100), 없으면 팀 고르기(101).
   */
  readonly isPickingNariEdition: boolean
  /** 못 들어가는 칸을 골랐을 때 뜨는 안내 (원본 팝업 0x74ef5 종류 1 자리). null 이면 안 뜬다. */
  readonly lockedNotice: string | null
  /** 일반모드 진입 창 — 하위 상태 12(0x296f0)의 [13]·[15]. null 이면 안 떠 있다. */
  readonly generalModeWindow: GeneralModeWindow | null
}

/**
 * **일반모드 진입 창** — 게임시작 목록에서 [일반모드] 를 고르면 곧바로 하위 상태 12(0x296f0)로 간다
 * (갱신 0x28cb0 → 표 0xcebb0[1] = 12 → 0x28d8a `this+0xeb = 0 ; 0xbcb49(this+0x18, 12)`).
 * [최근게임] 의 모드 1 시작 0x327b8 은 전역기록 +0x4d 가 서 있으면 창 없이 저장을 올려 경기로 가고(0x327f8~0x3282c),
 * 아니면 같은 하위 12 로 온다(0x3282e~0x3283c).
 *
 * 하위 12 의 하위 단계 [this+0x18] (0x296f0 직접 읽음):
 * ```
 * 단계 0  창 [13] "일반 모드를 진행하시겠습니까?" 종류 0x10, 격자 1열×3행, 간격 0x74805(창, 0, 5)
 *         버튼(0x74ea9, 고른/보통 popup 프레임) 0 이어하기 9/4 · 1 새로하기 8/3 · 2 빠른실행 10/5, CLR → −1
 *         처음 커서 0x749d5: 앞 상태 [this+0x28] == 0x27 이면 1, 아니면 전역기록 +0x4d ? 0 : 1 (0x297f0~0x29816)
 * 단계 1  답 [ctx+0x21c]:
 *           0 이어하기  +0x4c+모드(= +0x4d) ? 상태 0x27(→ 0x327b8 이 저장을 올려 경기) : 0x24924 → 상태 18(유저 팀)
 *           1 새로하기  +0x4d ? 창 [15] 종류 0x82 + 0x749d5(창, 1) → 단계 2 : 0x24924 → 상태 18
 *           2 빠른실행  +0x4d ? 창 [15] 종류 0x82 + 0x749d5(창, 1) → 단계 3 : this+0x14c = 1 · 0x24924 → 상태 22(경기정보)
 *          −1          상태 5(게임시작 목록)
 * 단계 2  [15] 답 0 → 상태 18 · 1/−1 → 상태 5          ([15] 의 CLR 은 1, 0x298e0~0x298ea)
 * 단계 3  [15] 답 0 → this+0x14c = 1 · 상태 22 · 1/−1 → 상태 5
 * ```
 * 전역기록 +0x4c + 모드 = "그 모드 경기가 중간 저장돼 있음": 경기정보 OK(0x3136e)·경기 장면 진입(0x3a342 …)이 1, 경기 끝 0x4f3d8 이 0.
 * 일반모드(모드 1)는 +0x4d 이고, 저장 칸은 반 이닝마다 자동 저장(0x4f928 → 0x1fdec, 두 팀 칸 0x32·0x33 + 경기 상태)이다.
 */
export type GeneralModeWindow =
  /** [13] 이어하기·새로하기·빠른실행 — `initialSelected` 는 0x749d5 의 처음 칸 */
  | { readonly kind: '진입'; readonly initialSelected: number }
  /** [15] 새로하기 확인 — 예면 `next` 로 간다 (처음 커서 1 = 아니오) */
  | { readonly kind: '새로하기확인'; readonly next: '일반모드' | '일반모드빠른실행' }

export type MainMenuAction =
  | { readonly type: '모드선택'; readonly id: string }
  /**
   * 원본 목록은 ↑↓(−1/−2, '2'/'8' …)로 고른다. **고를 수 없는 칸도 건너뛰지 않고 그대로 지나간다**
   * (R11-special-leftovers 4-1 확정: "항목을 숨기거나 건너뛰는 코드는 없다").
   */
  | { readonly type: '커서'; readonly step: 1 | -1 }
  | { readonly type: '시작' }
  | { readonly type: '뒤로' }
  /** 진입 창(일반모드 [13]·[15] · 나만의리그 [14])의 답 — 버튼 칸 번호, CLR 은 −1 */
  | { readonly type: '창답'; readonly answer: number }

/** 메뉴 밖으로 나가야 하는 결과. null 이면 메뉴 안에서 끝난다. */
export type MainMenuEffect =
  | '미션' | '홈런더비' | '시즌모드' | '일반모드' | '타이틀로'
  /** 나만의리그 [14] 답 0 · 1 — 모드 4 타자편 · 모드 3 투수편 (0x2464c) */
  | '나리타자편' | '나리투수편'
  /** 일반모드 빠른실행 — 하위 22(경기정보)로 곧바로, this+0x14c = 1 (0x299f8 · 0x2992a) */
  | '일반모드빠른실행'
  /** 일반모드 중간 저장 이어하기 — 상태 0x27 → 0x327b8 이 0x213c0(앱, 1, 0) 으로 올려 경기 장면으로 */
  | '일반모드경기이어하기'
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
    isPickingNariEdition: false,
    lockedNotice: null,
    generalModeWindow: null,
  }
}

/** 원본 상태 0x27(39) — 경기 끝·최근게임이 거쳐 가는 "같은 모드 다시 시작"(진입 0x32988 → 0x327b8) */
export const RESTART_MODE_STATE = 0x27

/**
 * [13] 의 처음 커서 (0x297f0~0x29816) — 앞 상태가 0x27 이면 1(새로하기), 아니면 중간 저장(+0x4d)이 있으면 0(이어하기), 없으면 1.
 */
export function generalModeEntryCursorOf(previousState: number, isGameInProgress: boolean): number {
  if (previousState === RESTART_MODE_STATE) return 1
  return isGameInProgress ? 0 : 1
}

/** 하위 12 의 답 처리 (단계 1~3) — `isGameInProgress` 는 전역기록 +0x4c + 모드 1 = +0x4d */
function answerGeneralModeWindow(
  state: MainMenuState,
  window: GeneralModeWindow,
  answer: number,
  isGameInProgress: boolean,
): MainMenuResult {
  const close = { ...state, generalModeWindow: null }
  if (window.kind === '새로하기확인') {
    return answer === 0 ? { state: close, effect: window.next } : { state: close, effect: null }
  }
  if (answer === 0) return { state: close, effect: isGameInProgress ? '일반모드경기이어하기' : '일반모드' }
  if (answer === 1) {
    return isGameInProgress
      ? { state: { ...state, generalModeWindow: { kind: '새로하기확인', next: '일반모드' } }, effect: null }
      : { state: close, effect: '일반모드' }
  }
  if (answer === 2) {
    return isGameInProgress
      ? { state: { ...state, generalModeWindow: { kind: '새로하기확인', next: '일반모드빠른실행' } }, effect: null }
      : { state: close, effect: '일반모드빠른실행' }
  }
  // −1(CLR) → 상태 5 게임시작 목록
  return { state: close, effect: null }
}

/**
 * **[최근게임]** — 게임시작 목록 커서 0 의 OK (0x28cb0 → 표 0xcebb0[0] = 11 → 0x28d54, 2026-10-06 직접 다시 뜸).
 * ```
 * 28d5e m = 전역기록(0x1f1d9)+0x3c (마지막 모드) → this+0x13c = m
 * 28d66 m ∈ {5,6}  → 상태 17 (미션 선수 고르기)
 * 28d7e m == 7     → 상태 16 (홈런더비 선수 고르기)
 * 28d86 그 밖       → 상태 0x27 → 진입 0x32988 → 0x327b8(this, m)
 * ```
 * 0x327b8(this, m): st[3] = 전역기록 +0x2c · 0x1552d14 = m · **전역기록 +0x3c = m** 뒤 m−1 로 점프표 0xcf048:
 * ```
 * 1   327f8 +0x4d ? 0x213c0(앱,1,0) · 장면 0x104 · +0x4d = 1 : this+0xeb = 0 · 상태 12 ([13], 앞 상태 0x27 → 커서 1)
 * 2   3284e (+0x42 && +0x4e) ? 0x213c0(앱,2,0) · 장면 0x104 : 0x140006c = 0xc9 · 장면 0x105 (시즌 관리)
 * 3·4 3288e (+0x40+m && +0x4c+m) ? 0x213c0(앱,m,0) · 장면 0x104 : 0x140006c = 0x69 · 장면 0x106 (나리 관리)
 * 5·6 328e4 장면 0x107 (최근게임은 이 갈래로 안 온다 — 위에서 17 로 갔다)
 * 7   328c8 0x213c0(앱,4,0) · +0x3c = 7 · this+0x13c = 7 · 장면 0x104 (최근게임은 16 으로 갔다)
 * 8·9 328f0 +0x4c+m ? 0x213c0(앱,m,0) · 장면 0x104 : 상태 15 (대전 통신)
 * 그 밖(0) 점프표 밖 — 0x1f1b9 만 하고 돌아온다
 * ```
 * 웹: 시즌 +0x4e 는 웹 시즌 경기에 중간 저장이 없어 늘 0 → 장면 0x105(`시즌모드`). 나리 +0x4f/+0x50 은 웹에 칸이 없어 늘 0 →
 * 장면 0x106(그 편 고르기 뒤와 같은 `나리투수편`/`나리타자편`). 대전(8·9)은 통신이라 웹에 없고 +0x3c 에 들어올 수도 없다.
 * ⚠️ 미해결: m = 0(새 저장의 +0x3c 기본값은 못 읽었다)이면 상태 0x27 에 남는데 0x27 은 갱신 함수가 없어 화면이 멈춘 듯 보일 것 —
 * 웹은 아무 일도 안 하고 목록에 남는다.
 */
export function recentGameOf(
  state: MainMenuState,
  lastPlayedMode: number,
  isGeneralGameInProgress: boolean,
): MainMenuResult {
  if (lastPlayedMode === 5 || lastPlayedMode === 6) return { state, effect: '미션' }
  if (lastPlayedMode === 7) return { state, effect: '홈런더비' }
  if (lastPlayedMode === 1) {
    if (isGeneralGameInProgress) return { state, effect: '일반모드경기이어하기' }
    const initialSelected = generalModeEntryCursorOf(RESTART_MODE_STATE, isGeneralGameInProgress)
    return { state: { ...state, generalModeWindow: { kind: '진입', initialSelected } }, effect: null }
  }
  if (lastPlayedMode === 2) return { state, effect: '시즌모드' }
  if (lastPlayedMode === 3) return { state, effect: '나리투수편' }
  if (lastPlayedMode === 4) return { state, effect: '나리타자편' }
  return { state, effect: null }
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
  /** 일반모드 경기가 중간 저장돼 있는가 (전역기록 +0x4d — 경기정보 OK·이어하기가 1, 경기 끝 정산이 0) */
  isGeneralGameInProgress = false,
  /** 전역기록 +0x3c — 마지막으로 시작한 모드 (0 = 아직 없음). [최근게임] 이 이 값으로 갈라진다 */
  lastPlayedMode = 0,
): MainMenuResult {
  const stay = (next: MainMenuState): MainMenuResult => ({ state: next, effect: null })

  // 창이 떠 있으면 키는 창 것이다 — 답만 받는다
  if (state.generalModeWindow !== null) {
    if (action.type !== '창답') return stay(state)
    return answerGeneralModeWindow(state, state.generalModeWindow, action.answer, isGeneralGameInProgress)
  }

  // 안내 팝업이 떠 있으면 아무 키나 받아 닫기만 한다 (원본 확인 팝업 0x74189 자리)
  if (state.lockedNotice !== null) return stay({ ...state, lockedNotice: null })

  if (state.isPickingNariEdition) {
    if (action.type !== '창답') return stay(state)
    const close = { ...state, isPickingNariEdition: false }
    if (action.answer === 0) return { state: close, effect: '나리타자편' }
    if (action.answer === 1) return { state: close, effect: '나리투수편' }
    // −1(CLR) → 상태 5 게임시작 목록
    return stay(close)
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
      return start(state, hasSavedGame, isGeneralGameInProgress, lastPlayedMode)
    case '뒤로':
      // 게임시작 목록의 CLR(−16) 은 처음 메뉴로 돌아간다 — 0x28cb0 의 `0xbcb49(this+0x18, 4)` (확정)
      if (state.tier === 5) return stay({ ...state, tier: 4 })
      return { state, effect: '타이틀로' }
    default:
      return stay(state)
  }
}

function start(
  state: MainMenuState,
  hasSavedGame: boolean,
  isGeneralGameInProgress: boolean,
  lastPlayedMode: number,
): MainMenuResult {
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

  if (entry.id === '최근게임') return recentGameOf(state, lastPlayedMode, isGeneralGameInProgress)
  if (entry.id === '미션모드') return { state, effect: '미션' }
  if (entry.id === '홈런더비') return { state, effect: '홈런더비' }
  // 시즌모드는 저장이 따로라 나만의리그처럼 지워도 되는지 묻지 않는다 (0x22755 는 다른 칸)
  if (entry.id === '시즌모드') return { state, effect: '시즌모드' }
  // 일반모드 → 하위 12 진입 창 [13] (0x28d8a). 게임시작 목록에서 왔으니 앞 상태는 5다
  if (entry.id === '일반모드') {
    const initialSelected = generalModeEntryCursorOf(5, isGeneralGameInProgress)
    return { state: { ...state, generalModeWindow: { kind: '진입', initialSelected } }, effect: null }
  }
  // 나만의리그 → 하위 13 편 고르기 창 [14] (0x28d9a) — 저장 유무와 상관없이 지울지 묻지 않는다
  if (entry.id === '나만의리그') return { state: { ...state, isPickingNariEdition: true }, effect: null }
  return { state, effect: null }
}
