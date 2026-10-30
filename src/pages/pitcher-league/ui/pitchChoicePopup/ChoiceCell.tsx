import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import {
  RECORD_PICK_CELL_SIZE,
  RECORD_PICK_LABEL_GAP,
  recordPickIconOffsetOf,
  recordPickLabelXOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** `ui/mode_icon.pzx` 그림 · 33×33 ([장면+0xe0] — 나리 기록실 0x19448 과 같은 그림 객체). 고른 칸은 mpl 첫 벌(주황) 사본 */
const MODE_ICON_SIZE = 33
const modeIconOf = (frame: number) => assetUrl(`./sprites/mode_icon/${String(frame).padStart(3, '0')}.png`)
const selectedModeIconOf = (frame: number) => assetUrl(`./sprites/management/icon_selected_${frame}.png`)

const pixel = { position: 'absolute', pointerEvents: 'none' } as const

/** 아닌 칸 글 — 효과 0xb 단색 0x1400748(0x7f, 0x7f, 0x77) (0x19248~0x19264 · 0x19342~0x1935e) */
const PITCH_CHOICE_DIM_LABEL_COLOR = '#7f7f77'

interface ChoiceCellProps {
  readonly cell: { readonly x: number; readonly y: number; readonly iconFrame: number; readonly labelFrame: number }
  readonly index: number
  /** 칸 이름 (`PITCH_WINDOW_CHOICES`) — 읽기 보조 */
  readonly label: string
  readonly isOn: boolean
  readonly labelOrigins: FrameOrigins | null
  readonly onPress: () => void
}

/** 칸 하나 — 0x858fd 칸 그림(고른 칸은 주황 사본) · img_text 칸 글(아닌 칸은 효과 0xb 회색). 웹판은 칸 전체가 누름 단추다 */
export function ChoiceCell({ cell, index, label, isOn, labelOrigins, onPress }: ChoiceCellProps) {
  const icon = recordPickIconOffsetOf(MODE_ICON_SIZE, MODE_ICON_SIZE)
  const labelTop = RECORD_PICK_CELL_SIZE + RECORD_PICK_LABEL_GAP
  const labelSrc = frameSrc(cell.labelFrame)
  const labelSize = labelOrigins?.[String(cell.labelFrame).padStart(3, '0')]
  const labelX = labelSize === undefined ? 0 : recordPickLabelXOf(labelSize.width)
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-label={label}
      className={windowStyles.layer}
      style={{
        left: cell.x,
        top: cell.y,
        width: RECORD_PICK_CELL_SIZE,
        height: labelTop + (labelSize?.height ?? 0),
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        pointerEvents: 'auto',
        overflow: 'visible',
      }}
      // 웹판 마우스 길 — 칸을 누르면 그 칸으로 옮기고 확인한다
      onClick={onPress}
    >
      {/* 읽기 보조 — 칸 이름은 그림이다 */}
      <span style={{ display: 'none' }}>{label}</span>
      <img
        alt=""
        data-testid={`구질고르기-칸-${index}`}
        src={isOn ? selectedModeIconOf(cell.iconFrame) : modeIconOf(cell.iconFrame)}
        style={{ ...pixel, left: icon.x, top: icon.y }}
      />
      {isOn || labelSize === undefined ? (
        <img alt="" src={labelSrc} style={{ ...pixel, left: labelX, top: labelTop }} />
      ) : (
        // 효과 0xb 단색 — 그림을 마스크로 쓰고 회색을 칠한다
        <span
          style={{
            ...pixel,
            left: labelX,
            top: labelTop,
            width: labelSize.width,
            height: labelSize.height,
            background: solidColorCss(PITCH_CHOICE_DIM_LABEL_COLOR),
            maskImage: spriteMaskImage(labelSrc),
            WebkitMaskImage: spriteMaskImage(labelSrc),
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      )}
    </button>
  )
}
