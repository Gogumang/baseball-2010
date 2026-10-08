import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { GAUGE_LAST_CELL } from '@/entities/pitcher-career/model/pitchGauge'
import {
  gaugePressedCellOf,
  isPitchReleaseDue,
  originalKeyCodeOf,
  KEY_OK,
} from '@/features/play-pitcher-game/model/pitchAim'
import {
  GAUGE_OUTER_FRAME,
  GAUGE_RESULT_TICKS,
  gaugeFrameForCell,
  gaugeResultFrameForCell,
  gaugeResultOffsetY,
  isGaugeOutlineCell,
} from '@/pages/pitching/lib/pitchGaugeSprite'
import type { GaugeFrame } from '@/pages/pitching/lib/pitchGaugeSprite'
import * as styles from '@/pages/pitching/ui/PitchGradeGauge.css'

interface PitchGradeGaugeProps {
  /**
   * 공을 놓는다 — 상태 0x11 의 틱 10(`0x4e060`, `[+0x2c] > 9`)에 **누르든 안 누르든** 한 번 불린다.
   * 넘기는 값은 게이지에서 정한 칸 g(1~9). 칸을 못 정했으면 0 (그때 등급 t = 0).
   */
  readonly onRelease: (gaugeCell: number) => void
  /** 일시정지 팝업(0x741a0)이 떠 있으면 틱이 멈춘다 */
  readonly isPaused?: boolean
}

const isDecidedCell = (cell: number) => cell >= 1 && cell <= GAUGE_LAST_CELL

/**
 * 원본 투구 게이지 — 경기 상태 0x11 (그리기 0x4d2ac, 누름 0x50e08, 놓기 0x4e060 — P1 4-1 · S5 U-15).
 *
 * - 커서 칸 `scene+0x17bc` 는 등급 t 가 0 인 동안 그리기 함수가 **틱마다 +1** 한다(0x4d708).
 * - OK · '5'(메시지 9 → 0x50e08)는 `+0x17c8 = 커서`(이미 정했으면 그대로)로 적고, 칸이 1~9 일 때만 t 를 정한다 —
 *   커서 0 에서 누르면 무시되고 **다시 누를 수 있다**. t 가 서면 커서가 멈추고 결과 원(0x4d6aa)이 4틱 떠오른다.
 * - 누름은 공을 내보내지 않는다. 공은 **틱 10 에 늘 나간다**(0x4e060 → 0x4dc78) — 그때까지 못 정했으면 t = 0.
 *
 * ⚠️ **원본 그대로**: 칸 8 과 9 는 프레임을 `min(…, 0x43)` 으로 자르는 바람에 **화면에서 구별되지 않고**,
 * 칸 9 는 원이 사라진 바로 그 한 틱이다. 원본에 결과 글자가 없어 안내 문구도 붙이지 않는다.
 * ⚠️ 미이식: t 가 선 뒤 0x4d53c~0x4d69e 가 덧그리는 것(그림 플래그 8 의 멈춘 커서 · 레코드 비트에 걸린 칸 그림 · t == 5 의 덧그림)은
 * 멈춘 커서 원 하나로만 옮겼다.
 */
export function PitchGradeGauge({ onRelease, isPaused = false }: PitchGradeGaugeProps) {
  /** 0x11 상태 틱 `[+0x2c]` */
  const tickRef = useRef(0)
  /** 커서 `+0x17bc` */
  const [cursor, setCursor] = useState(0)
  const cursorRef = useRef(0)
  /** 누른 칸 `+0x17c8` (0 = 아직) */
  const [pressed, setPressed] = useState(0)
  const pressedRef = useRef(0)
  /** 결과 원 틱 `+0x17c4` */
  const [resultTick, setResultTick] = useState(0)
  const releasedRef = useRef(false)
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease

  useEffect(() => {
    if (isPaused) return
    const handle = window.setInterval(() => {
      if (releasedRef.current) return
      tickRef.current += 1
      if (isPitchReleaseDue(tickRef.current)) {
        releasedRef.current = true
        onReleaseRef.current(isDecidedCell(pressedRef.current) ? pressedRef.current : 0)
        return
      }
      // 그리기 0x4d2ac — t 가 0 이면 커서 +1, 서 있으면 결과 원 틱 +1 (0x4d700 · 0x4d708)
      if (isDecidedCell(pressedRef.current)) {
        setResultTick((previous) => previous + 1)
      } else {
        cursorRef.current += 1
        setCursor(cursorRef.current)
      }
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [isPaused])

  const press = () => {
    if (releasedRef.current || isPaused) return
    pressedRef.current = gaugePressedCellOf(pressedRef.current, cursorRef.current)
    setPressed(pressedRef.current)
  }
  const pressRef = useRef(press)
  pressRef.current = press
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isPausedRef.current) return
      const code = originalKeyCodeOf(event.key)
      // 메시지 9 의 0x50dfa — OK(−5) · '5' 만 0x50e08 로 간다
      if (code !== KEY_OK && code !== 0x35) return
      event.preventDefault()
      pressRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const isDecided = isDecidedCell(pressed)
  const circle = (frame: GaugeFrame, offsetY = 0) =>
    frame.color === null ? (
      <span
        className={`${styles.circle} ${styles.outline}`}
        style={{ width: `${frame.size}px`, height: `${frame.size}px` }}
      />
    ) : (
      <span
        className={styles.circle}
        style={{
          width: `${frame.size}px`,
          height: `${frame.size}px`,
          background: frame.color,
          transform: `translate(-50%, calc(-50% + ${offsetY}px))`,
        }}
      />
    )

  return (
    <button type="button" className={styles.gauge} onClick={press} aria-label={`투구 게이지 ${isDecided ? pressed : cursor}칸`}>
      {!isDecided && !isGaugeOutlineCell(cursor) && circle(GAUGE_OUTER_FRAME)}
      {!isDecided && circle(gaugeFrameForCell(cursor))}
      {/* t 가 선 뒤(0x4d52e~) — 멈춘 커서 칸 min(0x3b + 칸, 0x43) */}
      {isDecided && circle(gaugeResultFrameForCell(pressed))}
      {isDecided && resultTick < GAUGE_RESULT_TICKS && circle(gaugeResultFrameForCell(pressed), gaugeResultOffsetY(resultTick))}
    </button>
  )
}
