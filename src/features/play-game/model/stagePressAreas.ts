import { MENU_LABEL_POSITION, TIME_LABEL_POSITION } from '@/widgets/batting-stage/lib/softKeyLabels'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PressRect } from '@/shared/ui'

/**
 * **타석 화면의 투명한 누름 칸 자리** — 웹 단추(메뉴 · 도루)를 걷어 내고 원본 그림 자리에 투명하게 얹는다.
 * 앱에는 전역 가상 키패드가 없어 마우스 · 터치로 '*' · '3'/'2'/'1' 을 누를 길이 이것뿐이다.
 */

/**
 * '*' 메뉴 — 소프트키 글자 "*MENU"(game_ui 프레임 90, 41 × 12)가 서는 (0, H − h − 1) = (0, 307) 자리
 * (타석 공용 그리기 0x4c4bc 의 4c926, `softKeyLabels`).
 */
export const MENU_PRESS_RECT: PressRect = { ...MENU_LABEL_POSITION, width: 41, height: 12 }

/**
 * '#' — 소프트키 글자 "#TIME"(game_ui 프레임 91, 41 × 12)이 서는 (W − w − 1, H − h − 1) = (198, 307) 자리 (0x4c9f8).
 * 그 글자는 0x38984 가 참이고 상태 0xe · 0xf 이며 벤치 수 > 0 일 때만 선다(`softKeyLabels`) — 누름 칸도 '#' 를 받는 동안만 둔다.
 */
export const TIME_PRESS_RECT: PressRect = { ...TIME_LABEL_POSITION, width: 41, height: 12 }

/**
 * CLR — 원본 화면에는 CLR 글자가 없다(하드웨어 키). ⚠️ 웹 자리: 조준(0x10) · 게이지(0x11)는 "#TIME" 을 안 그리는 상태라(0x4c92e)
 * 오른쪽 소프트키 글자 자리를 빌린다.
 */
export const CLEAR_PRESS_RECT: PressRect = TIME_PRESS_RECT

/**
 * 도루 '3' · '2' · '1' — 원본은 도루 키에 그림을 두지 않는다. 그 주자가 선 루를 점수판 0x373d0 의 루 그림
 * (game_ui 파트 6, 14 × 7 — 1루 (68, 14) · 2루 (59, 9) · 3루 (50, 14), `renderHud` 의 `BASES`) 자리로 삼는다.
 * ⚠️ 웹 자리: 원본에는 이 누름 자리가 없다(키뿐) — 누르면 그 루 주자의 도루 키와 같다.
 */
const BASE_ICON_RECTS: Readonly<Record<StealBase, PressRect>> = {
  1: { x: 68, y: 14, width: 14, height: 7 },
  2: { x: 59, y: 9, width: 14, height: 7 },
  3: { x: 50, y: 14, width: 14, height: 7 },
}

export function stealPressRectOf(base: StealBase): PressRect {
  return BASE_ICON_RECTS[base]
}
