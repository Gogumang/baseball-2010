import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { CLEAR_KEY, NAVIGATION_KEYS, NUMBER_KEYS } from '@/widgets/phone-keypad/lib/phoneKeys'
import type { PhoneKey } from '@/widgets/phone-keypad/lib/phoneKeys'
import { startPhoneKeyPress } from '@/widgets/phone-keypad/model/keyDispatch'
import type { KeyPressHandle } from '@/widgets/phone-keypad/model/keyDispatch'
import * as styles from '@/widgets/phone-keypad/ui/PhoneKeypad.css'

/**
 * **터치 키패드** (웹판 추가 — 원본 피처폰의 키를 대신한다). 원본 화면 바깥에 선다.
 *
 * 칸을 누르면(pointerdown) keydown, 떼면(pointerup · pointercancel) keyup 을 **키보드와 같은 이름으로** 쏜다
 * (`keyDispatch`) — 화면은 키보드와 키패드를 가리지 않는다. 마우스 hover 로는 아무 일도 하지 않는다.
 *
 * 누르는 동안 초점을 빼앗지 않는다(`preventDefault`) — 이름 입력칸에 초점이 있으면 키 사건도 그 칸으로 간다(키보드와 같다).
 */
export function PhoneKeypad() {
  const pressesRef = useRef(new Map<number, KeyPressHandle>())

  useEffect(() => {
    const presses = pressesRef.current
    return () => {
      for (const press of presses.values()) press.release()
      presses.clear()
    }
  }, [])

  const handlersOf = (phoneKey: PhoneKey) => {
    const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
      const press = pressesRef.current.get(event.pointerId)
      if (press === undefined) return
      pressesRef.current.delete(event.pointerId)
      delete event.currentTarget.dataset.pressed
      press.release()
    }
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        // 초점 뺏기 · 글자 고르기 · 뒤따르는 마우스 흉내를 막는다
        event.preventDefault()
        event.stopPropagation()
        // 주 단추(터치 · 펜 · 마우스 왼쪽)만 — 오른쪽 단추는 키가 아니다
        if (event.button > 0) return
        pressesRef.current.get(event.pointerId)?.release()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // 잡기를 못 해도(시험 환경 따위) 누름은 그대로다
        }
        event.currentTarget.dataset.pressed = ''
        pressesRef.current.set(event.pointerId, startPhoneKeyPress(phoneKey))
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
    }
  }

  const keyButton = (phoneKey: PhoneKey, className: string) => (
    <button
      key={phoneKey.key}
      type="button"
      tabIndex={-1}
      className={className}
      aria-label={phoneKey.name}
      data-phone-key={phoneKey.key}
      onContextMenu={(event) => event.preventDefault()}
      {...handlersOf(phoneKey)}
    >
      {phoneKey.label}
    </button>
  )

  return (
    <>
      <div className={styles.cluster} style={{ gridArea: 'padL' }} role="group" aria-label="방향 키">
        {NAVIGATION_KEYS.map((phoneKey, index) => (phoneKey === null
          // 칸 자리만 지키는 빈 칸
          ? <span key={`blank-${index}`} className={styles.spacer} aria-hidden="true" />
          : keyButton(phoneKey, phoneKey.key === 'Enter' ? `${styles.key} ${styles.okKey}` : styles.key)))}
        {keyButton(CLEAR_KEY, `${styles.key} ${styles.clearKey}`)}
      </div>
      <div className={styles.cluster} style={{ gridArea: 'padR' }} role="group" aria-label="숫자 키">
        {NUMBER_KEYS.map((phoneKey) => keyButton(phoneKey, styles.key))}
      </div>
    </>
  )
}
