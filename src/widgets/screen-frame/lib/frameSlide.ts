/** 머리띠·바닥띠 미끄러짐 (+0x86) — 갱신마다 두 배, 30 에서 멈춘다. 시작값은 미확인이라 1 로 둔다 (추정) */
const FRAME_SLIDE_START = 1
export const FRAME_SLIDE_END = 30

export function frameSlideOf(updates: number): number {
  return Math.min(FRAME_SLIDE_END, FRAME_SLIDE_START * 2 ** updates)
}

/**
 * 머리띠 미끄러짐 깃발 [skin+0x84] 이 그 그리기 **앞에** 서 있는가 — 머리띠 0x54d95 는 화면 그림의 마지막이고 +0x86 을 두 배로 해
 * 끝에 닿는 그리기에서 +0x84 를 지운다(0x54e00~0x54e16). 그래서 끝에 닿는 그리기까지는 서 있고 그다음 그리기부터 내려가 있다.
 * (시작값이 추정이라 몇 그리기인지도 추정이다.)
 */
export function isFrameSlidingAt(updates: number): boolean {
  return updates <= 0 || frameSlideOf(updates - 1) < FRAME_SLIDE_END
}
