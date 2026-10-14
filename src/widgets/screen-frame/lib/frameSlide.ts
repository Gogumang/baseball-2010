/** 머리띠·바닥띠 미끄러짐 (+0x86) — 갱신마다 두 배, 30 에서 멈춘다. 시작값은 미확인이라 1 로 둔다 (추정) */
const FRAME_SLIDE_START = 1
export const FRAME_SLIDE_END = 30

export function frameSlideOf(updates: number): number {
  return Math.min(FRAME_SLIDE_END, FRAME_SLIDE_START * 2 ** updates)
}

/**
 * 이번 그림 앞에 머리띠 미끄러짐 깃발 [skin+0x84] 가 이미 지워졌나.
 * 0x54d95 는 그릴 때마다 +0x86 을 두 배로 하고(0x54e00~0x54e08) 끝(30)에 닿는 그림에서 +0x84 를 지운다(0x54e16).
 * 머리띠는 화면 그림의 **마지막**이라(예: 환경설정 0x2dc90 = 배경 0x58371 → 페이지 0x593c9 → 머리띠 0x54d95) 그 그림의
 * 페이지는 아직 깃발을 본다 — 깃발이 지워진 것을 보는 것은 **다음 그림**부터다. 웹 `frameSlideOf(n)` 을 n 째 그림의 머리띠 자리로 보면
 * n 째 그림 앞의 깃발은 n − 1 째 그림이 끝(30)에 닿았는가와 같다. ⚠️ 시작값 1 이 추정이라 그림 수도 그만큼 추정이다.
 */
export const isFrameSlideClearedAt = (updates: number): boolean => updates > 0 && frameSlideOf(updates - 1) >= FRAME_SLIDE_END

/**
 * 머리띠 미끄러짐 깃발 [skin+0x84] 이 그 그리기 **앞에** 서 있는가 — 머리띠 0x54d95 는 화면 그림의 마지막이고 +0x86 을 두 배로 해
 * 끝에 닿는 그리기에서 +0x84 를 지운다(0x54e00~0x54e16). 그래서 끝에 닿는 그리기까지는 서 있고 그다음 그리기부터 내려가 있다.
 * (시작값이 추정이라 몇 그리기인지도 추정이다.)
 */
export function isFrameSlidingAt(updates: number): boolean {
  return updates <= 0 || frameSlideOf(updates - 1) < FRAME_SLIDE_END
}
