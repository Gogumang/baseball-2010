import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { PressArea } from '@/shared/ui'
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
 * 키 0x50794 (직접 떴다): −5 · '5' 만 보고 대화 상자 단계 [dlg+0xec] 로 가른다 — 1(글 찍는 중) → 2(다 보이기) ·
 * 4(다 찍힘) → 닫기(0x7b871 · 0x86229 …) → 0x21. 그 밖 단계(상자가 올라오는 중)에는 아무 일도 없다.
 * ⚠️ 앞서 웹은 키를 안 받고 웹 글자 단추 "확인" 만 있어 키보드로는 경기가 멈췄다 (r82) — 단추를 투명 누름 칸으로 바꾸고 키를 잇는다.
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

  /** OK 한 번 — 상자가 다 올라오기 전엔 버리고, 글을 찍는 중이면 다 보이고, 다 찍혔으면 닫는다 */
  const pressOk = () => {
    if (height < WINDOW_HEIGHT) return
    if (letters < line.length) return setLetters(line.length)
    onConfirm()
  }
  const pressOkRef = useRef(pressOk)
  pressOkRef.current = pressOk
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== '5' && event.key !== ' ') return
      event.preventDefault()
      pressOkRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.band} />
      <div className={styles.box} style={{ height: `${height}px` }}>
        <p className={styles.text}>
          <span className={styles.speaker}>{SPEAKER_PREFIX}</span>
          {shown}
        </p>
      </div>
      {/* 원본 창에는 글자 단추가 없다 — 창 자리(띠 12 + 본체 55, 바닥에서 67)를 투명 누름 칸으로 */}
      <PressArea label="확인" rect={{ x: 0, y: 320 - 12 - WINDOW_HEIGHT, width: 240, height: 12 + WINDOW_HEIGHT }} onPress={pressOk} />
    </div>
  )
}
