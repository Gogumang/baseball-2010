import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTouchKeyOffers } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { CLEAR_KEY, OK_KEY, startTouchKeyPress, touchKeyOf } from '@/widgets/touch-controls/model/keyDispatch'
import type { KeyPressHandle, TouchKey } from '@/widgets/touch-controls/model/keyDispatch'
import * as styles from '@/widgets/touch-controls/ui/TouchControls.css'

export type TouchControlsLayout = 'below' | 'sides'

/**
 * **터치 조작** (웹판 추가 — 원본 피처폰 키패드를 대신한다). 원본 화면 바깥(세로면 아래, 가로면 양옆)에 선다.
 *
 * - **확인** — 원본 OK(Enter). 늘 있다.
 * - **뒤로** — 원본 CLR(Escape). 늘 있다(작게) — 대사 "CLR:SKIP" · 순위 판처럼 화면 안에 되돌아갈 누름 칸이 없는 곳이 있다.
 * - **상황 버튼** — 그 순간 화면이 받는 특수 키만(`touchKeyOffer`): 필살타 · 마구 '0', 번트 '8'(누르고 있는 동안), 도루 '3'/'2'/'1',
 *   교체 '#', 메뉴 '*'.
 * 숫자 · 방향은 화면 안 터치(투명 누름 칸 · 타석 캔버스)로 한다.
 *
 * 누르면(pointerdown) keydown, 떼면(pointerup · pointercancel) keyup 을 **키보드와 같은 이름으로** 쏜다(`keyDispatch`) — 화면은
 * 키보드와 버튼을 가리지 않는다. 마우스 hover 로는 아무 일도 하지 않는다. 누르는 동안 초점을 빼앗지 않는다(`preventDefault`) —
 * 이름 입력칸에 초점이 있으면 키 사건도 그 칸으로 간다(키보드와 같다).
 */
export function TouchControls({ layout }: { readonly layout: TouchControlsLayout }) {
  const offers = useTouchKeyOffers()
  const pressesRef = useRef(new Map<number, KeyPressHandle>())

  useEffect(() => {
    const presses = pressesRef.current
    return () => {
      for (const press of presses.values()) press.release()
      presses.clear()
    }
  }, [])

  const handlersOf = (touchKey: TouchKey) => {
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
        // 주 단추(터치 · 펜 · 마우스 왼쪽)만
        if (event.button > 0) return
        pressesRef.current.get(event.pointerId)?.release()
        // 손가락(마우스)이 버튼 밖으로 나가도 떼기 전까지는 누름이다(번트 '8')
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // 잡기를 못 해도(시험 환경 따위) 누름은 그대로다
        }
        event.currentTarget.dataset.pressed = ''
        pressesRef.current.set(event.pointerId, startTouchKeyPress(touchKey))
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    }
  }

  const keyButton = (touchKey: TouchKey, label: string, name: string, className: string) => (
    <button
      key={touchKey.key}
      type="button"
      tabIndex={-1}
      className={className}
      aria-label={name}
      data-touch-key={touchKey.key}
      {...handlersOf(touchKey)}
    >
      {label}
    </button>
  )

  const optionButtons = offers.map((offer) =>
    keyButton(touchKeyOf(offer.key), offer.label, offer.label, styles.optionButton))
  const back = keyButton(CLEAR_KEY, '뒤로', '뒤로', layout === 'sides' ? `${styles.backButton} ${styles.wideBack}` : styles.backButton)

  if (layout === 'sides') {
    return (
      <>
        <div className={styles.panel} style={{ gridArea: 'padL' }} role="group" aria-label="상황 버튼">
          {optionButtons.length > 0 && <div className={`${styles.optionRow} ${styles.optionColumn}`}>{optionButtons}</div>}
          <div className={styles.mainRow}>{back}</div>
        </div>
        <div className={styles.panel} style={{ gridArea: 'padR' }} role="group" aria-label="확인">
          <div className={styles.mainRow}>{keyButton(OK_KEY, '확인', '확인', `${styles.okButton} ${styles.tallOk}`)}</div>
        </div>
      </>
    )
  }
  return (
    <div className={styles.panel} style={{ gridArea: 'pad' }} role="group" aria-label="터치 조작">
      {optionButtons.length > 0 && <div className={styles.optionRow}>{optionButtons}</div>}
      <div className={styles.mainRow}>
        {back}
        {keyButton(OK_KEY, '확인', '확인', styles.okButton)}
      </div>
    </div>
  )
}
