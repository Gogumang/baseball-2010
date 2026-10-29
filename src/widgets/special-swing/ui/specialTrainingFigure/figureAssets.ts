import { SPECIAL_TRAINING_COST_BOX } from '@/widgets/special-swing/lib/specialTrainingWindow'
import type { TrainingBox } from '@/widgets/special-swing/lib/specialTrainingWindow'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const MODE_ICON = assetUrl('./sprites/mode_icon')
/** mode_icon.mpl 팔레트 0(주황)으로 다시 칠한 아이콘 — tools/generate_management_sprites.py 가 만든다 */
export const ICON_ORANGE = assetUrl('./sprites/management/icon_selected_')
/** num 흰 숫자 0~9 (8×10, "1" 만 4×10) · "/" 101 (10×10) */
export const NUM = assetUrl('./sprites/num')
export const WHITE_DIGIT_HEIGHT = 10
export const SLASH_SIZE = 10
export const whiteDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
/** G 동전 gpoint 11 (18×18) — 박스 3 에 정렬 0x21 · ox 2 */
export const G_COIN = { src: assetUrl('./sprites/gpoint/011.png'), x: SPECIAL_TRAINING_COST_BOX.x + 2, y: SPECIAL_TRAINING_COST_BOX.y } as const
export const SCREEN = { width: 240, height: 320 } as const
export const pad3 = (frame: number) => String(frame).padStart(3, '0')
export const layer = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' } as const

const hasAlign = (align: number, bit: number) => (align & bit) !== 0

/** 프레임 맞춤 가로 몫 — 0x2 가운데(내림) · 0x4 오른쪽 (둘 다면 더한다) */
function alignedXOf(box: TrainingBox, width: number, align: number): number {
  const center = hasAlign(align, 0x2) ? (box.width - width) >> 1 : 0
  const right = hasAlign(align, 0x4) ? box.width - width : 0
  return center + right
}

/** 프레임 맞춤 세로 몫 — 0x20 가운데(올림) · 0x40 아래 (둘 다면 더한다) */
function alignedYOf(box: TrainingBox, height: number, align: number): number {
  const d = box.height - height
  const middle = hasAlign(align, 0x20) ? Math.trunc(d / 2) + (d % 2) : 0
  const bottom = hasAlign(align, 0x40) ? d : 0
  return middle + bottom
}

/** 0xb9e05 → 0xb9d74 프레임 맞춤: 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림) · 0x40 아래 — 원점은 FrameSprite 가 더한다 */
export function frameAt(origins: FrameOrigins | null, frame: number, box: TrainingBox, align: number, ox = 0, oy = 0) {
  const origin = origins?.[pad3(frame)]
  if (origin === undefined) return null
  return { x: box.x + ox + alignedXOf(box, origin.width, align), y: box.y + oy + alignedYOf(box, origin.height, align) }
}

/** 0xb9d35 → 0xb9c5c 그림 맞춤: 0x22 가로 d → trunc(d/2) + d%2 · 세로 trunc((h − ih)/2), 0x44 오른쪽 아래 */
export function imageAt(box: TrainingBox, width: number, height: number, align: 0x22 | 0x44, ox: number, oy = 0) {
  if (align === 0x44) return { left: box.x + box.width - width + ox, top: box.y + box.height - height + oy }
  const d = box.width - width
  return { left: box.x + Math.trunc(d / 2) + (d % 2) + ox, top: box.y + Math.trunc((box.height - height) / 2) + oy }
}
