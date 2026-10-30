/** 처음 상태 · 일반모드 진입 창 답 · 나리 편 갈래 · [최근게임] (0x25b88 · 0x297f0 · 0x327b8 · 0x28d54) */
import { MODE_ENTRIES, RANKING_ENTRIES, TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu/menuEntries'
import type { GeneralModeWindow, MainMenuEffect, MainMenuOpenTier, MainMenuResult, MainMenuState } from '@/pages/main-menu/model/mainMenu/menuTypes'

/**
 * 처음 메뉴(상태 4)에서 시작한다 — `openTier` 5 면 게임시작 목록(하위 5)에서, 커서는 `modeCursor`(전역 [0x1552d24]) 칸.
 *
 * 처음 메뉴 → 게임시작 목록으로 내려가면 커서는 늘 0(최근게임)이다 — 진입 0x25b88 이 앞 상태가 4 면 커서 [0x1552d24] = 0 으로
 * 둔다 (R11-special-leftovers 4-2, 0x25b88 확정). 저장 유무로 커서를 옮기지 않는다.
 *
 * 처음 메뉴 바퀴 커서 `[this+0xe8]`(장면 객체 바이트)는 진입 0x24a40 이 안 건드리고 0x237b6 · 0x24bfa 만 쓴다 — 장면을 새로 세우면
 * (memset 0) 0 이고, 같은 장면 안의 하위 6~10(스페셜·도움말·환경설정·랭킹·게임문의)을 다녀오면 떠난 그 칸이다. `topCursor` 가 그 값이다.
 */
export function initialMainMenu(_hasSavedGame: boolean, openTier: MainMenuOpenTier = 4, modeCursor = 0, topCursor = 0): MainMenuState {
  return {
    tier: openTier,
    selectedTopId: (TOP_ENTRIES[topCursor] ?? TOP_ENTRIES[0]).id,
    selectedModeId: (MODE_ENTRIES[modeCursor] ?? MODE_ENTRIES[0]).id,
    selectedRankingId: RANKING_ENTRIES[0].id,
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
export function answerGeneralModeWindow(state: MainMenuState, window: GeneralModeWindow, answer: number, isGameInProgress: boolean): MainMenuResult {
  const close = { ...state, generalModeWindow: null }
  if (window.kind === '새로하기확인') {
    return answer === 0 ? { state: close, effect: window.next } : { state: close, effect: null }
  }
  if (answer === 0) return { state: close, effect: isGameInProgress ? '일반모드경기이어하기' : '일반모드' }
  const next = NEW_GAME_EFFECT_BY_ANSWER.get(answer)
  // −1(CLR) → 상태 5 게임시작 목록
  if (next === undefined) return { state: close, effect: null }
  // 중간 저장이 있으면 새로 하기 전에 한 번 더 묻는다
  if (isGameInProgress) return { state: { ...state, generalModeWindow: { kind: '새로하기확인', next } }, effect: null }
  return { state: close, effect: next }
}

/** [13] 답 1 새로하기 · 2 빠른실행 (0x2992a · 0x299f8) */
const NEW_GAME_EFFECT_BY_ANSWER: ReadonlyMap<number, '일반모드' | '일반모드빠른실행'> = new Map([
  [1, '일반모드'],
  [2, '일반모드빠른실행'],
])

/**
 * 0x327b8 모드 3·4 갈래가 보는 두 칸 — 편마다 `전역기록 +0x40 + m`(그 편 커리어 있음) && `+0x4c + m`(그 편 경기 중간 저장됨,
 * 투수편 +0x4f · 타자편 +0x50). 둘 다 서 있으면 참이다. 부르는 쪽이 계산해 넘긴다.
 */
export interface NariGameReady {
  readonly 투수편: boolean
  readonly 타자편: boolean
}

export const NO_NARI_GAME_READY: NariGameReady = { 투수편: false, 타자편: false }

/**
 * 0x327b8(this, 3|4) — `(+0x40+m && +0x4c+m)` ? 0x213c0(앱, m, 0) · 장면 0x104(곧장 경기) : 0x140006c = 0x69 · 장면 0x106.
 * [14] 편 고르기(0x2464c → 상태 0x27)와 [최근게임](0x28d54 → 상태 0x27)이 같은 이 갈래를 지난다.
 */
export function nariEditionEffectOf(edition: '타자편' | '투수편', ready: NariGameReady): Exclude<MainMenuEffect, null> {
  if (edition === '타자편') return ready.타자편 ? '나리타자편경기' : '나리타자편'
  return ready.투수편 ? '나리투수편경기' : '나리투수편'
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
 * 웹: 시즌 모드 2 는 `시즌모드` 로 보내고, `+0x42 && +0x4e` 곧장 경기 갈래는 SeasonRoute 가 들어오는 순간 가른다
 * (`resumeSavedGame`, 7ff133c — +0x4e 는 시즌 저장의 `isGameInProgress`). 나리 3·4 는 [14] 와 같은 갈래
 * (`nariEditionEffectOf` — +0x4f/+0x50 은 `entities/mode-save`). 대전(8·9)은 통신이라 웹에 없고 +0x3c 에 들어올 수도 없다.
 * 새 저장의 +0x3c 는 전역기록 생성자 0x9f26c 가 넣는 1 이다(0x9f334) — 처음 켠 게임의 [최근게임] 은 모드 1 갈래로 간다.
 * 원본에서 m = 0 은 나올 수 없다(+0x3c 를 쓰는 곳은 0x327e8 · 0x328de · 0x31360 과 생성자뿐). 웹은 망가진 저장 대비로
 * 아무 일도 안 하고 목록에 남는다.
 */
export function recentGameOf(
  state: MainMenuState,
  lastPlayedMode: number,
  isGeneralGameInProgress: boolean,
  nariGameReady: NariGameReady = NO_NARI_GAME_READY,
): MainMenuResult {
  if (lastPlayedMode === 1) return recentGeneralGameOf(state, isGeneralGameInProgress)
  if (lastPlayedMode === 3) return { state, effect: nariEditionEffectOf('투수편', nariGameReady) }
  if (lastPlayedMode === 4) return { state, effect: nariEditionEffectOf('타자편', nariGameReady) }
  return { state, effect: RECENT_MODE_EFFECT.get(lastPlayedMode) ?? null }
}

/** 마지막 모드 → 곧장 가는 화면 — 5·6 미션 선수 고르기(17) · 7 홈런더비 선수 고르기(16) · 2 시즌 (0x28d66 · 0x28d7e · 0x3284e) */
const RECENT_MODE_EFFECT: ReadonlyMap<number, MainMenuEffect> = new Map<number, MainMenuEffect>([
  [5, '미션'],
  [6, '미션'],
  [7, '홈런더비'],
  [2, '시즌모드'],
])

/** 모드 1 (0x327f8) — +0x4d 면 이어하기, 아니면 [13] 진입 창(앞 상태 0x27 → 커서 1) */
function recentGeneralGameOf(state: MainMenuState, isGeneralGameInProgress: boolean): MainMenuResult {
  if (isGeneralGameInProgress) return { state, effect: '일반모드경기이어하기' }
  const initialSelected = generalModeEntryCursorOf(RESTART_MODE_STATE, isGeneralGameInProgress)
  return { state: { ...state, generalModeWindow: { kind: '진입', initialSelected } }, effect: null }
}
