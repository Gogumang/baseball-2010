import { PANEL, SCREEN } from '@/pages/settings/lib/settingsLayout/settingsRows'

/**
 * 사운드 값 — 소리 크기만큼 이미지 98 + k 를 `x = x0 + 118 + k·(w + 1)`, `y = Y + 35 + (막대 높이 18 − h)` 에 찍는다
 * (0x59a14~0x59a86 직접 뜸 — 높이 기준은 그림 중 최대가 아니라 **값 막대 프레임 35 의 높이**다). 밑변이 모두 Y + 53 이다.
 * 소리 0 이면 막대 대신 StrMAINMENU[0x4e] "OFF" 를 "!C!c7B93D4%s" 로 (x0 + 98, Y + 41) 막대 폭 가운데 (0x59a94~0x59ae8).
 */
export const SOUND_BARS = {
  firstImage: 98,
  x: PANEL.x + 118,
  dy: 35,
  /** 기준 높이 — 값 막대 프레임 35 */
  baseHeight: 18,
  gap: 1,
  /** 이미지 98~101 의 폭·높이 (public/sprites/slt_frame/098~101.png) */
  sizes: [
    { width: 12, height: 2 },
    { width: 12, height: 5 },
    { width: 12, height: 8 },
    { width: 12, height: 11 },
  ],
} as const

/**
 * 속도 값 — 속도 + 1 개만큼 이미지 102 + k 를 x0 + 107 부터 **틈 없이 붙여**(x += 그 그림 폭)
 * `y = Y + 37 + (막대 높이 18 − h)/2` — 막대 안 **세로 가운데** (0x59b9c~0x59c10 직접 뜸).
 * 속도는 0~4 라 꺾쇠가 최대 다섯 장(102~106)이다.
 */
export const SPEED_MARKS = {
  firstImage: 102,
  x: PANEL.x + 107,
  dy: 37,
  baseHeight: 18,
  /** 이미지 102~106 의 폭·높이 (public/sprites/slt_frame/102~106.png) */
  sizes: [
    { width: 11, height: 7 },
    { width: 11, height: 7 },
    { width: 12, height: 9 },
    { width: 12, height: 9 },
    { width: 13, height: 11 },
  ],
} as const

/** 사운드 막대 k 의 (x, y 보정) — 아래 맞춤 `18 − h` */
export function soundBarAt(k: number): { readonly x: number; readonly dy: number } {
  const size = SOUND_BARS.sizes[Math.min(Math.max(0, k), SOUND_BARS.sizes.length - 1)]
  return { x: SOUND_BARS.x + k * (size.width + SOUND_BARS.gap), dy: SOUND_BARS.dy + SOUND_BARS.baseHeight - size.height }
}

/** 속도 꺾쇠 k 의 (x, y 보정) — 앞 그림 폭만큼 붙이고 막대 안 세로 가운데 */
export function speedMarkAt(k: number): { readonly x: number; readonly dy: number } {
  let x = SPEED_MARKS.x
  for (let j = 0; j < k; j += 1) x += SPEED_MARKS.sizes[Math.min(j, SPEED_MARKS.sizes.length - 1)].width
  const size = SPEED_MARKS.sizes[Math.min(Math.max(0, k), SPEED_MARKS.sizes.length - 1)]
  return { x, dy: SPEED_MARKS.dy + Math.trunc((SPEED_MARKS.baseHeight - size.height) / 2) }
}

/**
 * 진동 값 — StrMAINMENU[0x4e] "OFF" (x0 + 97) · [0x4f] "ON" (x0 + 136), y Y + 41, 폭 38 가운데.
 * 지금 값 쪽이 "!C!cffffff%s" 흰색, 아닌 쪽 "!C!c7B93D4%s" (0x59cc6~0x59d6c).
 * 지금 값 칸에 노랑 RGB(255,255,85) **테두리** 0x6a979 (x0 + 99 + 39·값, Y + 38, 35×15) (0x59d70~0x59d9a) — 채우기가 아니다.
 */
export const VIBRATION = {
  off: { x: PANEL.x + 97, dy: 41, width: 38 },
  on: { x: PANEL.x + 136, dy: 41, width: 38 },
  outline: { x: PANEL.x + 99, step: 39, width: 35, height: 15, dy: 38 },
} as const

/**
 * 아래 OK 버튼 — `ui/popup.pzx` 프레임 0 을 가운데에. `y = H/2 + hh/2 − h − 6` (0x59dc8~0x59de6 직접 뜸, h = 15) —
 * 메인 메뉴(hh 212) 245 · 경기 중(hh 130) 204. 예전 값 251 은 −6 을 빠뜨린 문서 결과값이었다.
 */
export const OK_BUTTON = { frame: 0, width: 41, height: 15 } as const

export const okButtonTopOf = (panelHeight: number) => SCREEN.height / 2 + Math.trunc(panelHeight / 2) - OK_BUTTON.height - 6

/**
 * **경기 중 메뉴 "설정"**(0x3c326 → 하위 5, 그리기 0x3cdd0 이 0x593c8 종류 8)은 **작은 판**이다.
 *
 * 경기 장면 초기화 0x3301c 가 skin+0x125 = 1 을 세우고(0x33038, 경기 장면을 나가는 0x332b8 · 메인 메뉴 0x234d4 는 0),
 * 0x593c8 이 그 플래그면 판 높이 [sp+0x88] = **0x82(130)**(0x5940c~0x59422) · 그리는 줄 수 [sp+0x78] = **3**
 * (0x595d0~0x595e4) — 사운드·속도·진동만 있고 **상세 설정·모드 초기화·게임 데이터 관리 줄이 아예 없다**.
 * y0 = H/2 − 130/2 = 95 라 판·제목·줄·OK 가 모두 (95 − 54) = 41 아래로 내려간다(x 는 그대로).
 * 커서 격자는 1열 4행(0x3c3ac `vtbl+0x10(1, 4, 1, 0x20, 0)`) — 셋째 다음 칸이 OK 단추다.
 */
export const IN_GAME_PANEL = { x: PANEL.x, y: SCREEN.height / 2 - 130 / 2, width: PANEL.width, height: 130 } as const

export const IN_GAME_ROW_COUNT = 3

/**
 * OK 단추도 커서 칸이다 — 격자 마지막 칸(열수 × 행수 − 1)이 고른 칸이면 popup 프레임 **0x12(18)**(주황 "OK", 49×23,
 * 원점 −4,−4), 아니면 프레임 0 (0x59de2~0x59e4e). 메인 메뉴 첫 화면 격자는 1×7(진입 0x259fc `vtbl+0x10(1, 7, …)`).
 */
export const OK_SELECTED_FRAME = 18

export const OK_SELECTED_OVERFLOW = 4
