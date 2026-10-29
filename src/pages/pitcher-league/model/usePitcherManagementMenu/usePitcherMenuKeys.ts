import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { moveSpecialTrainingCursor, specialTrainingKeyOf } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import type { PitcherMenuChoice, PitcherMenuDetail, PitcherMenuQuestion, PitcherMenuWindow } from './menuTypes'
import { ABILITY_DETAIL_VISIBLE_LINES, abilityDetailScrollKeyOf, scrollAbilityDetail } from './otherSlices'
import type { PitcherRestPhase } from './useRestRun'

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'
const abilityDetailLineCountOf = (career: PitcherCareer) => pitcherAbilityDetailViewOf(career).messages.length

/**
 * 커맨드 줄 밖에서 받는 키 — 108 마구 창 · 120 능력치 상세 · 119 기본정보(129 칭호) · 상세 결과 창, 그리고 120 의 터치 스크롤 버튼.
 *
 * 119 에서 칭호 목록(129)을 여는 키:
 * ⚠️ 원작 **설명서** StrHOWTO[15] 는 "(#) 키" 라고 적었지만, 119 의 키 처리 `0x1056c` 가 실제로
 * 보는 값은 **'*'(0x2a)** 다 (R9-myleague-states 301~303: `취소(−16) → 106, '*'(0x2a) → 129,
 * '0'(0x30) → 120`). 설명서와 코드가 어긋나는 자리라 **코드 쪽을 그대로 옮긴다** — 타자편
 * `useManagementMenu` 와 같은 처리다. 129 에서 '*' 는 다시 119 로 돌아가는 키다 (0x11f9a).
 */
export function usePitcherMenuKeys(
  career: PitcherCareer,
  question: PitcherMenuQuestion | null,
  choice: PitcherMenuChoice | null,
  notice: string,
  restPhase: PitcherRestPhase,
  subWindow: PitcherMenuWindow,
  magicTrainingCursor: number,
  setMagicTrainingCursor: Dispatch<SetStateAction<number>>,
  confirmMagicTrainingCell: (cell: number) => void,
  back: () => void,
  abilityDetailOffset: number | null,
  setAbilityDetailOffset: Dispatch<SetStateAction<number | null>>,
  isTitleWindowOpen: boolean,
  setIsTitleWindowOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    // 팝업이 떠 있으면 그쪽이 먼저 키를 가져간다 (원본도 창 위 팝업이 키를 잡는다). 127 연출은 `RestScene` 이 받는다
    const isPopupOpen = question !== null || choice !== null || notice !== '' || restPhase === 'playing'
    const onKey = (event: KeyboardEvent) => {
      if (isPopupOpen) return undefined
      if (subWindow === '마구훈련') return pressMagicWindowKey(event, magicTrainingCursor, confirmMagicTrainingCell, back, setMagicTrainingCursor)
      // 120 키 0x1b654 — 취소·'0' → 119, 그 밖은 0x8a044 글 스크롤(↑·'2' / ↓·'8')
      if (abilityDetailOffset !== null) return pressAbilityDetailKey(event, abilityDetailOffset, career, setAbilityDetailOffset)
      return pressBasicInfoKey(event, subWindow === '기본정보', isTitleWindowOpen, back, setAbilityDetailOffset, setIsTitleWindowOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    abilityDetailOffset,
    back,
    career,
    choice,
    confirmMagicTrainingCell,
    isTitleWindowOpen,
    magicTrainingCursor,
    notice,
    question,
    restPhase,
    subWindow,
    setAbilityDetailOffset,
    setIsTitleWindowOpen,
    setMagicTrainingCursor,
  ])
}

/** 상세 결과 창의 키 — 확인·취소로 닫는다 (타자편 `useManagementMenu` 와 같은 처리, 0x1b4c4 가 보는 닫기 키) */
export function useDetailCloseKeys(detail: PitcherMenuDetail | null, closeDetail: () => void) {
  useEffect(() => {
    if (detail === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDetail, detail])
}

/** 터치 기기 — 120 글이 4줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건 → 0x8a044 스크롤). 원본 그림에는 막대뿐이다 */
export function useAbilityDetailTouchKeys(isPopupFree: boolean, abilityDetailOffset: number | null, career: PitcherCareer) {
  useTouchScrollKeys(isPopupFree && abilityDetailOffset !== null && abilityDetailLineCountOf(career) > ABILITY_DETAIL_VISIBLE_LINES)
}

/**
 * 108 마구 창 — 확인(−5 / '5')은 0x17828 의 칸 가드, 그 밖 키는 창 객체 0x80269 가 탭 격자(4, 1, 0x330)를 옮긴다.
 * 칸 넷이 한 줄이라 ←→ 로 돌고 끝에서 감기며, ↑ 는 왼쪽 · ↓ 는 오른쪽 칸이 된다(타자 필살타법 창과 같은 창 키). 취소는 `back`.
 */
function pressMagicWindowKey(
  event: KeyboardEvent,
  cursor: number,
  confirmMagicTrainingCell: (cell: number) => void,
  back: () => void,
  setMagicTrainingCursor: Dispatch<SetStateAction<number>>,
) {
  const key = specialTrainingKeyOf(event.key)
  if (key === null) return undefined
  event.preventDefault()
  if (key === 'ok') return confirmMagicTrainingCell(cursor)
  // 취소(−16) → 107 (17a76 `0xbcb49(this+0x18, 0x6b)`)
  if (key === 'clr') return back()
  return setMagicTrainingCursor((current) => moveSpecialTrainingCursor(current, key))
}

/** 120 키 0x1b654 */
function pressAbilityDetailKey(
  event: KeyboardEvent,
  offset: number,
  career: PitcherCareer,
  setAbilityDetailOffset: Dispatch<SetStateAction<number | null>>,
) {
  if (isCancelKey(event.key) || event.key === '0') return setAbilityDetailOffset(null)
  const direction = abilityDetailScrollKeyOf(event.key)
  if (direction === null) return undefined
  event.preventDefault()
  return setAbilityDetailOffset(scrollAbilityDetail(offset, abilityDetailLineCountOf(career), direction))
}

/** 119 키 0x1056c · 129 키 0x11f9a — 119 에는 커맨드 줄이 없어 여기서 받는다. '*' 는 129 가 떠 있으면 어느 창에서든 닫는다 */
function pressBasicInfoKey(
  event: KeyboardEvent,
  isBasicInfo: boolean,
  isTitleWindowOpen: boolean,
  back: () => void,
  setAbilityDetailOffset: Dispatch<SetStateAction<number | null>>,
  setIsTitleWindowOpen: Dispatch<SetStateAction<boolean>>,
) {
  // '0'(0x30) → 120 (진입 0x1b624: 글을 새로 만들고 스크롤 0)
  if (event.key === '0' && isBasicInfo && !isTitleWindowOpen) return setAbilityDetailOffset(0)
  // 취소(−16) → 106 · 129 취소 → 119 (`back`)
  if (isCancelKey(event.key) && isBasicInfo) {
    event.preventDefault()
    return back()
  }
  if (event.key === '*') pressTitleKey(isBasicInfo, isTitleWindowOpen, setIsTitleWindowOpen)
  return undefined
}

/** '*' — 129 가 떠 있으면 닫고(0x11f9a), 119 면 연다(0x1056c) */
function pressTitleKey(isBasicInfo: boolean, isTitleWindowOpen: boolean, setIsTitleWindowOpen: Dispatch<SetStateAction<boolean>>) {
  if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
  if (isBasicInfo) setIsTitleWindowOpen(true)
  return undefined
}
