/** 타석 배경의 화면 자리 — 카메라 · 하늘 띠 · 펜스 기준점 · 우타 거울 축 */

export const CAMERA = { x: -120, y: -70 }
export const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
export const CLOUD_COUNT = 3
/** 하늘을 단색으로 칠하고 조명도 안 그리는 구장 번호 (0x78046 · 0x784c6 `cmp #8`) */
export const FLAT_SKY_STADIUM = 8
/** 구장 8 의 하늘 단색 — 0x7806e `0x1400748(0xc6, 0xd4, 0xd7)` */
export const FLAT_SKY_COLOR = 'rgb(198, 212, 215)'
/** 좌타 펜스 기준점 (−121 − 10, −70 + 3) */
export const FENCE_ANCHOR = { x: CAMERA.x - 1 - 10, y: CAMERA.y + 3 }

/**
 * **우타(구장 +0x60 == 0) 거울** — 0x77974 · 0x77494 · 0x7725c 를 직접 떴다 (2026-10-14).
 * ```
 * 779a4  +0x60 ≠ 0(좌타): x = 구장+4 − 1 … − 10 에 효과 0 · 박스 계산 0x948cd 도 효과 0      ; 77a1a~77a40
 *        +0x60 == 0(우타): x = 구장+4 + 10 + 480 에 효과 0x11(좌우)로 펜스를 그리고 박스도 효과 0x11 로 잰다 ; 77a42~77ab4
 * 77ad0  팀 아이콘 0 · 1 = 펜스 박스 i 의 (x, y) + (잰 박스 x − 프레임 +0xe) — 아이콘 자체는 안 뒤집는다(0xb9d35, 정렬 0x22)
 * 77bea  관중 ppl(+0x74) 파트: 좌타 x = 기준 + dx · 우타 x = 기준 + dx + 0x78 — **효과는 같다(안 뒤집는다)**
 * 77d06  전광판 글자 상자 = 펜스 박스 2 + 1 + (잰 박스 x − 프레임 +0xe) — 글자도 안 뒤집는다
 * 77540  시즌 구장 0x77494: 관중석 · 관중 덧그림 · 전광판 그림 셋 다 우타면 x + 490 · 효과 0x11, 아이콘 · 글자는 전광판 그림 박스로 잰다
 * 772ca  바닥 0x7725c: 좌타 x = 구장+4 − 1 − 0x48 효과 0 · 우타 x = 구장+4 − 0x21 효과 0x11 (그림 단계 뒤집기 — 제 상자 안)
 * ```
 * 효과 0x11 · b 0 은 파트를 x' = X − (dx + 폭) 에 거울로 놓는다(R6 3b) — 펜스 점 p 는 좌타 XL + p, 우타 XR − 1 − p 이고
 * XL = −131 · XR = 370 이라 **화면 x → 238 − x 거울**이다(바닥도 폭 585 라 같은 거울). 그래서 펜스 · 관중석 · 전광판 그림 · 바닥은
 * 캔버스를 (239, 0) 에서 뒤집어 그리고, 박스로 놓는 팀 아이콘 · 전광판 글자는 뒤집지 않은 채 잰 박스만큼 옮긴다
 * (`rightHandedBoxShiftOf` — 지금 펜스 셋은 모두 141), 관중 ppl 은 0x78 + 21 = 141 옮긴다.
 * 예전 웹은 통째로 뒤집어 관중 ppl 그림의 "GAMEVIL®" 글자가 거울로 나와 거울을 꺼 두었다 — 원본은 ppl 을 안 뒤집고 옮기기만
 * 하므로 우타에서도 그 글자는 똑바로 읽힌다(헤드리스 확인).
 * 흔들기 칸(구장 +0x64 → 0xbb255 · 0x771e4)은 웹이 안 그리므로 0 으로 본다.
 */
export const RIGHT_HANDED_MIRROR_X = 239
/** 우타 펜스 그리기 x = 구장+4 + 10 + 480 (0x77a72 · 0x77a84) */
const RIGHT_HANDED_FENCE_X = CAMERA.x + 10 + 480
/** 우타 관중 ppl 파트는 좌타 자리 + 0x78 + 21 (77bf0 · 77c0e — 기준이 −1 − 10 대신 + 10 이고 + 0x78) */
export const RIGHT_HANDED_CROWD_SHIFT = 10 + 0x78 - (-1 - 10)

/**
 * 우타 때 박스로 놓는 그림(팀 아이콘 · 전광판 글자)을 좌타 자리에서 옮기는 값 — (XR − 2·원점x − 폭) − XL.
 * 0x948cd 가 효과 0x11 로 잰 박스 x = XR − (원점x + 폭) 에서 프레임 +0xe(원점x) 를 한 번 더 뺀다.
 */
export function rightHandedBoxShiftOf(frame: { readonly offsetX: number; readonly width: number }): number {
  return RIGHT_HANDED_FENCE_X - 2 * frame.offsetX - frame.width - FENCE_ANCHOR.x
}
