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
 * ⚠️ 미이식: 머리띠가 다 내려온 뒤에도 격자 열림 애니 0x79fa8(위에서 한 줄씩 가속하며 떨어짐, S9 3-3)가 끝날 때까지 [skin+0xe4] 는 0 이다 —
 * 웹은 격자 열림 애니가 없어 머리띠까지만 막는다.
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
