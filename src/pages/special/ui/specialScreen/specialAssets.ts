import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MAIN_UI = assetUrl('./sprites/main_ui')
export const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
export const GAME_FRAME = assetUrl('./sprites/game_frame')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
/** ui/team_logo.pzx — 메뉴 진입 0x24924 가 [this+0xa8] 에 올려 0x663c5 로 목록에 넘긴다 */
export const TEAM_LOGO = assetUrl('./sprites/team_logo')

export const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`
