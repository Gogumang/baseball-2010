import { createPortal } from 'react-dom'
import { useViewportFit } from '@/app/model/useViewportFit'
import { TouchControls } from '@/widgets/touch-controls'

/** 버튼을 얹는 자리 (`index.html`) — `#root` 바깥이라 화면 흔들기(`useWholeScreenOffset`)가 버튼을 옮기지 않는다 */
const CONTROLS_HOST_ID = 'keypad-root'

/**
 * **웹 껍데기** — 화면 배율·배치를 잡고(`useViewportFit`), 터치 기기면 상황 버튼을 화면 아래(세로) · 왼쪽(가로)에 세운다.
 * 게임 화면(`App`)과 형제로 그린다 — 버튼 누름이 화면 쪽 React 사건 거품에 섞이지 않는다.
 */
export function ViewportShell() {
  const fit = useViewportFit()
  const host = typeof document === 'undefined' ? null : document.getElementById(CONTROLS_HOST_ID)
  if (fit === null || fit.layout === 'plain' || host === null) return null
  return createPortal(<TouchControls layout={fit.layout} />, host)
}
