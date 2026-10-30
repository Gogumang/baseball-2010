import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { RETRY_DEFAULT_ANSWER } from '@/pages/home-run-derby/lib/derbyResultLayout'

/** ←/→(−3 · −4) · '4' · '6' — 방향과 상관없이 답을 뒤집는다 (40a1c~40a50) */
const TOGGLE_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', '4', 'ArrowRight', '6'])
/** 확인(−5 · '5') */
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
/** 취소(−16) */
const CANCEL_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/** 재도전 묻기 키 0x40a08 — 고른 답([장면+0x17f9], 처음 예)을 돌려준다. 예 → `onRetry` · 아니오 · 취소 → `onExit` (한 번만) */
export function useRetryAnswer(onRetry: () => void, onExit: () => void): boolean {
  const [answer, setAnswer] = useState(RETRY_DEFAULT_ANSWER)
  // 키 0x40a08 은 경기 장면 상태 0x1a 의 상태 키 함수(52da2~)라 받은 다음 틀에 돈다 — 장면 키 칸(`pushSceneKey`, 밑의 결과 배경
  // 타석이 올려 둔 칸)에 넣고 그 틀 머리에서 꺼낸다. 고른 답은 꺼낸 차례대로 고친다(앞 틀의 ←/→ 를 다음 틀의 OK 가 본다)
  const answerRef = useRef(answer)
  const exitRef = useRef({ onRetry, onExit })
  useLayoutEffect(() => {
    exitRef.current = { onRetry, onExit }
  })
  const isDoneRef = useRef(false)
  useEffect(() => {
    const choose = (next: boolean) => {
      answerRef.current = next
      setAnswer(next)
    }
    const leave = (retry: boolean) => {
      if (isDoneRef.current) return
      isDoneRef.current = true
      if (retry) exitRef.current.onRetry()
      else exitRef.current.onExit()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // ←/→(−3 · −4) · '4' · '6' 은 방향과 상관없이 모두 40a42 로 가 [장면+0x17f9] 를 0 ↔ 1 **뒤집는다** (40a1c~40a50, r333).
      // 예전 웹은 ← = 예 · → = 아니오로 고정해, 예에서 ← 를 누르면 원본은 아니오로 가는데 웹은 예에 머물렀다
      if (TOGGLE_KEYS.has(event.key)) {
        pushSceneKey(() => choose(!answerRef.current))
      } else if (CONFIRM_KEYS.has(event.key)) {
        event.preventDefault()
        // 예(5/−5 키) → 모드 7 재시작 · 아니오 → 메인 메뉴 (0x40a08)
        pushSceneKey(() => leave(answerRef.current))
      } else if (CANCEL_KEYS.has(event.key)) {
        // 취소도 "아니오" 와 같은 길이다 (0x40a08)
        pushSceneKey(() => leave(false))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return answer
}
