/**
 * **선수 정보 창 0x5b798(skin, 종류, rec)** — '0' INFO. 종류 3 투수 · 2 타자. 부르는 곳 둘(`xref 0x5b798`):
 * - 교체 창 0x384b8 → 0x381e8(리터럴 0x384b4) — 창 자리는 '0' 키 0x49712 가 세운다.
 * - 엔트리 목록 창 0x5c984 끝 0x5cfc8 — `0x5b798(ed, 투수 탭 [ed+0x33f] ? 3 : 2, [[ed+0x420] + (투수 ? 0x14 : 0x18)] + 커서·0x30)`
 *   (커서 = [목록+0x10]×[목록+0x14]+[목록+0xc], 0x5cf90~0x5cfc8). 창 자리는 편집기 키 0x55864 의 '0' 갈래 0x55920 이 세운다.
 *
 * 창 상태는 skin(편집기) 칸 [+0x424] 켜짐 · [+0x425] 다 열림 · [+0x426] 걸음 · [+0x428] 끝 x − W/2 + 0x60 · [+0x42c..+0x432] (x, y, w, h).
 * ```
 * '0' 키   x = W/2 + a · y = H/2 − b · w = 7 · h = 203 · [+0x428] = x − W/2 · 걸음 1 · [+0x425] = 0
 *          교체 창 0x49712: a = 0x52, b = 0x65 → (202, 59)   엔트리 창 0x55920: a = 0x5c, b = 0x60 → (212, 64)
 * 0x5c8aa  (창을 다 그린 뒤) 걸음 ×= 2 · x −= 걸음 · w += 걸음, w > 105 면 w = 106 · x = W/2 + [+0x428] − 0x60 · [+0x425] = 1
 * ```
 * 창 안의 칸은 모두 [+0x42c] · [+0x42e] 에서 잰다 — 2026-10-16 r99 unicorn 으로 0x5b798 을 (116, 64) · (106, 59) 두 자리에서 돌려
 * 같은 상대값을 받았다(칸 x + 9 · 값 x + 39 · 줄 y + 9 / + 27 / … · 도형 가운데 (x + w/2, y + h/2 − 16 · − 6)).
 */
export interface DetailWindowOrigin {
  /** '0' 키가 세운 첫 x */
  readonly startX: number
  readonly y: number
}

/** 교체 창 '0' 0x49712 — (W/2 + 0x52, H/2 − 0x65) */
export const SUBSTITUTION_DETAIL_ORIGIN: DetailWindowOrigin = { startX: 202, y: 59 }

/** 엔트리 목록 창 '0' 0x55920 — (W/2 + 0x5c, H/2 − 0x60) */
export const ENTRY_DETAIL_ORIGIN: DetailWindowOrigin = { startX: 212, y: 64 }

export const DETAIL_WINDOW = { startWidth: 7, finalWidth: 106, height: 203, finalDx: -0x60 } as const

export interface DetailWindowFrame {
  readonly x: number
  readonly width: number
  readonly isOpen: boolean
}

/** 연 뒤 `draw` 번째(0 부터) 그림의 창 (0x5c8aa) */
export function detailWindowFrameAt(draw: number, origin: DetailWindowOrigin = SUBSTITUTION_DETAIL_ORIGIN): DetailWindowFrame {
  let x: number = origin.startX
  let width: number = DETAIL_WINDOW.startWidth
  let step = 1
  for (let index = 0; index < draw; index += 1) {
    step *= 2
    x -= step
    width += step
    if (width > 105) return { x: origin.startX + DETAIL_WINDOW.finalDx, width: DETAIL_WINDOW.finalWidth, isOpen: true }
  }
  return { x, width, isOpen: false }
}

/**
 * 창 틀 0x5476c → 0x5461c(skin, x, y, w, h) — 둥근 칠(x, y, w, h, 1, #081C4A) · 둥근 테두리(x+1, y+1, w−2, h−2, #335FCD) ·
 * 점 넷(x+2 · x+w−2, y+2 · y+h−2, #335FCD) · 둥근 칠(x+2, y+2, w−4, h−4, #FFFFFF) · 둥근 칠(x+4, y+4, w−8, h−8, #335FCD).
 * 안쪽은 0xbae25(x + 5, y + 5, w − 10, h − 10) 로 자른다.
 */
export const DETAIL_COLORS = { outer: '#081C4A', edge: '#335FCD', white: '#FFFFFF' } as const

/** 둥근 테두리 0x6aa64(둥글기 ≤ 3) — 선 넷 (`commonPanel` 의 roundEdge 와 같은 식) */
export function roundEdgeRectsOf(x: number, y: number, w: number, h: number): { x: number; y: number; width: number; height: number }[] {
  return [
    { x: x + 1, y, width: w - 1, height: 1 },
    { x: x + 1, y: y + h, width: w - 1, height: 1 },
    { x, y: y + 1, width: 1, height: h - 1 },
    { x: x + w, y: y + 1, width: 1, height: h - 1 },
  ]
}
