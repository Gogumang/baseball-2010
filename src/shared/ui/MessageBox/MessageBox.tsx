import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import * as styles from '@/shared/ui/MessageBox/MessageBox.css'

interface MessageBoxProps {
  /** 원문 마크업 (StrMODE) */
  readonly text: string
  /** 버튼 글자 — 종류 1 은 하나, 종류 2 는 둘. 원본 문자열표를 못 찾아 "확인"·"예/아니오" 로 둔다 (추정) */
  readonly buttons: readonly string[]
  /** 누른 버튼 번호 */
  readonly onAnswer: (index: number) => void
}

/**
 * 메시지 상자 (0xbbef8 → 0x74ef4 배치 · 0x746cc 그리기 — layout-re 4차, 판·위치 바이트 확인).
 * 화면을 검정 반투명으로 덮고, 폭 240 띠를 세로 가운데에 둔다. 글은 (45, y+20) 부터 폭 150, 줄 간격 14.
 * 버튼은 시스템 글꼴 글자이고 첫 버튼이 기본 선택이다. 선택 색(노랑)·열림 애니메이션은 미확인 (추정).
 */
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
          {buttons.map((label, index) => (
            <button key={label} type="button" className={styles.button}
              style={{ color: index === selected ? '#FFFF00' : '#FFFFFF' }}
              onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)}
              onClick={() => onAnswer(index)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
