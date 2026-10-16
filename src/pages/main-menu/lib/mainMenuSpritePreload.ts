/**
 * 메인 메뉴 글자 그림 미리 받기 — 칸 글자 표(`MENU_REEL_ITEM_FRAMES` · `MENU_WHEEL_ITEM_FRAMES`)에서 계산한다.
 *
 * 릴 칸 글자와 판 제목은 `<img>` 본 글자 + 그림자 **마스크**(`tinted`, CSS mask-image) 두 벌로 그린다.
 * 마스크는 CORS 모드라 `?mask` 주소로 따로 받는다(`shared/lib/sprite/spriteMask`) — 예전에는 같은 주소를 썼던 탓에
 * 마스크가 받을 때마다 `<img>` 몫을 캐시에서 밀어내 메뉴 → 팀선택 사이에 img_text 006 · 009 가 다시 받히며 빈 칸이 났다(r109 의 수수께끼).
 */
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { MENU_REEL_ITEM_FRAMES, MENU_WHEEL_ITEM_FRAMES, menuReelFrameListOf } from '@/pages/main-menu/lib/mainMenuLayout'

const IMG_TEXT_FRAMES = './sprites/img_text/frames'

/** 메인 메뉴 글자 — 바퀴 칸(본 글자) · 릴 칸(본 글자 + 그림자 마스크) · 하위 목록 판 제목(마스크) */
export function mainMenuSpritePreloads(): SpriteFolderPreload[] {
  const reel = Object.values(MENU_REEL_ITEM_FRAMES).flatMap(menuReelFrameListOf)
  const frames = [...new Set([...MENU_WHEEL_ITEM_FRAMES, ...reel])].sort((a, b) => a - b)
  const masks = [...new Set([...reel, ...MENU_WHEEL_ITEM_FRAMES])].sort((a, b) => a - b)
  return [{ folder: IMG_TEXT_FRAMES, frames, json: ['origins.json'], masks }]
}
