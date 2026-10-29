import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`
/** 격자 칸 바탕 slt_frame 이미지 0 · 고른 칸 테두리 이미지 1 (42×42) · 칸 로고 38 — 팀 고르기 화면과 같은 근사 */
export const CELL_FRAME_IMAGE = 0
export const CELL_CURSOR_IMAGE = 1
export const CELL_CURSOR_SIZE = 42
export const CELL_LOGO_SIZE = 38
export const BIG_LOGO_HALF = 38
