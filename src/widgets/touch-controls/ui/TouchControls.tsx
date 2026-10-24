import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTouchKeyOffers } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { startTouchKeyPress, touchKeyOf } from '@/widgets/touch-controls/model/keyDispatch'
import type { KeyPressHandle, TouchKey } from '@/widgets/touch-controls/model/keyDispatch'
import * as styles from '@/widgets/touch-controls/ui/TouchControls.css'

export type TouchControlsLayout = 'below' | 'sides'

/** 가로 배치에서 상황 버튼을 세로 한 줄로 쌓는 최대 개수 — 넘으면 두 줄 격자(`optionGrid`) */
export const SIDES_COLUMN_MAX = 3
/** 세로 배치에서 상황 버튼을 네 칸 격자로 쌓고 글자를 줄이기 시작하는 개수 (`optionGridFour` · `denseOption`) */
export const BELOW_DENSE_FROM = 5

/**
 * **터치 조작** (웹판 추가 — 원본 피처폰 키패드를 대신한다). 원본 화면 바깥(세로면 아래, 가로면 왼쪽)에 선다.
 *
 * - **상황 버튼만** — 그 순간 화면이 받는 키만(`touchKeyOffer`): 필살타 · 마구 '0', 번트 '8'(누르고 있는 동안), 도루 '3'/'2'/'1',
 *   견제 '3'/'1'/'7', 교체 '#', 메뉴 '*' 따위. 가로 배치에서 넷 이상이면 두 칸 격자, 세로 배치에서 다섯 이상이면 네 칸 격자로
 *   쌓는다(왼쪽 칸 높이 넘침 · 버튼이 손가락보다 좁아짐). 수비 인플레이 송구 · 주루 · 슬라이딩 · 전원 귀루, 목록 ▲ · ▼, 쪽 ◀ · ▶ 도 여기 뜬다.
 * - **늘 있던 확인(Enter) · 뒤로(Escape) 버튼은 걷었다** (r186, 사용자 요청). OK · CLR 은 화면 안 터치로 닿는다 — 화면 탭(`OkTapArea` ·
 *   판 전체 누름 칸), 항목 누름 칸, 바닥띠 소프트키 글자 자리(왼쪽 확인/선택 · 오른쪽 되돌아가기/취소)의 투명 누름 칸. 그림 자리가
 *   없는 곳(수비 공격 쪽 슬라이딩 · 전원 귀루 따위)은 그 화면이 OK · CLR 을 상황 버튼으로 알린다.
 * 숫자 · 방향도 화면 안 터치(투명 누름 칸 · 타석 캔버스)로 한다.
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

  const isDense = offers.length >= BELOW_DENSE_FROM
  const optionClass = isDense ? `${styles.optionButton} ${styles.denseOption}` : styles.optionButton
  const optionButtons = offers.map((offer) =>
    keyButton(touchKeyOf(offer.key), offer.label, offer.label, optionClass))
  const sidesOptionClass = optionButtons.length > SIDES_COLUMN_MAX
    ? styles.optionGrid
    : `${styles.optionRow} ${styles.optionColumn}`

  if (layout === 'sides') {
    return (
      <div className={styles.panel} style={{ gridArea: 'padL' }} role="group" aria-label="상황 버튼">
        {optionButtons.length > 0 && <div className={sidesOptionClass} data-option-layout={optionButtons.length > SIDES_COLUMN_MAX ? 'grid' : 'column'}>{optionButtons}</div>}
      </div>
    )
  }
  return (
    <div className={styles.panel} style={{ gridArea: 'pad' }} role="group" aria-label="터치 조작">
      {optionButtons.length > 0 && (
        <div className={isDense ? `${styles.optionGrid} ${styles.optionGridFour}` : styles.optionRow}
          data-option-layout={isDense ? 'grid' : 'row'}>
          {optionButtons}
        </div>
      )}
    </div>
  )
}
