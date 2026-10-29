import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 아이템 창이 찍는 스프라이트 폴더 */
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const ITEM_ICON = assetUrl('./sprites/item_icon')

export const spriteSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`
