import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import type { HallOfFamePopup } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

/** 원본 문구 (StrCOMMON · 0xcc214 · StrMODE[219]) */
export const HALL_OF_FAME_TEXT = {
  nariFirst: '!C!cFFFFFF나만의리그 선수를!N먼저 등록해야합니다', // StrCOMMON[38]
  confirm: '!C!cffffff명예의 전당에 선수를!N등록하시겠습니까?!N(!cFFFF0020000 G포인트 소모!cFFFFFF)', // StrCOMMON[50]
  full: '!C!cffffff명예의 전당에!N빈슬롯이 없습니다', // StrCOMMON[51]
  done: '!C!cffffff명예의 전당에!N등록이 완료되었습니다', // StrCOMMON[52]
  shortage: '!C!cFF0000G포인트가 부족합니다.!cFFFFFF 구매!N페이지로 이동하시겠습니까?', // 0xcc214
  later: '!C나중에 등록 하시겠습니까?!N메인 메뉴로 이동합니다', // StrMODE[219]
  deleteConfirm: ORIGINAL_MAIN_MENU_TEXT[128] ?? '', // StrMAINMENU[128]
  deleteBlocked: ORIGINAL_MAIN_MENU_TEXT[213] ?? '', // StrMAINMENU[213]
  deleted: '!C!cffffff선수를 삭제하였습니다', // StrCOMMON[46]
  hallOfFameFirst: '!C!cFFFFFF명예의전당 선수를!N먼저 등록해야합니다', // StrCOMMON[39]
  // StrCOMMON[45] / [54] — 슬롯 현금 구매 (🌐)
  buyPitcherSlots:
    '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N투수 슬롯 2개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF0000500원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
  buyBatterSlots:
    '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N타자 슬롯 4개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF00001000원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
} as const

/** 말풍선 둘째 칸 — 슬롯에서 삭제 */
export const HALL_OF_FAME_BUBBLE_DELETE = 1

/**
 * 말풍선 칸을 웹이 못 할 때의 안내 — 선물은 통신(🌐)이라 늘 이 글이다. 삭제는 `deletion` 을 안 넘긴 화면에서만 뜬다.
 * ⚠️ 원본 선물 칸은 막기 검사(StrMAINMENU[214]) 뒤 [127] 설명 · 통신(0x62956)이다 — 통신이라 옮기지 않았다.
 */
export const HALL_OF_FAME_BUBBLE_NOTICES = ['친구에게 선물은!N통신이 필요합니다', '슬롯에서 삭제는!N여기서 할 수 없습니다'] as const

/** 팝업 글 · 단추 — 히든 알림은 앱의 공용 창이 그려 null */
export function popupTextOf(popup: HallOfFamePopup): {
  readonly text: string
  readonly buttons: readonly string[]
  /** 처음 커서 — 0x749d5 를 부르는 자리만 준다 (안 주면 첫 칸) */
  readonly initialSelected?: number
} | null {
  // 히든 알림은 앱의 공용 창이 그린다
  if (popup.kind === '히든알림') return null
  if (popup.kind === '확인') return { text: HALL_OF_FAME_TEXT.confirm, buttons: ['예', '아니오'] }
  if (popup.kind === 'G부족') return { text: HALL_OF_FAME_TEXT.shortage, buttons: ['예', '아니오'] }
  if (popup.kind === '나중에') return { text: HALL_OF_FAME_TEXT.later, buttons: ['예', '아니오'] }
  if (popup.kind === '완료') return { text: HALL_OF_FAME_TEXT.done, buttons: ['확인'] }
  // 0x2ae3a 0x74ef5(…[128], 종류 2) 바로 뒤 0x2ae42 `0x749d5(popup, 1)` — 처음 커서 "아니오"
  if (popup.kind === '삭제확인') return { text: HALL_OF_FAME_TEXT.deleteConfirm, buttons: ['예', '아니오'], initialSelected: 1 }
  return { text: popup.text, buttons: popup.buttons }
}
