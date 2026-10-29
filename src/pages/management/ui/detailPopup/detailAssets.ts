import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { DETAIL_CHANGE_X } from '@/pages/management/lib/detailPopup'

export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const NUM = assetUrl('./sprites/num')
export const frameNameOf = (frame: number) => String(frame).padStart(3, '0')
export const imageOf = (folder: string, frame: number) => `${folder}/${frameNameOf(frame)}.png`
export const ROW_HEIGHT = 15
/** 화살표는 3갱신마다 1px 흔들린다 */
export const ARROW_SWAY_UPDATES = 3
/** 넷째 칸(보너스) 부호 — num 105 "+" · 128 "−" (0x875fa~0x8760c: 글자판 +0x1a4 / +0x200) */
export const BONUS_SIGN_FRAMES = { plus: 105, minus: 128 }
/** 부호 그림 높이 (num 105 = 6px · 128 = 2px) — 세로 자리는 미확인이라 줄 가운데에 둔다 (추정) */
export const BONUS_SIGN_HEIGHTS = { plus: 6, minus: 2 }
/**
 * 보너스 칸 자리 — 원본은 변화량 숫자를 dx 4, 보너스 숫자를 dx 22(0x16), 부호를 dx 14(0xe) 에 그린다(같은 기준점).
 * 기준점 자체는 변화량처럼 미확인이라, 변화량 숫자 왼쪽(아래 `CHANGE_LEFT`)에서 그 차이(+18 · +10)만큼 민다.
 */
export const CHANGE_LEFT = DETAIL_CHANGE_X + 15
export const BONUS_NUMBER_DX = 22 - 4
export const BONUS_SIGN_DX = 14 - 4
