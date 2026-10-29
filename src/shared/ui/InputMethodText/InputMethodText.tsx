import type { InputHTMLAttributes } from 'react'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import * as styles from '@/shared/ui/InputMethodText/InputMethodText.css'
import { inputBufferTextOf, useCursorBlinkCount } from '@/shared/ui/InputMethodText/inputCursorBlink'

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
