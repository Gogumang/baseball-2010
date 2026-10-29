import { hallOfFameEntryOfSlot } from '@/pages/special/lib/specialLayout'
import { HALL_OF_FAME_BUBBLE_DELETE, HALL_OF_FAME_BUBBLE_NOTICES, HALL_OF_FAME_TEXT } from '@/pages/special/ui/hallOfFameScreen/hallOfFameText'
import type { HallOfFameMode, HallOfFamePopup } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

type RegisterMode = Extract<HallOfFameMode, { kind: '등록' }>

/** 팝업 답이 고치는 것 */
export interface HallOfFamePopupSetters {
  readonly setPopup: (popup: HallOfFamePopup | null) => void
  readonly setNotice: (text: string) => void
  readonly closeBubble: () => void
}

/** 등록 확인 "예" — 결과로 다음 창을 고른다 */
function registerResultPopupOf(result: ReturnType<RegisterMode['onRegister']>): HallOfFamePopup {
  if (result === 'G부족') return { kind: 'G부족' }
  if (result === '빈칸없음') return { kind: '알림', text: HALL_OF_FAME_TEXT.full, buttons: ['확인'] }
  return { kind: '완료' }
}

/** 등록 목록의 팝업 답 — 확인(0x16) · 나중에(StrMODE[219]) · 완료(0x30) · G 부족(0x17) */
function answerRegisterPopup(mode: RegisterMode, popup: HallOfFamePopup, index: number, { setPopup }: HallOfFamePopupSetters): void {
  if (popup.kind === '확인') {
    if (index !== 0) return setPopup(null)
    return setPopup(registerResultPopupOf(mode.onRegister(popup.slot)))
  }
  if (popup.kind === '나중에') return index === 0 ? mode.onLater() : setPopup(null)
  if (popup.kind === '완료') {
    if (mode.openRegisteredHidden?.(mode.onDone) === true) return setPopup({ kind: '히든알림' })
    return mode.onDone()
  }
  // G 부족 "예" 는 결과 7 → G 충전 페이지 139(🌐) — 웹은 목록으로 돌아온다
  setPopup(null)
}

/** 팝업 답 */
export function answerHallOfFamePopup(mode: HallOfFameMode, popup: HallOfFamePopup | null, index: number, setters: HallOfFamePopupSetters): void {
  // 삭제 확인 "예"(결과 0) → 0x62994: 칸 비우기 · 저장 · StrCOMMON[46]. "아니오" 는 0x62e54 — 창만 닫는다
  if (popup?.kind === '삭제확인' && mode.kind === '보기' && mode.deletion !== undefined) {
    if (index !== 0) return setters.setPopup(null)
    mode.deletion.onDelete(popup.side, popup.slot)
    return setters.setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleted, buttons: ['확인'] })
  }
  if (popup === null || mode.kind !== '등록') return setters.setPopup(null)
  answerRegisterPopup(mode, popup, index, setters)
}

/** 말풍선 OK (0x2ac00 하위 1) — 0 선물(🌐, 안내만) · 1 슬롯에서 삭제 */
export function chooseHallOfFameBubble(mode: HallOfFameMode, slot: number, index: number, setters: HallOfFamePopupSetters): void {
  const entry = hallOfFameEntryOfSlot(slot)
  if (index !== HALL_OF_FAME_BUBBLE_DELETE || mode.kind !== '보기' || mode.deletion === undefined || entry === null) {
    return setters.setNotice(HALL_OF_FAME_BUBBLE_NOTICES[index])
  }
  // 막히면 [213] 만 띄우고 말풍선은 그대로(하위 상태 그대로), 통과하면 [128] 확인 + 하위 0(말풍선 닫힘)
  if (mode.deletion.isBlocked(entry.side, entry.index)) {
    return setters.setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleteBlocked, buttons: ['확인'] })
  }
  setters.closeBubble()
  setters.setPopup({ kind: '삭제확인', side: entry.side, slot: entry.index })
}
