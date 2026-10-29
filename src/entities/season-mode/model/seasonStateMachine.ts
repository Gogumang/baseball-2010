/**
 * 시즌모드 장면 0x105 의 상태 기계 — `docs/re/P4-season-flow.md` 1a·1b 절 (구조 확정). 전이 규칙만 옮긴다.
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonStateMachine/`): `states`(서브 상태 번호 · phase SR+0x50) · `sceneEntry`(진입 분기 0xcb 0x4b50) ·
 * `menus`(관리 메뉴 0xcbe40 · 구단관리 0x4e40 · 메뉴 커서 0x4efc · 0x47d8 · 0x4d58 · 0x4d04) · `seasonEnd`(경기 뒤 0x49a4 · 시즌 끝 사슬 ·
 * 순위 이벤트 0x6c90 · 한국시리즈 뒤 0x87b4) · `otherSlices`(다른 조각)
 */
export { SEASON_PHASE, SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine/states'
export { enterSeasonScene } from '@/entities/season-mode/model/seasonStateMachine/sceneEntry'
export {
  INITIAL_SEASON_MENU_CURSORS,
  MANAGEMENT_MENU,
  managementMenuTarget,
  menuCursorsOnEnter,
  TEAM_MENU,
  teamMenuTarget,
  TRADE_REQUEST_MENU_CURSOR,
  type ManagementMenuItem,
  type SeasonMenuCursors,
} from '@/entities/season-mode/model/seasonStateMachine/menus'
export {
  afterGameNext,
  afterKoreanSeries,
  isRegularSeasonOver,
  opensManagementMenu,
  regularSeasonRankEventId,
  SEASON_END_CHAIN,
  seasonOpponentOf,
} from '@/entities/season-mode/model/seasonStateMachine/seasonEnd'
