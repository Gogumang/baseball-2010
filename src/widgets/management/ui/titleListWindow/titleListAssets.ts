import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const pad = (frame: number) => String(frame).padStart(3, '0')
/** 0xca911(틱, 10) ≠ 0 — 고른 줄 테두리 깜박임 */
export const BLINK_PERIOD = 10
/** 흰 글자(R=G=B) → img_text 팔레트 3 두 색. 255 → 41·73·165, 239 → 16·36·107 이 되는 1차식 (국가대항전 표와 같다) */
export const PALETTE_THREE_MATRIX = '1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'
