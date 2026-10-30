import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'

export const SLT_FRAMES = assetUrl('./sprites/slt_frame/frames')
export const SLT_IMAGES = assetUrl('./sprites/slt_frame')
export const POPUP_FRAMES = assetUrl('./sprites/popup/frames')
export const NUM_IMAGES = assetUrl('./sprites/num')

export const pngOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 합성 프레임 한 장의 폭 — 원점을 아직 못 읽었으면 0 */
export const widthOf = (origins: FrameOrigins | null, frame: number): number => origins?.[String(frame).padStart(3, '0')]?.width ?? 0
