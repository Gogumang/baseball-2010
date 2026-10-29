import { DETAIL_Y_OFFSET, detailMessageBoxOf } from './detailWindow'

/**
 * 글 상자 오른쪽 스크롤 막대 (0x8a182~0x8a2a4, 직접 떴다). 상자 R = 프레임 90 박스 5 의 y −4 (36, 176, 170, 70).
 * ```
 * 막대 바탕   (R.x + R.w − 7, R.y, 7, R.h)  #102152  (0x1400748(0x10, 0x21, 0x52) · 0xb9f75)
 * 줄 수 n = 창+0x37c,  첫 줄 s = 창+0x380
 * n ≤ 3:  흰 (막대x+1, R.y, 5, R.h) · 안 #1D44A8 (막대x+2, R.y+1, 3, R.h−2)        ; 막대 가득
 * n > 3:  길이 L = (4·R.h + n − 1) / n (올림) · 자리 p = s·R.h / n (버림)
 *         흰 (막대x+1, R.y+p, 5, L−1) · 안 #1D44A8 (막대x+2, R.y+p+1, 3, L−3)       ; 0x6a9f1 채우기
 * ```
 * 훈련·휴식·GP 결과 창도 같은 그리기라 늘 그린다.
 */
export const DETAIL_SCROLL_BAR_WIDTH = 7
export const DETAIL_SCROLL_BAR_COLORS = { track: '#102152', thumb: '#FFFFFF', thumbInner: '#1D44A8' } as const
/** 막대가 가득 차는 줄 수 상한 (0x8a1c4 `cmp r7, #3 ; bgt`) */
const DETAIL_SCROLL_FULL_LINES = 3
/** 길이 식의 4 — 보이는 줄 수 (0x8a22a `lsls r0, r6, #2`) */
const DETAIL_SCROLL_VISIBLE_LINES = 4

export interface ScrollBarRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DetailScrollBar {
  readonly track: ScrollBarRect
  readonly thumb: ScrollBarRect
  readonly thumbInner: ScrollBarRect
}

/** 스크롤 막대 세 사각형 — 줄 수 `lineCount`(창+0x37c) · 첫 줄 `scrollOffset`(창+0x380) */
export function detailScrollBarOf(lineCount: number, scrollOffset: number, yOffset: number = DETAIL_Y_OFFSET): DetailScrollBar {
  const box = detailMessageBoxOf(yOffset)
  const x = box.x + box.width - DETAIL_SCROLL_BAR_WIDTH
  const track = { x, y: box.y, width: DETAIL_SCROLL_BAR_WIDTH, height: box.height }
  if (lineCount <= DETAIL_SCROLL_FULL_LINES) {
    return {
      track,
      thumb: { x: x + 1, y: box.y, width: DETAIL_SCROLL_BAR_WIDTH - 2, height: box.height },
      thumbInner: { x: x + 2, y: box.y + 1, width: DETAIL_SCROLL_BAR_WIDTH - 4, height: box.height - 2 },
    }
  }
  const length = Math.trunc((DETAIL_SCROLL_VISIBLE_LINES * box.height + lineCount - 1) / lineCount)
  const position = Math.trunc((scrollOffset * box.height) / lineCount)
  return {
    track,
    thumb: { x: x + 1, y: box.y + position, width: DETAIL_SCROLL_BAR_WIDTH - 2, height: length - 1 },
    thumbInner: { x: x + 2, y: box.y + position + 1, width: DETAIL_SCROLL_BAR_WIDTH - 4, height: length - 3 },
  }
}
