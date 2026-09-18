import { useEffect, useRef, useState } from 'react'
import { initialMainMenu, reduceMainMenu } from '@/pages/main-menu/model/mainMenu'
import type { MainMenuAction, MainMenuEffect, MainMenuState } from '@/pages/main-menu/model/mainMenu'

/**
 * 메뉴 상태와 화면 단위 키 입력 (Enter 시작, Esc 뒤로).
 * 셀렉트박스 시트가 열려 있으면 키는 시트가 가져가므로 여기서는 무시한다.
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { state, dispatch: (action) => dispatchRef.current(action) }
}
