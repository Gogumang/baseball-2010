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
  readonly onPress: () => void
  readonly isDisabled?: boolean
  /**
   * 목록 칸으로 읽히게 할 때 — 원본 목록 그림(경기 중 메뉴 칸 따위) 위의 누름 칸이 `role="option"` 과 고름 상태를 갖는다.
   * 안 주면 보통 단추다.
   */
  readonly option?: { readonly isSelected: boolean }
  /** 시험이 칸을 찾는 이름 (`data-testid`) */
  readonly testId?: string
}

/** 화면 전체 240×320 */
const WHOLE_SCREEN: PressRect = { x: 0, y: 0, width: 240, height: 320 }

/**
 * **투명한 누름 칸** — 원본 화면에는 없는 웹 단추를 걷어 내되, 마우스 · 터치로 조작할 길은 남긴다.
 * 원본 그림 자리(소프트키 글자 "*MENU" 따위) 위에 투명하게 얹는다. 눌림이 아래 캔버스(스윙)로 내려가지 않게 막는다.
 */
export function PressArea({ label, rect = WHOLE_SCREEN, onPress, isDisabled = false, option, testId }: PressAreaProps) {
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
        onPress()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}
