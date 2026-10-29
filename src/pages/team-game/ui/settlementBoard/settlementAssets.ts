import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const GAME_UI = assetUrl('./sprites/game_ui')
export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const RESULT_FRAMES = assetUrl('./sprites/result/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
export const POPUP_FRAMES = assetUrl('./sprites/popup/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const NUM = assetUrl('./sprites/num')
export const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`

/** img_text 252 "GP" */
export const GP_LABEL_FRAME = 252
/** 스크롤 막대 0x58c11 의 길 색 */
export const SCROLL_TRACK_COLOR = '#20309e'
/** slt_frame 이미지 78 — 스크롤 막대 ▲▼ */
export const SCROLL_ARROW_IMAGE = 78
