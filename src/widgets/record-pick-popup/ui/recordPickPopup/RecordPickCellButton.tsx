import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import {
  RECORD_PICK_CELL_SIZE,
  RECORD_PICK_CELLS,
  RECORD_PICK_DIM_LABEL_COLOR,
  RECORD_PICK_LABEL_GAP,
  recordPickIconOffsetOf,
  recordPickLabelXOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'
import {
  MODE_ICON_SIZE,
  modeIconOf,
  pixel,
  recordPickLabelSrcOf,
  selectedModeIconOf,
} from '@/widgets/record-pick-popup/ui/recordPickPopup/recordPickAssets'

/** 칸 하나 — 아이콘(고르면 주황 벌) · 칸 글(안 고르면 효과 0xb 회색 단색). 누름은 키와 같은 길이다(고른 칸이면 확인, 아니면 바꾸기) */
export function RecordPickCellButton({
  cell,
  index,
  isOn,
  labelOrigins,
  testIdPrefix,
  onPress,
}: {
  readonly cell: { readonly label: string; readonly labelFrame: number }
  readonly index: number
  readonly isOn: boolean
  readonly labelOrigins: FrameOrigins | null
  readonly testIdPrefix: string
  readonly onPress: () => void
}) {
  const geometry = RECORD_PICK_CELLS[index]
  const labelSize = labelOrigins?.[String(cell.labelFrame).padStart(3, '0')]
  const labelTop = RECORD_PICK_CELL_SIZE + RECORD_PICK_LABEL_GAP
  const icon = recordPickIconOffsetOf(MODE_ICON_SIZE, MODE_ICON_SIZE)
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={cell.label}
      className={windowStyles.layer}
      style={{
        left: geometry.x,
        top: geometry.y,
        width: RECORD_PICK_CELL_SIZE,
        height: labelTop + (labelSize?.height ?? 0),
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        pointerEvents: 'auto',
        overflow: 'visible',
      }}
      onClick={onPress}
    >
      <img
        alt=""
        data-testid={`${testIdPrefix}-칸-${index}`}
        src={isOn ? selectedModeIconOf(geometry.iconFrame) : modeIconOf(geometry.iconFrame)}
        style={{ ...pixel, left: icon.x, top: icon.y }}
      />
      <RecordPickCellLabel
        src={recordPickLabelSrcOf(cell.labelFrame)}
        size={isOn ? undefined : labelSize}
        x={labelSize === undefined ? 0 : recordPickLabelXOf(labelSize.width)}
        top={labelTop}
      />
    </button>
  )
}

/** 칸 글 — `size` 가 있으면(안 고른 칸) 효과 0xb 단색: 그림을 마스크로 쓰고 회색을 칠한다. 없으면 그림 그대로 */
function RecordPickCellLabel({
  src,
  size,
  x,
  top,
}: {
  readonly src: string
  readonly size: { readonly width: number; readonly height: number } | undefined
  readonly x: number
  readonly top: number
}) {
  if (size === undefined) return <img alt="" src={src} style={{ ...pixel, left: x, top }} />
  return (
    <span
      style={{
        ...pixel,
        left: x,
        top,
        width: size.width,
        height: size.height,
        background: solidColorCss(RECORD_PICK_DIM_LABEL_COLOR),
        maskImage: spriteMaskImage(src),
        WebkitMaskImage: spriteMaskImage(src),
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  )
}
