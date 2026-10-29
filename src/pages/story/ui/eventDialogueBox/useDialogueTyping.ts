import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EVENT_DIALOGUE, lowerDialogueBox, pressDialogue, restartDialogueText, startDialogue, tickDialogue } from '@/pages/story/lib/eventDialogue'
import type { DialogueLayout, DialogueState } from '@/pages/story/lib/eventDialogue'

/** 그리기 한 번(0x7fbc4)을 거친 상자 — 명령이 돌거나 상자를 내린 틀에도 그 틀의 그리기가 높이를 올리고 글을 찍는다 */
const drawnState = (state: DialogueState, layout: DialogueLayout | null) => tickDialogue(state, layout)

/**
 * **상자 칸 · 틀마다 찍기** — 창 칸(높이 · 첫 줄 · 드러난 바이트 · 단계)과 넘김 표시 애니를 그린 횟수.
 * 명령이 돈 틀(`textKey`) · 상자를 내린 틀(`lowerKey`)은 그림에서 칸을 맞추고(React 의 "props 가 바뀌면 상태를 맞춘다"), 그 뒤 틀은
 * 틀 시계가 고친다. 셋째 값 `pressText` 는 say 확인 키 0x8b804 — 글 끝(단계 4)이면 참(다음 명령으로)이고 칸은 안 고친다.
 */
export function useDialogueTyping(
  slideIn: boolean,
  typingLayout: DialogueLayout | null,
  textKey: string,
  lowerKey: number,
  tickInterval: (callback: () => void) => () => void,
) {
  const [state, setState] = useState<DialogueState>(() => drawnState(startDialogue(slideIn), typingLayout))
  /** 넘김 표시 애니(0x93d90)를 그린 횟수 — 다 올라온 그리기마다 하나 (그린 뒤 한 칸 돌린다) */
  const [cursorUpdates, setCursorUpdates] = useState(() => (state.height === EVENT_DIALOGUE.boxHeight ? 1 : 0))

  // 명령이 돈 틀 — 글 찍기를 처음으로 돌리고 그 틀의 그리기를 거친다 (React 의 "props 가 바뀌면 상태를 맞춘다")
  const [textKeySeen, setTextKeySeen] = useState(textKey)
  const [lowerKeySeen, setLowerKeySeen] = useState(lowerKey)
  if (lowerKey !== lowerKeySeen || textKey !== textKeySeen) {
    const lowered = lowerKey !== lowerKeySeen ? lowerDialogueBox(state) : state
    const drawn = drawnState(restartDialogueText(lowered), typingLayout)
    setLowerKeySeen(lowerKey)
    setTextKeySeen(textKey)
    setState(drawn)
    if (drawn.height === EVENT_DIALOGUE.boxHeight) setCursorUpdates((count) => count + 1)
  }

  const stateRef = useRef(state)
  const layoutRef = useRef(typingLayout)
  useLayoutEffect(() => {
    stateRef.current = state
    layoutRef.current = typingLayout
  })
  // 명령이 돌거나 상자를 내린 틀은 위에서 이미 그렸다 — 다음 그리기는 한 틀 뒤다(틀 시계를 그 틀에 맞춘다)
  const tickIntervalRef = useRef(tickInterval)
  useLayoutEffect(() => {
    tickIntervalRef.current = tickInterval
  })
  useEffect(() => {
    const tick = tickIntervalRef.current(() => {
      const next = tickDialogue(stateRef.current, layoutRef.current)
      stateRef.current = next
      setState(next)
      // 0x7fd9a — 다 올라온 그리기마다 넘김 표시를 그리고 한 칸 돌린다(0x93d90)
      if (next.height === EVENT_DIALOGUE.boxHeight) setCursorUpdates((count) => count + 1)
    })
    return () => tick()
  }, [textKeySeen, lowerKeySeen])

  const pressText = (): boolean => {
    const pressed = pressDialogue(stateRef.current)
    if (pressed.advance) return true
    stateRef.current = pressed.state
    setState(pressed.state)
    return false
  }
  return [state, cursorUpdates, pressText] as const
}
