import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
/** 그림 폴더의 세 자리 이름 */
export const frameNameOf = (frame: number) => String(frame).padStart(3, '0')
