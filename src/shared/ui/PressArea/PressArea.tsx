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
}

/** 화면 전체 240×320 */
const WHOLE_SCREEN: PressRect = { x: 0, y: 0, width: 240, height: 320 }

/**
 * **투명한 누름 칸** — 원본 화면에는 없는 웹 단추를 걷어 내되, 마우스 · 터치로 조작할 길은 남긴다.
 * 원본 그림 자리(소프트키 글자 "*MENU" 따위) 위에 투명하게 얹는다. 눌림이 아래 캔버스(스윙)로 내려가지 않게 막는다.
 */
export function PressArea({ label, rect = WHOLE_SCREEN, onPress, isDisabled = false, option }: PressAreaProps) {
  return (
    <button
      type="button"
      className={styles.pressArea}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label={label}
      {...(option === undefined ? {} : { role: 'option', 'aria-selected': option.isSelected })}
      disabled={isDisabled}
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}
