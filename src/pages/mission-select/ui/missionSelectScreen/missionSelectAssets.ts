import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')

/** StrMAINMENU[60] — 잠긴 칸 OK (0x1db84~0x1dba4: 0x74ef5(…, 종류 1)) */
export const LOCKED_MISSION_TEXT = ORIGINAL_MAIN_MENU_TEXT[60] ?? ''
/** StrMAINMENU[61] — 열린 칸 OK, %s = 미션 레코드 +0x2e 이름 (0x1db34~0x1db7c: 0x74ef5(…, 종류 2)) */
export const challengeTextOf = (name: string) => (ORIGINAL_MAIN_MENU_TEXT[61] ?? '').replace('%s', name)

export const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`
