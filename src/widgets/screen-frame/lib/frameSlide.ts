/**
 * 머리띠·바닥띠 미끄러짐 (+0x86) — 0x54d94 가 그릴 때마다 **먼저 두 배로 한 뒤**(0x54dfe~0x54e08) 그 값으로 그리고,
 * 끝값(30) 이상이면 30 · [skin+0x84] = 0 으로 멈춘다(0x54e0a~0x54e16). 시작값은 미끄러짐을 켜는 곳이 모두 +0x86 = 1 로 둔다
 * (메인 메뉴 하위 들어옴 · 0x24804 · 공용 목록 0x63b14 의 63ba0 — P6 1절). 그래서 첫 그림이 2 다: 2 · 4 · 8 · 16 · 30.
 */
const FRAME_SLIDE_START = 1
export const FRAME_SLIDE_END = 30

/** 들어온 뒤 그림 수(첫 그림 0) → 그 그림의 +0x86 */
export function frameSlideOf(updates: number): number {
  return Math.min(FRAME_SLIDE_END, FRAME_SLIDE_START * 2 ** (updates + 1))
}
