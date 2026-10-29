import { useEffect } from 'react'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { BACK_KEYS, CONFIRM_KEYS, gridKeyOf, horizontalStepOf, verticalStepOf } from '@/pages/settings/ui/settingsScreen/settingsAssets'

interface SettingsKeysInput {
  /** 안내 · 하위 페이지가 없다 */
  readonly isActive: boolean
  readonly onVertical: (step: number) => void
  /** 좌우 키가 하는 일 — 값 줄은 값 바꾸기, 경기 중 OK 칸은 돌아가기, 그 밖은 null(아무 일 없음) */
  readonly onHorizontal: ((step: number) => void) | null
  readonly onConfirm: () => void
  readonly onBack: () => void
}

/** 환경설정 첫 화면 키 (갱신 0x29550 · 경기 중 0x3cae0~) — effect 는 옛처럼 의존성 없이 그림마다 다시 건다 */
export function useSettingsKeys({ isActive, onVertical, onHorizontal, onConfirm, onBack }: SettingsKeysInput) {
  useEffect(() => {
    if (!isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 숫자키 꼴 1 격자 — '2' '8' '4' '6' '5' 를 ↑ ↓ ← → OK 로 (`gridKeyOf`)
      const key = gridKeyOf(event.key)
      // 격자가 바꾼 키를 0x5550d 에도 넘긴다(2958a · 288e4 · 2c706) — 화살표 꼴이면 [skin+0x8c] 에 남는다(Q-10)
      noteSkinShakeKey(key)
      const vertical = verticalStepOf(key)
      if (vertical !== 0) {
        event.preventDefault()
        return onVertical(vertical)
      }
      const horizontal = horizontalStepOf(key)
      if (horizontal !== 0 && onHorizontal !== null) {
        event.preventDefault()
        return onHorizontal(horizontal)
      }
      if (CONFIRM_KEYS.has(key)) {
        event.preventDefault()
        return onConfirm()
      }
      if (BACK_KEYS.has(key)) {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
