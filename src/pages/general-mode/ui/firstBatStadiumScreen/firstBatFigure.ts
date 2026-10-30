import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
export const GAME_UI_FRAME = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')
export const STADIUM_SYMBOL = assetUrl('./sprites/stadium_symbol')

export const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`
