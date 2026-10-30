import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const SLT_FRAMES = assetUrl('./sprites/slt_frame/frames')
export const NUM = assetUrl('./sprites/num')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')

export const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`
