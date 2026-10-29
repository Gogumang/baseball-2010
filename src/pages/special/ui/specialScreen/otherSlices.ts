/**
 * 스페셜 목록 · 명예의 전당이 쓰는 **다른 조각** — 메인 메뉴 바퀴 · 릴 · 바탕 띠(`pages/main-menu`), 기록연감 화면 · 격자 커서 ·
 * 비밀 번호 꼴(`pages/record`), ABILITY 판(`pages/create-player`).
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나 — `hallOfFameScreen/` 도 여기서 읽는다)
 */
export { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
export { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
export { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
export { moveGridCursor } from '@/pages/record/lib/annalsGrid'
export type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
export type { SecretCodeState } from '@/pages/record/lib/statCells'
export { MenuWheel } from '@/pages/main-menu/ui/MenuWheel'
export { MenuWheelUnderlayImage } from '@/pages/main-menu/ui/MenuWheelUnderlayImage'
export {
  MENU_DESCRIPTION_PANEL,
  MENU_PANEL_HEADING_COLOR,
  MENU_REEL_ITEM_FRAMES,
  MENU_REEL_SCROLL_STEPS,
  MENU_REEL_SHADOW_COLOR,
  MENU_REEL_SHADOW_OFFSET,
  MENU_REEL_SLOTS,
  menuPanelHeadingFrameOf,
  menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf,
  menuReelEntryAtSlotOf,
  menuReelFrameListOf,
  menuReelSlotRowOf,
  menuReelTextTopLeftOf,
  menuWheelLabelTopLeftOf,
  menuWheelRestingLabelsOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
export { useMenuBand } from '@/pages/main-menu/model/useMenuBand'
export { useMenuTurn } from '@/pages/main-menu/model/useMenuTurn'
export { MenuBand } from '@/pages/main-menu/ui/MenuBand'
export * as menuStyles from '@/pages/main-menu/ui/MainMenuScreen.css'
export { TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu'
