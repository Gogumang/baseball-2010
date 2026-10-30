import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MAIN_TITLE = assetUrl('./sprites/main_title')
export const GPOINT_FRAMES = assetUrl('./sprites/gpoint/frames')
export const pad = (index: number) => String(index).padStart(3, '0')
