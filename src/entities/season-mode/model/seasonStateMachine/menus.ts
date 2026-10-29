import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine/states'

/** 관리 메뉴 6칸 (점프표 `0xcbe40`, StrHOWTO[18]) */
export const MANAGEMENT_MENU = ['시즌정보', '구단관리', '트레이닝', '외출', '아이템', '다음경기'] as const
export type ManagementMenuItem = (typeof MANAGEMENT_MENU)[number]

export function managementMenuTarget(index: number): SeasonSceneState | null {
  const targets: readonly SeasonSceneState[] = [
    SEASON_SCENE_STATE.시즌정보,
    SEASON_SCENE_STATE.구단관리,
    SEASON_SCENE_STATE.트레이닝,
    SEASON_SCENE_STATE.외출지도,
    SEASON_SCENE_STATE.아이템,
    SEASON_SCENE_STATE.다음경기,
  ]
  return targets[index] ?? null
}

/** 구단관리 하위 4칸 (키 `0x4e40`) */
export const TEAM_MENU = ['구장관리', '트레이드', '선수영입', '코치채용'] as const

export function teamMenuTarget(index: number): SeasonSceneState | null {
  const targets: readonly SeasonSceneState[] = [
    SEASON_SCENE_STATE.구장관리,
    SEASON_SCENE_STATE.트레이드,
    SEASON_SCENE_STATE.선수영입,
    SEASON_SCENE_STATE.선수단, // 코치채용은 선수단 화면을 this+0x11c = 2 로 띄운다
  ]
  return targets[index] ?? null
}

/**
 * **관리 메뉴(this+0x70)·구단관리(this+0x78) 메뉴 커서** — 두 메뉴 객체는 장면 초기화 0x3b14 가 만들어 장면이 사는 동안
 * 남는다. 그래서 상태를 오가도 커서가 이어지고, 들어올 때 지우는 갈래만 0 으로 되돌린다 (직접 떴다).
 */
export interface SeasonMenuCursors {
  /** this+0x70 관리 메뉴 6칸 */
  readonly management: number
  /** this+0x78 구단관리 4칸 */
  readonly teamMenu: number
  /** this+0x74 시즌정보 4칸 (0x3b14 가 `0x6c219(메뉴, 4, 1, 1)` 로 만든다) */
  readonly seasonInfo: number
  /** this+0x88 아이템 하위 메뉴 4칸 (0x3b14 0x3c1a~ 가 만든다) */
  readonly itemMenu: number
}

/** 장면 생성 — 0x6c219 로 만든 메뉴는 커서 (0,0) */
export const INITIAL_SEASON_MENU_CURSORS: SeasonMenuCursors = { management: 0, teamMenu: 0, seasonInfo: 0, itemMenu: 0 }

/**
 * CPU 트레이드 요청 [203] 에 "예" (0x73b8 7440~7484) — 두 메뉴 커서를 칸 1(관리 메뉴 구단관리 · 구단관리 트레이드)에 둔다:
 * `[this+0x70|0x78] +0xc = 1 % 열수 · +0x10 = 1 / 열수` (한 열 메뉴라 곧 줄 1).
 */
export const TRADE_REQUEST_MENU_CURSOR = 1

/**
 * 상태에 들어올 때 메뉴 커서를 지우는 갈래 — `previous` 는 이전 상태 this+0x24.
 * ```
 * 0x4efc (0xc9 진입)  SR+4 ≠ 0 이고 이전 ∉ {0xd8, 0xce, 0xd0} → 관리 메뉴 커서 (0,0) · 스크롤 0
 *                     SR+0x1bc ≠ 0                         → 관리 메뉴 커서 (0,0) · 스크롤 0
 * 0x47d8 (0xce 진입)  이전 == 0xc9                          → 구단관리 커서 (0,0) · 스크롤 0
 * 0x4d58 (0xcd 진입)  이전 == 0xc9                          → 시즌정보 커서 (0,0) · 스크롤 0 (메뉴 vt+0x14(0,0) · +0x2c/+0x30 = 0)
 * 0x4d04 (0xd0 진입)  이전 == 0xc9                          → 아이템 메뉴 커서 (0,0) · 스크롤 0 — 상점·선수 고르기에서 돌아오면 남는다
 * ```
 * 곧 관리 메뉴에서 구단관리로 들어가면 늘 맨 위에서 시작하고, 트레이드·영입 같은 하위 화면에서 돌아오면 자리가 남는다.
 */
export function menuCursorsOnEnter(
  cursors: SeasonMenuCursors,
  entered: SeasonSceneState,
  previous: SeasonSceneState,
  record: Pick<SeasonRecord, 'acted' | 'endingSeen'>,
): SeasonMenuCursors {
  if (entered === SEASON_SCENE_STATE.관리메뉴) return managementCursorsOnEnter(cursors, previous, record)
  const cursor = SUB_MENU_CURSOR_OF.get(entered)
  if (cursor === undefined || previous !== SEASON_SCENE_STATE.관리메뉴) return cursors
  return { ...cursors, [cursor]: 0 }
}

/** 0x4efc — 이 상태에서 돌아오면 관리 메뉴 커서가 남는다 */
const MANAGEMENT_CURSOR_KEEPING_STATES: ReadonlySet<SeasonSceneState> = new Set<SeasonSceneState>([
  SEASON_SCENE_STATE.다음경기,
  SEASON_SCENE_STATE.구단관리,
  SEASON_SCENE_STATE.아이템,
])

/** 0x4efc (0xc9 진입) — SR+4 ≠ 0 이고 이전이 남기는 상태가 아니거나, SR+0x1bc ≠ 0 이면 관리 메뉴 커서 (0,0) */
function managementCursorsOnEnter(
  cursors: SeasonMenuCursors,
  previous: SeasonSceneState,
  record: Pick<SeasonRecord, 'acted' | 'endingSeen'>,
): SeasonMenuCursors {
  const keeps = MANAGEMENT_CURSOR_KEEPING_STATES.has(previous)
  if ((record.acted && !keeps) || record.endingSeen) return { ...cursors, management: 0 }
  return cursors
}

/** 관리 메뉴에서 들어오면 (0,0) 으로 지우는 하위 메뉴 커서 — 0xce 0x47d8 · 0xcd 0x4d58 · 0xd0 0x4d04 */
const SUB_MENU_CURSOR_OF: ReadonlyMap<SeasonSceneState, keyof SeasonMenuCursors> = new Map<SeasonSceneState, keyof SeasonMenuCursors>([
  [SEASON_SCENE_STATE.구단관리, 'teamMenu'],
  [SEASON_SCENE_STATE.시즌정보, 'seasonInfo'],
  [SEASON_SCENE_STATE.아이템, 'itemMenu'],
])
