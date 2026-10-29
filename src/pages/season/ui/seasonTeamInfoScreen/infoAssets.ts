import type { ImgTextPaletteIndex } from '@/shared/ui'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** mode_ui 프레임 3 박스 — 판 (21,176,197,83) · 이름표 1 (30,·,25) · 값 2 (60,·,81) · 이름표 3 (147,·,25) · 값 4 (176,·,32) */
export const BOARD_WIDTH = 197
export const COLUMNS = [
  { label: { x: 30, width: 25 }, value: { x: 60, width: 81 } },
  { label: { x: 147, width: 25 }, value: { x: 176, width: 32 } },
] as const

/**
 * 값 칸의 img_text 는 **팔레트 1(노랑)** 이다 — 좌석 "석" 345 (0x7c914 `0x913e5(img_text, 1)` → 0x7c944) ·
 * 타입 이름표 (0x7cca6 → 0x7ccd4). 이름표 일곱(0x7c592~0x7c696)은 그 앞에 팔레트 0 으로 찍는다(0x7c620 · 0x7c656).
 */
export const VALUE_IMAGE_PALETTE: ImgTextPaletteIndex = 1
export const LABEL_PALETTE: ImgTextPaletteIndex = 0

export type PaletteStyleOf = (frame: number, palette: ImgTextPaletteIndex) => import('react').CSSProperties | undefined
