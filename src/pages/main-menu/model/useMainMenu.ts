import { useEffect, useRef, useState } from 'react'
import { initialMainMenu, reduceMainMenu } from '@/pages/main-menu/model/mainMenu'
import type { MainMenuAction, MainMenuEffect, MainMenuState } from '@/pages/main-menu/model/mainMenu'

/**
 * 메뉴 상태와 화면 단위 키 입력 — 원본대로 ↑↓ 로 고르고 Enter 로 시작, Esc 로 뒤로 간다.
 * `isSheetOpen` 은 예전 셀렉트박스 시절에 키를 시트에 넘겨주던 자리다 (지금은 늘 false 로 들어온다).
 */
export function useMainMenu(
  hasSavedGame: boolean,
  isSheetOpen: boolean,
  onEffect: (effect: Exclude<MainMenuEffect, null>) => void,
): { state: MainMenuState; dispatch: (action: MainMenuAction) => void } {
  const [state, setState] = useState<MainMenuState>(() => initialMainMenu(hasSavedGame))

  const stateRef = useRef(state)
  stateRef.current = state
  const onEffectRef = useRef(onEffect)
  onEffectRef.current = onEffect
  const hasSavedRef = useRef(hasSavedGame)
  hasSavedRef.current = hasSavedGame
  const isSheetOpenRef = useRef(isSheetOpen)
  isSheetOpenRef.current = isSheetOpen

  // setState 업데이터 안에서 부모 콜백을 부르면 StrictMode 가 두 번 부른다 — ref 로 읽고 한 번만 반영한다.
  const dispatchRef = useRef((action: MainMenuAction) => {
    const result = reduceMainMenu(stateRef.current, action, hasSavedRef.current)
    stateRef.current = result.state
    setState(result.state)
    if (result.effect !== null) onEffectRef.current(result.effect)
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSheetOpenRef.current) return
      // 버튼에 포커스가 있으면 브라우저가 Enter 를 클릭으로 처리한다 — 두 번 실행되지 않게 비켜 준다.
      if (event.target instanceof HTMLButtonElement) return

      const dispatch = dispatchRef.current
      if (event.key === 'Enter') {
        event.preventDefault()
        dispatch(stateRef.current.isConfirmingNewGame ? { type: '확인', isAccepted: true } : { type: '시작' })
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        dispatch({ type: '뒤로' })
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // 원본 목록은 ↑↓ 로 고른다 (셀렉트박스였을 때는 시트가 가져가던 키다)
        if (stateRef.current.isConfirmingNewGame) return
        event.preventDefault()
        dispatch({ type: '커서', step: event.key === 'ArrowDown' ? 1 : -1 })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { state, dispatch: (action) => dispatchRef.current(action) }
}
