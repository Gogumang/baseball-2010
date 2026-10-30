import { useEffect } from 'react'
import type { MatchSettingsKey } from '@/pages/match-settings/lib/matchSettingsMenu'
import { keyOf } from './settingsKeys'

/** 창의 키 — 확인창이 떠 있는 동안 키는 MessageBox 것이다 (그쪽이 잡는 단계에서 막는다). 그림마다 지금 창으로 다시 건다 */
export function useSettingsKeys(isPopupShown: boolean, press: (key: MatchSettingsKey) => void) {
  useEffect(() => {
    if (isPopupShown) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const key = keyOf(event.key)
      if (key === null) return
      event.preventDefault()
      press(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
