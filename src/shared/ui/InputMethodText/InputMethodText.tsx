import { useEffect, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { InputHTMLAttributes } from 'react'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import * as styles from '@/shared/ui/InputMethodText/InputMethodText.css'

/**
 * 입력기 [0x1552d00] 의 버퍼 그리기 **0x677d4** — 선수 이름 칸(나리 등록 0x15f34 · 시즌 이름 0xba28)이 부른다.
 *
 * 원본(0x677d4~0x678c4, 직접 떴다):
 * ```
 * 0x677d4(I, x, y, 글꼴, 색, 커서 켬, 정렬, 최대폭)
 *   n = strlen(I+0x28)
 *   커서 켬 && 0x672f4(I) 이면 버퍼[n] = '|' (0x7c) · 버퍼[n+1] = 0 — 그릴 동안만 덧붙이고 끝에서 버퍼[n] = 0 으로 되돌린다
 *   정렬 0x11 은 가로 비트(0x2 가운데 · 0x4 오른쪽) · 세로 비트(0x20 · 0x40)가 없어 **(x, y) 왼쪽 위 그대로**
 *   0x9c735(글꼴, 색) → 0x9c068(글꼴, 버퍼, −1, x, y, 최대폭 0, 첫 공백 버리기 0, 1)
 * 0x672f4(I): I+4(켜짐)일 때 전역 셈 [0x1552d80] 을 1 올리고 (셈 / 5) & 1 (0xca739 = 부호 없는 나눗셈)
 * ```
 * 부르는 곳의 글꼴은 `[[0x1400070] + 0x3c]` = 앱 전역 글꼴(자간 1 · 0x6b330)이고 글자 칸은 원본 0x9c068 규칙을 그대로 쓰는
 * `PixelText` 가 찍는다 — 영문은 5 + 1 = 6px · 한글 9 + 1 = 10px 전진.
 *
 * 웹 입력은 원본 폰 입력기(멀티탭 · A/a/1/가) 대신 `<input>` 이 받는다(R11 2-3). 예전에는 그 `<input>` 이 글을 직접 그려서
 * 브라우저 기본 `letter-spacing: normal`(자간 0) · 가운데 맞춤의 반 픽셀 때문에 "Kim" 이 "Ki m" 처럼 뭉개져 보였다.
 * 이제 `<input>` 은 글자 · 캐럿을 투명하게 두고 키만 받는다.
 *
 * 깜빡임 셈 [0x1552d80] 은 .bss 라 켤 때 0 이고, 이 칸을 읽고 쓰는 곳은 0x672f4 하나뿐이다(리터럴 0x6731c 하나 — xval 확인).
 * 0x677d4 는 `커서 켬 && 0x672f4(I)` 라 커서가 켜진 칸을 그릴 때만 오르고, 칸이 바뀌어도 지우지 않아 **앱 전체에 이어진다**.
 * 0x672f4 는 먼저 올리고(672fe~67304) 나눈다 → 처음 그림이 셈 1. 웹은 같은 모듈 셈(`cursorBlinkCount`)을 틀마다 올린다.
 */
export function inputBufferTextOf(buffer: string, isCursorOn: boolean, counter: number): string {
  return isCursorOn && Math.floor(counter / 5) % 2 === 1 ? `${buffer}|` : buffer
}

/** [0x1552d80] — 위 머리말 */
let cursorBlinkCount = 0

/** 시험 전용 — [0x1552d80] 을 켤 때 값(0)으로 */
export function resetCursorBlinkCountForTest(): void {
  cursorBlinkCount = 0
}

/** 커서가 켜진 동안 그림마다 [0x1552d80] 을 1 올린 값 (0x672f4 의 672fc~67304). 꺼져 있으면 셈을 안 건드린다 */
function useCursorBlinkCount(isCursorOn: boolean): number {
  const [count, setCount] = useState(cursorBlinkCount)
  useEffect(() => {
    if (!isCursorOn) return
    const startTick = appTickNow()
    let lastFrame = -1
    let handle = 0
    const tick = (now: number) => {
      const frame = Math.max(0, appTickOf(now) - startTick)
      if (frame > lastFrame) {
        cursorBlinkCount += frame - lastFrame
        lastFrame = frame
        setCount(cursorBlinkCount)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [isCursorOn])
  return count
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'style' | 'className' | 'type'>

interface InputMethodTextProps extends InputProps {
  readonly value: string
  /** 0x677d4 의 (x, y) — 글 왼쪽 위 */
  readonly x: number
  readonly y: number
  /** 키 · 누름을 받을 투명 입력 칸 (웹 전용) */
  readonly inputRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 글 색 (0x9c735) */
  readonly color: string
  /** 0x677d4 의 "커서 켬" 인자 — 켜져 있으면 '|' 가 5 프레임마다 붙었다 떨어진다 */
  readonly isCursorOn: boolean
}

export function InputMethodText({ value, x, y, inputRect, color, isCursorOn, ...inputProps }: InputMethodTextProps) {
  const counter = useCursorBlinkCount(isCursorOn)
  return (
    <>
      <PixelText style={{ position: 'absolute', left: x, top: y, color, pointerEvents: 'none' }}>
        {inputBufferTextOf(value, isCursorOn, counter)}
      </PixelText>
      <input
        type="text"
        className={styles.input}
        value={value}
        style={{ left: inputRect.x, top: inputRect.y, width: inputRect.width, height: inputRect.height }}
        {...inputProps}
      />
    </>
  )
}
