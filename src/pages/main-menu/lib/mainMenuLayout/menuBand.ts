/** 아랫단 바탕 띠 (0x253e8~0x2548e · 0x254d4~0x25516) */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/main-menu/lib/mainMenuLayout/menuScreen'

/**
 * 릴 뒤에 깔리는 **바탕 띠**. 릴과 같은 축 `(폭/2, 높이)` 를 쓰고 `y = 높이 ± i` 로 위아래
 * 대칭으로 가로선을 긋는다. 아래쪽 절반은 화면 밖이라 **오른쪽 80px 띠가 바닥에서 올라오는**
 * 것으로 보인다.
 *
 * 원본 그리기 (0x253e8~0x2548e, 전부 다시 떠서 확인):
 * ```
 *   알파 = 256
 *   for (i = 0; i <= (s16)[메뉴+0xe4]; i++) {           ; [0xe4] < 0 이면 아예 안 돈다
 *     알파 -= 2; if (알파 <= 3) 알파 = 4                 ; 0x25400~0x2540c
 *     색 = (알파 << 24) | 0x192e74                       ; 0x2543e (상수 0x25580)
 *     선(g, 폭()−0x50, [+0xdc]−i, 폭(), 같은 y, 색)      ; 0x2541e·0x25426·0x2543c
 *     선(g, 폭()−0x50, [+0xdc]+i, 폭(), 같은 y, 색)      ; 0x25472
 *   }
 * ```
 * 그리기는 0x6a905 `선(ctx, x1, y1, x2, y2=[sp0], color=[sp4])` 이고, 그 안에서 색의 위 바이트를
 * 알파로 본다(0x6a918: `0` 이거나 `0xff` 면 섞지 않는다). 그래서 알파는 **255 로 나눈다**.
 *
 * ⚠️ **x 는 `폭−0x50 → 폭` 이지 `0 → 폭` 이 아니다.** 두 좌표 다 폭(0x14008b8)을 부른 값이고
 * 첫 번째만 0x50 을 뺀다. 240 화면에서 **160 → 240**.
 */
export const MENU_BAND_COLOR = { r: 0x19, g: 0x2e, b: 0x74 } as const
export const MENU_BAND_LEFT = SCREEN_WIDTH - 0x50
export const MENU_BAND_RIGHT = SCREEN_WIDTH
/** 띠 축 y = `[메뉴+0xdc]` = 높이 (0x237dc) — 릴 축과 같은 자리다 */
export const MENU_BAND_PIVOT_Y = SCREEN_HEIGHT

/**
 * 첫 값 1 — 0x23846 `strh 1, [메뉴+0xe4]`.
 * ⚠️ 원본은 **장면을 만들 때 전역 `[0x140006c]` 가 5 나 0x11 일 때만** 이 값을 넣는다
 * (0x2381c~0x23848, 생성자 0x234d4). 곧 "메인 메뉴를 게임시작 목록으로 바로 열어라" 로
 * 들어올 때만 연출이 돌고, 윗단에서 OK 로 내려온 경우에는 `[0xe4]` 가 0 이라 띠가 안 보인다.
 */
export const MENU_BAND_FIRST_SPREAD = 1

/**
 * 멈추는 값 = **높이/2 = 160**. 0x254e4~0x25512 (다시 떠서 확인):
 * ```
 *   n = (s16)[메뉴+0xe4]; [메뉴+0xe4] = n*4                ; 0x254e4·0x254e6
 *   if ((s16)(n*4) >= 높이()>>1) {                          ; 0x254f0(0x14008c8 호출)·0x254f8
 *     [메뉴+0xe4] = 높이()>>1 ; [메뉴+0xe2] = 0             ; 0x2550e~0x25514
 *   }
 * ```
 * 0x254f0 이 부르는 것은 **높이(0x14008c8)** 다 — 그리기 쪽 0x2541a·0x25464 가 부르는 폭
 * (0x14008b8) 과 다른 토막이다. 그래서 상한은 120(폭/2)이 아니라 **160(높이/2)** 이다.
 */
export const MENU_BAND_MAX_SPREAD = SCREEN_HEIGHT >> 1

/** 선 하나의 알파 — 256 에서 2씩 줄이고 4 에서 멈춘다 (0x25400~0x2540c). i = 0 이 254 다. */
export function menuBandAlphaAt(offset: number): number {
  const alpha = 256 - 2 * (offset + 1)
  return alpha <= 3 ? 4 : alpha
}

export interface MenuBandState {
  /** 이번 틱에 그리는 `[메뉴+0xe4]` */
  readonly spread: number
  /** `[메뉴+0xe2]` ≠ 0 — 아직 자라는 중. 이 동안 **릴 줄을 안 그린다** (0x254d8). */
  readonly isGrowing: boolean
}

/**
 * `tick` 번째 갱신에 그리는 띠 상태.
 *
 * 0x2524c 는 **띠를 먼저 그리고 그 다음에 자란다** — 그래서 화면에 나오는 값은
 * `1 → 4 → 16 → 64 → 160` 이다. 넷째 틱에서 64×4 = 256 이 160 을 넘어 160 으로 잘리고
 * `[0xe2] = 0` 이 되므로, 줄이 안 그려지는 틱은 **넷**(0~3)이다.
 */
export function menuBandStateAt(tick: number): MenuBandState {
  let spread = MENU_BAND_FIRST_SPREAD
  for (let step = 0; step < tick; step += 1) {
    const grown = spread * 4
    if (grown >= MENU_BAND_MAX_SPREAD) return { spread: MENU_BAND_MAX_SPREAD, isGrowing: false }
    spread = grown
  }
  return { spread, isGrowing: true }
}

/** 다 자랄 때까지 걸리는 틱 수 (줄이 안 그려지는 틱 수와 같다) — 원본 값으로 세어 둔다 */
export const MENU_BAND_GROW_TICKS = ((): number => {
  let ticks = 0
  while (menuBandStateAt(ticks).isGrowing) ticks += 1
  return ticks
})()

export interface MenuBandLine {
  readonly y: number
  /** 0~255 (원본 알파 바이트 그대로) */
  readonly alpha: number
}

/**
 * `spread` 만큼 펼쳐졌을 때 긋는 가로선 목록. 축 위 `높이 − i` 와 축 아래 `높이 + i` 가
 * **같은 알파**를 쓴다 (둘 다 `[sp+0x14]` 에 넣어 둔 색을 읽는다 — 0x25446·0x25470).
 * 아래쪽은 화면 밖이지만 원본이 긋는 대로 그대로 낸다.
 */
export function menuBandLinesOf(spread: number): readonly MenuBandLine[] {
  if (spread < 0) return []
  const lines: MenuBandLine[] = []
  for (let offset = 0; offset <= spread; offset += 1) {
    const alpha = menuBandAlphaAt(offset)
    lines.push({ y: MENU_BAND_PIVOT_Y - offset, alpha })
    lines.push({ y: MENU_BAND_PIVOT_Y + offset, alpha })
  }
  return lines
}
