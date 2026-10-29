import { SCREEN } from '@/pages/special/lib/specialLayout/specialItems'

/**
 * 머리띠·바닥띠 `0x54d95(skin, 0, 5)` — 다 내려온 상태 (P6 1-1 확정).
 * 그림은 `ui/game_frame.pzx`, 제목번호 0 → 이미지 3 "2010프로야구", 바닥 비트 5 = 되돌아가기만.
 *
 * **미끄러지지 않는다 — 원본 그대로**: 상태 6 들어옴 0x23d60(들어옴 표 0xcf06c 칸 4)은 [skin+0x84] 를 안 세우고,
 * 그리기 0x2860c 는 0x63b14 를 안 부른다(`ScreenFrame` 의 `slides` 머리말 전수). 머리띠는 앞 화면(처음 메뉴 상태 4)에서
 * 다 내려온 그대로다 — 다 내려온 자리에 바로 그린다.
 */
export const HEADBAND = {
  /** fillRect(0, −8, W, 15) #3145C6 → 화면에는 y 0~6 */
  band: { y: -8, height: 15, color: '#3145C6' },
  /** 선 y = 6·7 RGB(33,51,160) */
  line: { y: 6, height: 2, color: '#2133A0' },
  /** 이미지 0 (49×30 파란 막대) 을 x = −10, 39, 88 · 이미지 1 (30×30 사선 끝) 을 x = 135, y = 3 */
  tileImage: 0,
  tileXs: [-10, 39, 88],
  cornerImage: 1,
  cornerX: 135,
  tileY: 3,
  /** 제목 이미지 3 "2010프로야구" (123×21) 를 (8, 7) */
  title: { image: 3, x: 8, y: 7 },
} as const

export const FOOTER = {
  /** fillRect(0, 315, W, 5) #4074FB + 선 y=315 RGB(24,52,124) */
  band: { y: 315, height: 5, color: '#4074FB' },
  line: { y: 315, color: '#18347C' },
  /** 오른쪽 탭: 이미지 20(7×16) 을 x = 233…198, 이미지 19(16×16 사선) 를 x = 182, y = 300 */
  tileImage: 20,
  tileXs: [233, 226, 219, 212, 205, 198],
  cornerImage: 19,
  cornerX: 182,
  tileY: 300,
  /** 바닥 비트 0x4 = 되돌아가기 이미지 21 (19×13) 을 (W − 19 − 15 = 206, 304) */
  backIcon: { image: 21, x: SCREEN.width - 19 - 15, y: 304, width: 19, height: 13 },
} as const
