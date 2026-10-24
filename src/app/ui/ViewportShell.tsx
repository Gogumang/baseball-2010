import { createPortal } from 'react-dom'
import { useViewportFit } from '@/app/model/useViewportFit'
import { PhoneKeypad } from '@/widgets/phone-keypad'

/** 키패드를 얹는 자리 (`index.html`) — `#root` 바깥이라 화면 흔들기(`useWholeScreenOffset`)가 키패드를 옮기지 않는다 */
const KEYPAD_HOST_ID = 'keypad-root'

/**
 * **웹 껍데기** — 화면 배율·배치를 잡고(`useViewportFit`), 터치 기기면 키패드를 화면 아래(세로) · 옆(가로)에 세운다.
 * 게임 화면(`App`)과 형제로 그린다 — 키패드 누름이 화면 쪽 React 사건 거품에 섞이지 않는다.
 */
export function ViewportShell() {
  const fit = useViewportFit()
  const host = typeof document === 'undefined' ? null : document.getElementById(KEYPAD_HOST_ID)
  if (fit === null || fit.layout === 'plain' || host === null) return null
  return createPortal(<PhoneKeypad />, host)
}
