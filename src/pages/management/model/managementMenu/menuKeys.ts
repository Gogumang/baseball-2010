import { abilityDetailScrollKeyOf, batterAbilityDetailViewOf, scrollAbilityDetail } from '@/pages/management/lib/abilityDetail'
import { isNariMenuOkKey, nariMenuCursorAfterStep, nariMenuStepOfKey } from '@/pages/management/lib/nariMenuKeys'
import type { MenuContext } from './menuContext'

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/** 120 키 0x1b654 — 취소·'0' → 119, 그 밖은 0x8a044 글 스크롤(↑·'2' / ↓·'8', 나머지 키는 아무 일도 없다) */
function abilityDetailKey(m: MenuContext, event: KeyboardEvent, offset: number) {
  if (isCancelKey(event.key) || event.key === '0') return m.setAbilityDetailOffset(null)
  const direction = abilityDetailScrollKeyOf(event.key)
  if (direction === null) return
  event.preventDefault()
  const lineCount = batterAbilityDetailViewOf(m.props.career).messages.length
  m.setAbilityDetailOffset(scrollAbilityDetail(offset, lineCount, direction))
}

/**
 * 119 키 0x1056c — '0'(0x30) → 120 능력치 상세 (진입 0x1b624: 글을 새로 만들고 스크롤 0) · '*' → 129 칭호 목록, 129 의 '*' → 119.
 * 받은 키면 참.
 *
 * ⚠️ 원작 설명서 StrHOWTO[15] 는 "[선수정보] -> [기본정보]에서 **(#) 키**로 확인 및 변경" 이라 적었지만,
 * 119 의 키 처리 `0x1056c` 가 실제로 보는 값은 **'*'(0x2a)** 다 (R9 「119·129·120 … 확정」:
 * `취소(−16) → 106, '*'(0x2a) → 129, '0'(0x30) → 120`). 설명서와 코드가 어긋나는 자리라
 * **코드 쪽을 그대로 옮긴다**. 129 에서 '*' 는 다시 119 로 돌아가는 키다 (0x11f9a, P3 10-1).
 */
function basicInfoKey(m: MenuContext, key: string): boolean {
  const isCardOnly = m.isShowingBasicInfo && m.overlay === null
  if (key === '0' && isCardOnly) {
    m.setAbilityDetailOffset(0)
    return true
  }
  if (key !== '*') return false
  if (m.overlay === '칭호') m.setOverlay(null)
  else if (isCardOnly) m.setOverlay('칭호')
  return true
}

/** 커맨드 줄 — vt+0x18 0x6c299 → 0x6c031(숫자키 꼴 1) → vt+8 0x6c445 (←↑'4''2' / →↓'6''8', 꺼진 칸은 건너뛴다) · OK(−5) · '5' */
function commandBarKey(m: MenuContext, event: KeyboardEvent, select: (id: string) => void) {
  const step = nariMenuStepOfKey(event.key)
  if (step !== 0) {
    event.preventDefault()
    return m.moveCursor(nariMenuCursorAfterStep(m.cursor, step, m.slots.length, m.isOffSlot))
  }
  if (isNariMenuOkKey(event.key)) select(m.slots[m.cursor].id)
}

/** 상세 결과 창 — 확인 · 취소로 닫는다 */
function detailKey(m: MenuContext, key: string) {
  if (key === 'Enter' || key === 'Escape') m.props.onCloseDetail()
}

/**
 * 관리 화면 키 — 질문 창이 떠 있을 때의 키는 MessageBox 가 잡는 단계에서 가져가므로 여기까지 오지 않는다.
 * 상세 결과 창 → 127 연출(확인 키는 `RestScene` 이 받는다, 0x10650) · 칸 펼침 → 120 → 취소 → 119 → 커맨드 줄 차례.
 */
export const menuKeyHandlerOf = (m: MenuContext, back: () => void, select: (id: string) => void) => (event: KeyboardEvent) => {
  if (m.props.detail !== null) return detailKey(m, event.key)
  if (m.restPhase === 'playing' || m.isSliding()) return
  if (m.abilityDetailOffset !== null) return abilityDetailKey(m, event, m.abilityDetailOffset)
  if (isCancelKey(event.key)) return back()
  if (basicInfoKey(m, event.key)) return
  // 창이 열려 있거나 119 카드 · 125 연출이 떠 있으면 뒤쪽 커맨드 줄은 방향키·확인에 반응하지 않는다
  if (m.isCommandBarIdle()) commandBarKey(m, event, select)
}
