import { useEffect, useRef, useState } from 'react'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { PressArea } from '@/shared/ui'
import * as styles from '@/pages/pitching/ui/ManagerHookWindow.css'
import { gameSceneTickNow, isGameSceneFrozen, setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'
import { runSceneKeys, useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

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
 * 원본은 **확인 키 하나만** 받는다. 좌/우·취소가 없어 강판을 무를 수 없다. 키는 받은 다음 틀의 상태 키 자리(52da2 → 52e10)에서
 * 그 틀의 갱신보다 먼저 돈다(r167).
 * 키 0x50794 (직접 떴다): −5 · '5' 만 보고 대화 상자 단계 [dlg+0xec] 로 가른다 — 1(글 찍는 중) → 2(다 보이기) ·
 * 4(다 찍힘) → 닫기(0x7b871 · 0x86229 …) → 0x21. 그 밖 단계(상자가 올라오는 중)에는 아무 일도 없다.
 * (r82 정정 기록) 앞서 웹은 키를 안 받고 웹 글자 단추 "확인" 만 있어 키보드로는 경기가 멈췄다 — 단추를 투명 누름 칸으로 바꾸고 키를 이었다.
 * 얼굴 그림은 쓰지 않는 "글만 있는 창" 이다 (0x85f38 은 이 창이 아니다 — R14 3-5 정정).
 *
 * 스스로 강판(`#`)은 이 창을 거치지 않고 곧장 0x21 로 간다 (P1 2-2).
 */
export function ManagerHookWindow({ userEventIndex, onConfirm }: ManagerHookWindowProps) {
  const line = ORIGINAL_USER_EVENTS[userEventIndex] ?? ''
  const [height, setHeight] = useState(0)
  const [letters, setLetters] = useState(0)
  /** 틀이 보는 값 — 키(52da2 0x50794)와 갱신이 그리기를 기다리지 않고 이 값을 본다 */
  const heightRef = useRef(0)
  const lettersRef = useRef(0)
  const lineRef = useRef(line)
  lineRef.current = line
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm
  /**
   * 받은 키 칸 — 키 0x50794 는 받은 다음 틀의 52da2~ 상태 키 자리(52e10)에서 그 틀의 갱신(52e14~ — 상자 높이 · 글자 수)보다 먼저
   * 돈다(`sceneKeyLatch`). 창이 선 틀(52cc6)에는 버린다
   */
  const keyLatch = useSceneKeyLatchOwner()

  /** OK 한 번 — 상자가 다 올라오기 전엔 버리고, 글을 찍는 중이면 다 보이고, 다 찍혔으면 닫는다 */
  const pressOkNow = () => {
    if (heightRef.current < WINDOW_HEIGHT) return
    const length = lineRef.current.length
    if (lettersRef.current < length) {
      lettersRef.current = length
      setLetters(length)
      return
    }
    onConfirmRef.current()
  }
  const pressOkNowRef = useRef(pressOkNow)
  pressOkNowRef.current = pressOkNow
  const pressOk = () => keyLatch.push(() => pressOkNowRef.current())

  useEffect(() => {
    const tick = setGameSceneTickInterval(() => {
      // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 키 · 갱신을 건너뛴다 — 이 틱도 안 오르고 닫히면 이어 오른다
      if (isGameSceneFrozen()) {
        keyLatch.clear()
        return
      }
      // 52da2~52e10 — 앞 틀 뒤에 받은 키가 갱신보다 먼저
      runSceneKeys(keyLatch, gameSceneTickNow())
      // 상자가 다 올라온 뒤에야 글을 그린다 (0x7fba6 의 반환값)
      if (heightRef.current < WINDOW_HEIGHT) {
        heightRef.current = Math.min(heightRef.current + HEIGHT_STEP, WINDOW_HEIGHT)
        setHeight(heightRef.current)
        return
      }
      lettersRef.current += LETTERS_PER_TICK
      setLetters(lettersRef.current)
    })
    return () => tick()
  }, [keyLatch])

  const shown = line.slice(0, letters)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== '5' && event.key !== ' ') return
      event.preventDefault()
      keyLatch.push(() => pressOkNowRef.current())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch])

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
