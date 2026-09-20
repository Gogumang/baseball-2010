import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import * as styles from '@/pages/pitching/ui/ManagerHookWindow.css'

/** 창 높이 0 → 55, 틱마다 +15 (0x7fae2 의 `+= 0xf`, 0x37 에서 멈춤) */
const WINDOW_HEIGHT = 55
const HEIGHT_STEP = 15
/** 드러나는 글자 수는 틱마다 +3 (dlg+0xe8) */
const LETTERS_PER_TICK = 3
/** 화자 머리글 — 0x861c0 이 붙이는 문자열 그대로다 */
const SPEAKER_PREFIX = '[감독님] : '

interface ManagerHookWindowProps {
  /** StrUSER_EVT 번호 — 체력 ≤20% 85~87 · 체력 0% 88~90 · 4실점 91~93 · 만루 94~96 */
  readonly userEventIndex: number
  /** 확인을 누르면 상태 0x21(자동진행)로 간다 */
  readonly onConfirm: () => void
}

/**
 * 강판 뒤 감독 대사 창 — 경기 상태 **0x23** (진입 0x50754 → 0x86198, 키 0x50794 · R14 3절).
 *
 * 원본은 **확인 키 하나만** 받는다. 좌/우·취소가 없어 강판을 무를 수 없다.
 * 얼굴 그림은 쓰지 않는 "글만 있는 창" 이다 (0x85f38 은 이 창이 아니다 — R14 3-5 정정).
 *
 * 스스로 강판(`#`)은 이 창을 거치지 않고 곧장 0x21 로 간다 (P1 2-2).
 */
export function ManagerHookWindow({ userEventIndex, onConfirm }: ManagerHookWindowProps) {
  const line = ORIGINAL_USER_EVENTS[userEventIndex] ?? ''
  const [height, setHeight] = useState(0)
  const [letters, setLetters] = useState(0)

  useEffect(() => {
    let current = 0
    const tick = window.setInterval(() => {
      // 상자가 다 올라온 뒤에야 글을 그린다 (0x7fba6 의 반환값)
      if (current < WINDOW_HEIGHT) {
        current = Math.min(current + HEIGHT_STEP, WINDOW_HEIGHT)
        setHeight(current)
        return
      }
      setLetters((shown) => shown + LETTERS_PER_TICK)
    }, millisecondsPerFrame())
    return () => window.clearInterval(tick)
  }, [])

  const shown = line.slice(0, letters)

  return (
    <div className={styles.overlay}>
      <div className={styles.band} />
      <div className={styles.box} style={{ height: `${height}px` }}>
        <p className={styles.text}>
          <span className={styles.speaker}>{SPEAKER_PREFIX}</span>
          {shown}
        </p>
      </div>
      <button type="button" className={styles.key} onClick={onConfirm}>
        확인
      </button>
    </div>
  )
}
