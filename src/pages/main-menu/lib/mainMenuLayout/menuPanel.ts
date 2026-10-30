/** 설명 판 · 상태 제목 (0x25036 이후) */
import { MENU_WHEEL_ITEM_FRAMES, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/main-menu/lib/mainMenuLayout/menuScreen'
import type { MenuWheelPoint } from '@/pages/main-menu/lib/mainMenuLayout/menuWheel'

export interface MenuPanelBox {
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 설명 판 = `main_ui` **이미지** 3 (149×63). 자리는 두 함수가 따로 같은 식으로 구한다:
 *   `x = scrW − 폭 + 5` = **96** (0x24db0 · 0x256fc)
 *   `y = 320 − 높이/2`  = **289** (0x24dc0 · 0x25714)
 *
 * ⚠️ **판 아래 절반(289+63 = 352)이 화면 밖인 것도 원본이 그렇다 — 확정.**
 * 식이 `높이 − 높이/2` 라 **어느 해상도에서나 아래 h/2 = 32px 가 바닥 밖**이다(해상도 무관).
 * 0x25714(아랫단)와 0x24dc0(윗단 바퀴) **두 곳이 따로 같은 식을 쓴다**. 오른쪽으로도 5px
 * 삐져나간다(96+149 = 245). R6-sprite-leftovers 2절이 같은 좌표를 따로 확인해 뒀다.
 * 그림은 좌상단 기준이다 — 0xba759 는 (자원, 번호, 종류, x, y, …) 를 받아 종류 0 이면
 * 이미지 vtable 로 그대로 넘기고, 가운데 맞춤이 필요한 곳(바퀴 칸 0x24fc4, 판 안 큰 글자 0x25794)은
 * **부르는 쪽이 직접 w/2·h/2 를 뺀다**. 곧 (96,289) 는 가운데가 아니라 좌상단이다.
 */
export const MENU_DESCRIPTION_PANEL: MenuPanelBox = {
  frame: 3,
  width: 149,
  height: 63,
  x: SCREEN_WIDTH - 149 + 5,
  y: SCREEN_HEIGHT - (63 >> 1),
}

/** 설명 글을 쓰는 안쪽 칸 `(x+5, y+5, w−10, h−10)` — R6 2절 (0x25036 이후) */
export const MENU_DESCRIPTION_TEXT_BOX = {
  x: MENU_DESCRIPTION_PANEL.x + 5,
  y: MENU_DESCRIPTION_PANEL.y + 5,
  width: MENU_DESCRIPTION_PANEL.width - 10,
  height: MENU_DESCRIPTION_PANEL.height - 10,
} as const

/**
 * 판 안 큰 글자(`main_ui` **프레임**)의 좌상단 — 0x25794~0x257c4 (확정).
 * `(판x + (149 − w)/2 + 2, 판y + (63 − h)/2 + 5)`.
 * 판이 이미 반쯤 화면 밖이라 27px 글자는 **윗 8px 만 보인다**(`높이 − 8` 자리라 해상도 무관).
 * ⚠️ 여기만은 **왜 이래도 되는지 설명을 못 찾았다**. 회색 상태 제목(img_text 10px)은 `높이 − 23`
 * 이라 온전히 보이는데 큰 글자만 잘린다. 그리기 쪽에 세로 보정이 있기는 하다 —
 * 0xba759 는 인자 [sp+0xc] ≠ 0 일 때 전역 `[0x15606f4]` 를, 낮은 단계는 `[그래픽+0x40]` 을
 * y 에 더한다(0xbaedc) — 그러나 **메뉴는 그 인자를 0 으로 넘긴다**(0x25768). 원본 식 그대로 둔다.
 */
export function menuPanelLabelTopLeftOf(width: number, height: number): MenuWheelPoint {
  return {
    x: MENU_DESCRIPTION_PANEL.x + ((MENU_DESCRIPTION_PANEL.width - width) >> 1) + 2,
    y: MENU_DESCRIPTION_PANEL.y + ((MENU_DESCRIPTION_PANEL.height - height) >> 1) + 5,
  }
}

/**
 * 판 왼쪽 위에 회색으로 찍는 상태 제목(img_text 프레임) — 0x257cc~0x257ee.
 * 색은 `setColor(0x80,0x80,0x80)`, 자리는 `(판x + 8, 판y + 8)`, 효과 0xb(단색 찍기)다.
 * 번호는 **0xcea6c[상태 − 5]** 라 윗단 칸 글자 표와 같은 표를 쓴다 (0x254aa).
 */
export const MENU_PANEL_HEADING_COLOR = '#808080'
export function menuPanelHeadingTopLeftOf(): MenuWheelPoint {
  return { x: MENU_DESCRIPTION_PANEL.x + 8, y: MENU_DESCRIPTION_PANEL.y + 8 }
}

/** 상태 제목 img_text 프레임 — 0xcea6c[상태 − 5] (윗단 칸 글자 표와 같은 표) */
export function menuPanelHeadingFrameOf(state: number): number | null {
  return MENU_WHEEL_ITEM_FRAMES[state - 5] ?? null
}
