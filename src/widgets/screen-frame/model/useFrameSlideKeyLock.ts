import { useEffect, useRef } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { isFrameSlidingAt } from '@/widgets/screen-frame/lib/frameSlide'

/**
 * 공용 목록 0x63b14 화면의 키 막음 — 머리띠가 미끄러지는 동안([skin+0x84]) 키를 안 받는다.
 *
 * 0x63b14 는 틱 0 에 [skin+0xe4] = 0 으로 두고(0x63bc4), [skin+0x84] 가 서 있으면 본문 없이 끝낸다(0x63be2~0x63bf4).
 * 본문에 닿아야 [skin+0xe4] 에 그 본문의 값(격자 0x7a571 → 열림 애니 0x79fa8 의 끝 [격자+9] · k 3 · k 4 값 줄 0x5dcc0)을 담는다
 * (0x640da · 0x647ac · 0x64cdc · 0x6507a · 0x65222). 그 화면들의 키 함수는 모두 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면
 * 아무것도 안 한다 — 메인 메뉴 16 0x29ac8 · 17 0x29a54 · 18 0x29c98 · 19 0x29b38 · 20 0x2896c · 21 0x29df8 · 22 0x311a8 ·
 * 27 0x2ac00 · 28 0x2af20 · 29 0x2b2e0, 시즌 0xca 0x8da4 · 0xd7 0xa248 · 0xdd 0x83cc · 0xe2 0xe340 · 0xe4 0x8250,
 * 나리 101 0x14114 · 142 0x13c30 · 145 0x1ca4c.
 * 키(갱신)는 그리기보다 먼저라 그림 n 을 보고 누른 키는 그림 n 앞의 깃발을 본다 — `isFrameSlidingAt(n)` 이면 버린다.
 * 격자를 그리는 k(0·1·9 · 2·10·11 · 6~8)는 격자 열림 애니 0x79fa8 이 끝날 때까지도 0 이라 `useListPageEntry` 를 쓴다.
 * 이 훅은 격자가 없는 선공/구장(k 3)만 쓴다. k 3 이 [skin+0xe4] 에 담는 r5 는 **늘 1** 이다 — 본문 끝 구장 이름 그림 앞
 * 0x6476c `movs r5, #1` 뒤 0x647ae `strb r5, [skin+0xe4]` 까지 r5 를 고치는 곳이 없다(사이의 0xba759 는 0xca9fc 다리로 불려
 * r5 를 지킨다). 그래서 k 3 은 본문을 처음 그린 그림부터 키를 받는다 — 머리띠가 미끄러지는 동안만 막는 것이 원본과 같다.
 */
export function useFrameSlideKeyLock(slides = true): { readonly current: boolean } {
  const updates = useUpdateCounter()
  const locked = slides && isFrameSlidingAt(updates)
  const isLocked = useRef(locked)
  useEffect(() => {
    isLocked.current = locked
  }, [locked])
  return isLocked
}
