/** 구질 창 그림의 그림 폴더 · 맞춤 계산 (0xb9e05 · 0xb9d35 정렬) — 배치 값은 `lib/pitchTrainingWindow` */
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { PITCH_TRAINING_COST_BOX } from '@/pages/pitcher-league/lib/pitchTrainingWindow'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const SLT_PITCH = assetUrl('./sprites/slt_pitch/frames')
/** gpoint 이미지 11 — G 동전 18×18 ([skin+0x9c] = ui/gpoint) 을 박스 3 에 정렬 0x21 · ox 2 (세로 (18 − 18)/2 = 0) */
export const G_COIN = { src: assetUrl('./sprites/gpoint/011.png'), x: PITCH_TRAINING_COST_BOX.x + 2, y: PITCH_TRAINING_COST_BOX.y } as const
/** num 흰 숫자 0~9 (8×10, "1" 만 4×10) · "/" 101 (10×10) */
export const NUM = assetUrl('./sprites/num')
export const WHITE_DIGIT_HEIGHT = 10
export const SLASH_SIZE = 10
export const whiteDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
export const SCREEN = { width: 240, height: 320 } as const
/** 화면 전체를 덮는 svg 층 — 누름을 받지 않는다 */
export const FULL_LAYER = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' } as const

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export const pad3 = (frame: number) => String(frame).padStart(3, '0')

/** 0xb9e05 → 0xb9d74 프레임 맞춤: 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림) — 원점은 FrameSprite 가 더한다 */
export function frameAt(origins: FrameOrigins | null, frame: number, box: Box, align: number, ox = 0): { x: number; y: number } | null {
  const origin = origins?.[pad3(frame)]
  if (origin === undefined) return null
  let x = box.x + ox
  let y = box.y
  if ((align & 0x2) !== 0) x += (box.width - origin.width) >> 1
  if ((align & 0x4) !== 0) x += box.width - origin.width
  if ((align & 0x20) !== 0) {
    const d = box.height - origin.height
    y += Math.trunc(d / 2) + (d % 2)
  }
  return { x, y }
}

/** 0xb9d35 → 0xb9c5c 그림 가운데(정렬 0x22): 가로 d → trunc(d/2) + d%2 · 세로 trunc((h − ih)/2) */
export function imageCenterOf(box: Box, width: number, height: number, ox: number) {
  const d = box.width - width
  return { left: box.x + Math.trunc(d / 2) + (d % 2) + ox, top: box.y + Math.trunc((box.height - height) / 2) }
}
