import type { BracketBox } from '@/widgets/season/lib/postseasonBracketLayout/bracketBoxes'

/**
 * 대진 선 = mode_ui 프레임 **54~57** 의 박스 목록 그대로(그림 없는 2px 선분). `frame_boxes(mode_ui.pzx)` 로 다시 읽어 맞췄다.
 * 프레임 54 + k 는 팀 칸 k(프레임 53 박스 k) 에서 결승 꼭짓점 (120,87) 까지 가는 길이다 — 합류점 (69,162) → (95,138)
 * → (120,114) → (120,87).
 */
export const LINE_FRAMES: Readonly<Record<54 | 55 | 56 | 57, readonly BracketBox[]>> = {
  54: [
    { x: 44, y: 162, width: 2, height: 32 },
    { x: 46, y: 162, width: 25, height: 2 },
    { x: 69, y: 138, width: 2, height: 24 },
    { x: 71, y: 138, width: 26, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 },
    { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  55: [
    { x: 95, y: 162, width: 2, height: 32 },
    { x: 70, y: 162, width: 25, height: 2 },
    { x: 69, y: 138, width: 2, height: 24 },
    { x: 71, y: 138, width: 26, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 },
    { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  56: [
    { x: 145, y: 138, width: 2, height: 32 },
    { x: 95, y: 138, width: 50, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 },
    { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  57: [
    { x: 196, y: 114, width: 2, height: 31 },
    { x: 120, y: 114, width: 76, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
}

export type LineFrame = keyof typeof LINE_FRAMES

/** 팀 칸 k 의 선 프레임 = 54 + k (0x8540e~0x85474 `adds r1, #0x36`) */
export function lineFrameOfCell(cell: number): LineFrame {
  return (54 + cell) as LineFrame
}

/** 선분 바탕색 #08044A = RGB(8,4,74) (0x85450~0x85456) */
export const LINE_COLOR = '#08044A'

/** 이긴 길은 빨강 RGB(255,0,0) 으로 다시 채운다 (0x85586~0x857f6) */
export const WON_LINE_COLOR = '#FF0000'
