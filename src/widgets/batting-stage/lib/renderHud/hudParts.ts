import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** game_ui 프레임 0 — HUD 판 전체(박스가 곧 배치표), (6, 6) 에 그린다 */
export const HUD_FRAMES = assetUrl('./sprites/game_ui/frames')
export const HUD_ORIGIN = { x: 6, y: 6 }

/** game_ui 파트 그림 — 베이스 6 · 램프 13 ~ 15 */
export const hudPartUrl = (index: number) => assetUrl(`./sprites/game_ui/${String(index).padStart(3, '0')}.png`)
