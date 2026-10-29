/** 등록 화면 그림 폴더 · 프레임 맞춤 (0xb9d74) */
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { RegisterBox } from '@/pages/pitcher-league/lib/pitcherRegisterLayout'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const SLT_PITCH = assetUrl('./sprites/slt_pitch/frames')
export const pad3 = (frame: number) => String(frame).padStart(3, '0')

/** 0xb9d74 프레임 맞춤 — 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림), 그 뒤 ox */
export function frameAt(origins: FrameOrigins | null, frame: number, box: RegisterBox, align: number, ox = 0): { x: number; y: number } | null {
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
