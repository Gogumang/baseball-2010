import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import * as styles from '@/shared/ui/MessageBox/MessageBox.css'

interface MessageBoxProps {
  /** 원문 마크업 (StrMODE) */
  readonly text: string
  /**
   * 버튼 이름. 화면에는 **글자가 아니라 `ui/popup.pzx` 그림**이 나가고(F-1), 이 값은 읽기 보조용이다.
   * 하나면 알림(프레임 0 "OK"), 둘이면 예/아니오다.
   */
  readonly buttons: readonly string[]
  /** 누른 버튼 번호 */
  readonly onAnswer: (index: number) => void
}

/**
 * 메시지 상자 (0xbbef8 → 0x74ef4 배치 · 0x746cc 그리기 — layout-re 4차, 판·위치 바이트 확인).
 * 화면을 검정 반투명으로 덮고, 폭 240 띠를 세로 가운데에 둔다. 글은 (45, y+20) 부터 폭 150, 줄 간격 14.
 * 버튼은 `ui/popup.pzx` 프레임 그림이고 첫 버튼이 기본 선택이다 (F-1 확정) — "확인" 이 아니라 **"OK"**,
 * 고른 칸은 노란 글자가 아니라 **주황 그림 6·7**(49×23)이다.
 * 아직 없는 것: 열림(세로 ×2 펼침)·닫힘(가로 ÷2) 애니메이션.
 */
const POPUP = './sprites/popup/frames'
/**
 * 버튼은 글자가 아니라 `ui/popup.pzx` 프레임 그림이다 (F-1 확정).
 *   알림(버튼 하나) = 프레임 0 "OK" · 예/아니오 = 1 "예" · 2 "아니오" (41×15)
 *   고른 칸은 주황 그림 6·7 (49×23) 로 바뀐다 — 노란 글자색이 아니었다.
 */
const NOTICE_FRAME = 0
const YES_NO_FRAMES = [1, 2]
const YES_NO_SELECTED_FRAMES = [6, 7]
/** 선택 그림 원점 (−4,−4) */
const SELECTED_OVERFLOW = 4

/** 버튼 칸 → 그림 프레임. 버튼이 하나면 알림이라 "OK" 한 장뿐이고 고른 그림이 따로 없다 */
function buttonFrameOf(count: number, index: number, isSelected: boolean): number | undefined {
  if (count <= 1) return NOTICE_FRAME
  return (isSelected ? YES_NO_SELECTED_FRAMES : YES_NO_FRAMES)[index]
}

export function MessageBox({ text, buttons, onAnswer }: MessageBoxProps) {
  const [selected, setSelected] = useState(0)

  // 상자가 열려 있는 동안 키는 상자 것이다. 뒤쪽 메뉴가 같은 Enter 를 같이 받으면
  // 상자를 눌러 닫을 수 없고 (상점 구매 확인), Escape 가 화면을 빠져나가 버린다 (관리 알림).
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer
  const isAnsweredRef = useRef(false)
  useEffect(() => {
    const answer = (index: number) => {
      if (isAnsweredRef.current) return
      isAnsweredRef.current = true
      onAnswerRef.current(index)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 화면의 window 리스너(메뉴 목록·커맨드 줄·타석)까지 막는다
      event.stopImmediatePropagation()
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setSelected((previous) => (previous + step + buttons.length) % buttons.length)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return answer(selectedRef.current)
      }
      // 취소는 마지막 버튼 — 두 개면 [아니오], 하나면 [확인]
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        answer(buttons.length - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [buttons.length])

  return (
    <div className={styles.dim} role="dialog" aria-label="알림">
      <div className={styles.box}>
        <div className={styles.text}>
          <MarkupText raw={text} />
        </div>
        <div className={styles.buttons}>
          {buttons.map((label, index) => {
            const isSelected = index === selected
            const frame = buttonFrameOf(buttons.length, index, isSelected)
            return (
              <button key={label} type="button" className={styles.button} aria-label={label}
                onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)}
                onClick={() => onAnswer(index)}>
                {frame === undefined ? label : (
                  <img
                    className={styles.buttonImage}
                    src={`${POPUP}/${String(frame).padStart(3, '0')}.png`}
                    alt=""
                    // 선택 그림(49×23)은 원점이 (−4,−4) 라 같은 자리에서 사방 4px 넘쳐 그려진다
                    style={isSelected && buttons.length > 1 ? { left: -SELECTED_OVERFLOW, top: -SELECTED_OVERFLOW } : undefined}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
