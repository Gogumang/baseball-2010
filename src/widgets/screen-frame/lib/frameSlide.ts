/** 머리띠·바닥띠 미끄러짐 (+0x86) — 갱신마다 두 배, 30 에서 멈춘다. 시작값은 미확인이라 1 로 둔다 (추정) */
const FRAME_SLIDE_START = 1
export const FRAME_SLIDE_END = 30

export function frameSlideOf(updates: number): number {
  return Math.min(FRAME_SLIDE_END, FRAME_SLIDE_START * 2 ** updates)
}
