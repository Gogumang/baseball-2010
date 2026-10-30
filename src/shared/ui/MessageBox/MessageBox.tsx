import { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import * as styles from '@/shared/ui/MessageBox/MessageBox.css'
import { buttonPictureOf, cellSizeOf, gridStyleOf, POPUP, SELECTED_OVERFLOW } from '@/shared/ui/MessageBox/messageBoxLooks'
import { boxStyleOf, closingPanelStyleOf, contentStyleOf } from '@/shared/ui/MessageBox/messageBoxMotion'
import type { MessageBoxProps } from '@/shared/ui/MessageBox/messageBoxProps'
import { useMessageBox } from '@/shared/ui/MessageBox/useMessageBox'

/**
 * 메시지 상자 (0xbbef8 → 0x74ef4 배치 · 0x746cc 그리기 — layout-re 4차, 판·위치 바이트 확인).
 * 화면을 검정 반투명으로 덮고, 폭 240 띠를 세로 가운데에 둔다. 글은 (45, y+20) 부터 폭 150, 줄 간격 14.
 * 버튼은 `ui/popup.pzx` 프레임 그림이고 첫 버튼이 기본 선택이다 (F-1 확정 — 자리별 처음 칸은 `initialSelected`) — "확인" 이 아니라 **"OK"**,
 * 고른 칸은 노란 글자가 아니라 **주황 그림 6·7**(49×23)이다.
 *
 * 열림·닫힘 애니메이션은 F-1 1-4(확정)다 — 아래 `OPEN_*` · `CLOSE_*` 참고.
 */

export function MessageBox({
  text,
  buttons,
  listItems,
  initialSelected = 0,
  buttonFrames,
  grid,
  cancelAnswer,
  cancelPressRect,
  dimOpacity,
  closesWithoutShrink: closesWithoutShrinkProp,
  opensOneStepIn = false,
  onAnswer,
  onAnswerKey,
  onRawKey,
}: MessageBoxProps) {
  const { boxRef, selected, setSelected, answer, animation, columns } = useMessageBox({
    text,
    buttons,
    grid,
    cancelAnswer,
    onAnswer,
    onAnswerKey,
    onRawKey,
    initialSelected,
    closesWithoutShrinkProp,
    opensOneStepIn,
  })
  const boxStyle = boxStyleOf(animation)
  const closingPanelStyle = closingPanelStyleOf(animation)
  const contentStyle = contentStyleOf(animation)
  const cellSize = cellSizeOf({ buttonFrames, listItems })
  const gridStyle = gridStyleOf(grid, columns)

  return (
    <div
      className={styles.dim}
      role="dialog"
      aria-label="알림"
      style={dimOpacity === undefined ? undefined : { background: `rgba(0, 0, 0, ${dimOpacity})` }}
    >
      <div className={styles.box} ref={boxRef} style={boxStyle}>
        {closingPanelStyle !== null && <div className={styles.closingPanel} style={closingPanelStyle} />}
        <div className={styles.text} style={contentStyle}>
          <MarkupText raw={text} />
        </div>
        <div className={styles.buttons} style={{ ...gridStyle, ...contentStyle }}>
          {buttons.map((label, index) => {
            const isSelected = index === selected
            const frame = buttonPictureOf({ listItems, buttonFrames, buttons }, index, isSelected)
            const shown = listItems?.[index] ?? label
            return (
              <button
                key={label}
                type="button"
                className={styles.button}
                aria-label={label}
                style={cellSize === null ? undefined : { width: cellSize.width, height: cellSize.height }}
                // 마우스 올리기로는 고르지 않는다 — 원본은 키패드뿐이고, 창이 뜰 때 멈춘 포인터 아래 단추가 선택을 빼앗았다(나만의리그 [14])
                onFocus={() => setSelected(index)}
                onClick={() => answer(index)}
              >
                {frame === undefined ? (
                  isSelected ? (
                    `▶ ${shown}`
                  ) : (
                    shown
                  )
                ) : (
                  <img
                    className={styles.buttonImage}
                    src={`${POPUP}/${String(frame).padStart(3, '0')}.png`}
                    alt=""
                    // 선택 그림(49×23 · 67×23 · 43×57)은 원점이 (−4,−4) 라 같은 자리에서 사방 4px 넘쳐 그려진다
                    style={isSelected && buttons.length > 1 ? { left: -SELECTED_OVERFLOW, top: -SELECTED_OVERFLOW } : undefined}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
      {cancelPressRect !== undefined && (
        <PressArea label="되돌아가기 칸" rect={cancelPressRect} onPress={() => answer(cancelAnswer ?? buttons.length - 1)} />
      )}
    </div>
  )
}
