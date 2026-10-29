import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * StrMAINMENU[108] 원문 (`base/extracted/StrMAINMENU.json`). 팝업 그리기 0x32b7d 는 [109](아이디 입력)를 기본으로 잡고
 * this+0x181 == 1(에디트가 세운 깃발)이면 [108] 로 바꾼다 (0x32ba4~0x32bc8).
 */
export const NAME_PROMPT = ORIGINAL_MAIN_MENU_TEXT[108] ?? ''

/**
 * 판 높이 — 0x741a1 이 팝업 +0x20e 에 넣는 0x6e = 110. 판은 세로 가운데 (320 − 110) / 2 = 105 다 — 확정(2026-10-14):
 * 그리기 0x744c4 가 x = (W − 폭) >> 1 · y = ((H − 그리는 높이) >> 1) + [창+0x244](0x741a0 이 0) 로 긋는다(0x744de~0x74520).
 * 글·칸 좌표는 그리기 콜백 0x32b7d 에서 떴다(확정).
 */
export const POPUP_HEIGHT = 0x6e
/** 문구 `0xba269(글, W/2 − 100, 0x82, 0xc8, 흰색)` */
export const PROMPT = { x: 120 - 100, y: 0x82, width: 0xc8 } as const
/** 입력 칸 폭 100 × 높이 15 를 (W/2 − 50, 0xaf) 에 RGB(30,45,160) 로 채운다 (0x6b7d5) */
export const FIELD = { x: 120 - 50, y: 0xaf, width: 0x64, height: 0xf } as const
/**
 * 입력 칸 오른쪽 **입력 방식 표시** (U-91, 직접 뜸 — 0x32c96~0x32cf2 · 0x541ed · 0x676e9):
 * ```
 * 0x541ed(skin, x + w + 0xe = 184, y + 1 = 176, 흰색)   ; 글 = 표 0x1400148[입력기 +0x14] — 0 "A" · 1 "a" · 2 "1" · 3 "가"
 *                                                       ; 0x6b391 로 x = (방식 3 ? 184 : 186)
 * 0xba759([장면+0x9c] slt_frame, 이미지 20, 종류 0, x + w + 5 = 175, y + 2 = 177)          ; ◀ (5×8)
 * 0xba759([장면+0x9c] slt_frame, 이미지 20, 종류 0, x + w + 0x18 = 194, y + 2 = 177, 효과 0x11) ; ▶ (뒤집기)
 * ```
 * 칸 둘레에 흰 선은 없다 — 0x541a9 는 입력 글(0x677d5), 0x541ed 는 이 방식 글이다(앞선 노트의 "흰 선" · "프레임 20/17" 은 오독).
 * 입력기는 0x54145(skin, **3**, 8, 1, 1) 로 켜므로 처음 방식은 3 "가" 다. 웹은 방식을 바꾸는 키(←/→ 0x673ed · 0x673a9)가 없는
 * 일반 입력 칸이라 처음 표시 "가" 에 머문다.
 */
export const INPUT_MODE_MARK = { label: '가', x: 120 - 50 + 0x64 + 0xe, y: 0xaf + 1 } as const
export const INPUT_MODE_ARROWS = {
  image: assetUrl('./sprites/slt_frame/020.png'),
  leftX: 120 - 50 + 0x64 + 5,
  rightX: 120 - 50 + 0x64 + 0x18,
  y: 0xaf + 2,
} as const
