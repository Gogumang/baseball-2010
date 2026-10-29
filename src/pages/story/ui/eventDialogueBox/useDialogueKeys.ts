import { useEffect, useLayoutEffect, useRef } from 'react'
import type { DialogueChoiceList } from './eventDialogueBoxProps'

const isUpKey = (key: string) => key === 'ArrowUp' || key === '2'
const isDownKey = (key: string) => key === 'ArrowDown' || key === '8'
/** CLR −16 — 웹 Escape · Backspace */
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'
/** 확인 −5 · '5' — 웹 Enter · Space · '5' */
const isConfirmKey = (key: string) => key === 'Enter' || key === ' ' || key === '5'

/** 0x8b8de · 0x8b8f8 — 위 −1 · '2' / 아래 −2 · '8' 로 옮길 줄, 갈래 수로 돈다(0xca910). 옮기지 않는 키면 null */
function choiceMoveOf(key: string, list: DialogueChoiceList): number | null {
  const count = list.lines.length
  if (count === 0) return null
  if (isUpKey(key)) return (list.selected + count - 1) % count
  if (isDownKey(key)) return (list.selected + 1) % count
  return null
}

/**
 * **상자 키 0x8b804** — 선택지 위 · 아래, say 중 CLR(0x8b7b0), 확인. 돌려준 `press` 는 확인과 같다(상자를 누를 때도 쓴다).
 * 최신 콜백은 커밋 뒤 ref 에 적어 두고 키 처리기 · 미룬 확인이 읽는다.
 */
export function useDialogueKeys(
  choices: DialogueChoiceList | null,
  isActive: boolean,
  pressText: () => boolean,
  onAdvance: () => void,
  onCancel: (() => void) | undefined,
  onChoiceMove: ((selected: number) => void) | undefined,
  onChoiceConfirm: ((selected: number) => void) | undefined,
  deferPress: ((run: () => void) => void) | undefined,
) {
  const onAdvanceRef = useRef(onAdvance)
  const choicesRef = useRef(choices)
  const onChoiceMoveRef = useRef(onChoiceMove)
  const onChoiceConfirmRef = useRef(onChoiceConfirm)
  const onCancelRef = useRef(onCancel)
  const deferPressRef = useRef(deferPress)
  useLayoutEffect(() => {
    onAdvanceRef.current = onAdvance
    choicesRef.current = choices
    onChoiceMoveRef.current = onChoiceMove
    onChoiceConfirmRef.current = onChoiceConfirm
    onCancelRef.current = onCancel
    deferPressRef.current = deferPress
  })
  const pressNow = () => {
    const list = choicesRef.current
    if (list !== null) return onChoiceConfirmRef.current?.(list.selected)
    if (pressText()) onAdvanceRef.current()
  }
  const press = () => {
    const defer = deferPressRef.current
    if (defer === undefined) return pressNow()
    defer(pressNow)
  }

  useEffect(() => {
    if (!isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const list = choicesRef.current
      const moved = list === null ? null : choiceMoveOf(event.key, list)
      if (moved !== null) {
        event.preventDefault()
        return onChoiceMoveRef.current?.(moved)
      }
      // 0x8b8a6 — say 갈래의 −16 은 0x8b7b0 (단계와 상관없이)
      if (isCancelKey(event.key) && list === null && onCancelRef.current !== undefined) {
        event.preventDefault()
        return onCancelRef.current()
      }
      if (!isConfirmKey(event.key)) return
      event.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  return [press, onCancelRef] as const
}
