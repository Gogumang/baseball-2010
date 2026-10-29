import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 레벨업 창이 그리는 그림 — 글 img_text · 칸 slt_frame(프레임 · 이미지) · 예/아니오 popup · 숫자 num */
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame/frames')
export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
export const POPUP = assetUrl('./sprites/popup/frames')
export const NUM = assetUrl('./sprites/num')
export const pad = (frame: number) => String(frame).padStart(3, '0')
