import { useRef } from 'react'
import { stampInputTime } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import * as styles from '@/shared/ui/PressArea/PressArea.css'

export interface PressRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface PressAreaProps {
  /** 읽어 주는 이름 — 화면에는 안 보인다 (예: "확인", "메뉴", "도루 1루") */
  readonly label: string
  /** 240×320 원본 좌표의 누름 칸. 안 주면 화면 전체 */
  readonly rect?: PressRect
  /**
   * 눌렀다 — `event` 는 이 누름의 사건이다. 타이밍이 결과를 바꾸는 칸(투구 게이지 · 조준 · 도루)은 키 사건과 같은 길로
   * `inputTimeOf(event)` 를 키 칸에 넘긴다 — 손가락 · 마우스가 **닿은 시각**(pointerdown)이 붙어 있다(아래 `PressArea`). 안 쓰면 무시한다
   */
  readonly onPress: (event: Event) => void
  readonly isDisabled?: boolean
  /**
   * 목록 칸으로 읽히게 할 때 — 원본 목록 그림(경기 중 메뉴 칸 따위) 위의 누름 칸이 `role="option"` 과 고름 상태를 갖는다.
   * 안 주면 보통 단추다.
   */
  readonly option?: { readonly isSelected: boolean }
  /** 시험이 칸을 찾는 이름 (`data-testid`) */
  readonly testId?: string
  /**
   * 터치 기기 상황 버튼으로도 띄울 원본 키 — 칸이 서 있고 막히지 않은 동안 그 키를 알린다(`touchKeyOffer`).
   * **원본 그림에 그 키의 글자 자리가 없는 칸에만** 준다(외출 지도 · 조준 · 교체 창의 CLR, r194). 글자 자리 위 칸("*MENU" · "#TIME" ·
   * 루 그림 · 화살)은 그 칸이 곧 터치 길이라 버튼을 또 내지 않는다(r192, 사용자 요청 "필요한 버튼만")
   */
  readonly touchKey?: TouchKeyOffer
}

/**
 * 바닥띠 **되돌아가기 표시** 자리 — `ScreenFrame` 이 바닥비트 0x4 일 때 game_frame 21(19×13)을 (206, 바닥 − 16 = 304) 에 그린다
 * (0x55226). 그 표시를 그대로 둔 채 위에 창이 뜨는 곳(기록실 · 구질 두 칸 팝업 따위)이 CLR 을 이 자리 누름 칸으로 받는다 (r186 —
 * 늘 있던 뒤로 버튼을 걷었다). 손가락 칸이라 사방 2px 넓힌다
 */
export const FOOTER_BACK_PRESS_RECT: PressRect = { x: 206 - 2, y: 304 - 2, width: 19 + 4, height: 13 + 4 }

/** 화면 전체 240×320 */
const WHOLE_SCREEN: PressRect = { x: 0, y: 0, width: 240, height: 320 }

/**
 * **투명한 누름 칸** — 원본 화면에는 없는 웹 단추를 걷어 내되, 마우스 · 터치로 조작할 길은 남긴다.
 * 원본 그림 자리(소프트키 글자 "*MENU" 따위) 위에 투명하게 얹는다. 눌림이 아래 캔버스(스윙)로 내려가지 않게 막는다.
 */
export function PressArea({ label, rect = WHOLE_SCREEN, onPress, isDisabled = false, option, testId, touchKey }: PressAreaProps) {
  useTouchKeyOffer(isDisabled ? null : (touchKey ?? null))
  /**
   * 이 칸에 손가락 · 마우스가 닿은 사건 시각(`event.timeStamp`) — 누름(onPress)은 떼는 click 에 나가지만, 키패드 키가 누를 때 keydown 이듯
   * 사람이 누른 때는 닿은 때다. click 사건에 이 시각을 붙여(`stampInputTime`) 받는 쪽이 `inputTimeOf` 로 "그때 본 그림의 틱"을 센다(r222)
   */
  const pointerDownAtRef = useRef<number | null>(null)
  return (
    <button
      type="button"
      className={styles.pressArea}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label={label}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
      {...(option === undefined ? {} : { role: 'option', 'aria-selected': option.isSelected })}
      disabled={isDisabled}
      onClick={(event) => {
        event.stopPropagation()
        // 마우스 · 터치로 누른 것(detail ≥ 1)이면 초점을 놓는다 — 눌린 칸에 초점이 남으면 다음 키(OK · 화살표)에서 크롬이
        // :focus-visible 점선을 그려, 원본에 없는 점선 네모가 바닥띠 위에 남았다 (r82 나리 선수 등록 OK 뒤 Enter)
        if (event.detail > 0) event.currentTarget.blur()
        const pointerDownAt = pointerDownAtRef.current
        pointerDownAtRef.current = null
        // 키보드로 누른 click(detail 0)은 닿은 때가 없다 — click 사건 시각 그대로
        if (pointerDownAt !== null && event.detail > 0) stampInputTime(event.nativeEvent, pointerDownAt)
        onPress(event.nativeEvent)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        pointerDownAtRef.current = event.timeStamp
      }}
    />
  )
}
