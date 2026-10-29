/**
 * 투수편 관리 화면이 쓰는 **다른 조각** — 나리 관리 메뉴 커서 · 키 · 커맨드 줄 · 가운데 판 · 상세 창(`pages/management`),
 * 기록실 팝업 · 124 목록(`pages/nari-record-room`), 공 무늬 바탕(`pages/special`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
export { DetailWindow } from '@/pages/management/ui/DetailPopup'
export { CommandBar } from '@/pages/management/ui/CommandBar'
export { CenterStage } from '@/pages/management/ui/CenterStage'
export { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
export {
  clearNariReturnSubMenu,
  createNariMainMenuCursor,
  leaveNariSubMenu,
  moveNariMainCursor,
  moveNariSubCursor,
  nariMainCursorOnEntry,
  nariReturnSubMenuOf,
} from '@/pages/management/model/nariMainMenuCursor'
export type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
export { isNariMenuOkKey, nariMenuCursorAfterStep, nariMenuStepOfKey } from '@/pages/management/lib/nariMenuKeys'
export { NariRecordPickPopup, NariRecordView } from '@/pages/nari-record-room'
export type { RecordRoomPick } from '@/pages/nari-record-room'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
