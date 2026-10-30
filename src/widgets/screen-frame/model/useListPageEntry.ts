import { useEffect, useRef } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { gridOpenDrawAt } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenDraw, GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import { FRAME_SLIDE_BODY_FIRST_DRAW } from '@/widgets/screen-frame/lib/frameSlide'

export interface ListPageGrid {
  readonly shape: GridOpenShape
  /** 시작 0x7a005 의 둘째 인자 — 열림 애니를 도나 */
  readonly isAnimated: boolean
}

export interface ListPageEntry {
  /** 본문을 그리나 — 머리띠가 미끄러지는 동안([skin+0x84]) 0x63b14 는 본문 없이 끝난다(0x63be2~0x63bf4) */
  readonly isBodyShown: boolean
  /** 본문 몇째 그림인가 (0 부터, 본문이 없으면 −1) — 격자는 본문 첫 그림([skin+0x80] == 1)에 만든다 */
  readonly bodyDraw: number
  /** 이 그림의 격자 열림 (격자가 없거나 본문이 없으면 null) */
  readonly grid: GridOpenDraw | null
  /** 키 함수가 맨 앞에서 [[0x1552cfc]+0xe4] == 0 을 보고 아무것도 안 하나 — 키 처리기가 누를 때 읽는다 */
  readonly keyLock: { readonly current: boolean }
}

/**
 * **공용 목록 0x63b14 화면의 들어올 때 연출과 키 막음.**
 *
 * 0x63b14 는 틱 0 에 [skin+0xe4] = 0 으로 두고(0x63bc4), [skin+0x84] 가 서 있으면 본문 없이 끝낸다(0x63be2~0x63bf4).
 * 본문 끝에 [skin+0xe4] 를 그 본문의 값으로 고쳐 쓴다 — 격자 k(0·1·9 · 2·10·11 · 6~8)는 0x7a571 이 돌려준 열림 애니의 끝 깃발
 * [격자+9](0x640da · 0x64cdc · 0x65222). 그 화면들의 키 함수는 모두 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다
 * — 메인 메뉴 16 0x29ac8 · 17 0x29a54 · 18 0x29c98 · 19 0x29b38 · 21 0x29df8 · 27 0x2ac00 · 28 0x2af20 · 29 0x2b2e0(하위 0) ·
 * 시즌 0xca 0x8da4 · 0xd7 0xa248 · 0xe2 0xe340 · 0xe4 0x8250 · 나리 101 0x14114 · 145 0x1ca4c (R9 12-2).
 * 갱신이 그리기보다 먼저라 그림 n 을 보고 누른 키는 그림 n 이 남긴 [skin+0xe4] 를 본다.
 *
 * 격자는 본문 첫 그림에 만든다 — 들어옴이 [skin+0x80] = 0 으로 두고 본문이 +1 해 1 일 때 0x79ed5 · 0x7a005 를 부른다
 * (0x64022~0x640a2 · 0x647c0~0x6483c · 0x65130~0x651ea). 시작 둘째 인자(애니)는 k 0·1·9 · 6~8 이 [skin+0xe8](틱 0 에
 * 넷째 인자 ≠ 0 이면 1, 0x63bd4 · 0x63be0), k 2·10·11 은 늘 1 이다(0x64834).
 */
/** 본문 그림 `bodyDraw` 의 격자 열림 — 격자 없는 화면이면 null */
function gridDrawOf(grid: ListPageGrid | null, bodyDraw: number) {
  return grid === null ? null : gridOpenDrawAt(grid.shape, bodyDraw, grid.isAnimated)
}

/** 격자 열림 애니의 끝 깃발 [격자+9] 이 아직 안 섰나 */
const isGridOpening = (gridDraw: ReturnType<typeof gridDrawOf>): boolean => gridDraw !== null && !gridDraw.isDoneAfter

export function useListPageEntry({
  slides = true,
  grid = null,
}: {
  readonly slides?: boolean
  readonly grid?: ListPageGrid | null
} = {}): ListPageEntry {
  const draws = useUpdateCounter()
  const bodyDraw = slides ? draws - FRAME_SLIDE_BODY_FIRST_DRAW : draws
  const isBodyShown = bodyDraw >= 0
  const gridDraw = isBodyShown ? gridDrawOf(grid, bodyDraw) : null
  const locked = !isBodyShown || isGridOpening(gridDraw)
  const keyLock = useRef(locked)
  useEffect(() => {
    keyLock.current = locked
  }, [locked])
  return { isBodyShown, bodyDraw: isBodyShown ? bodyDraw : -1, grid: gridDraw, keyLock }
}

/**
 * 다 내려오고 다 연 뒤의 값 — 시험이 들어올 때 연출을 건너뛰고 볼 때 `useListPageEntry` 대신 쓴다
 * (`vi.mock` 에서 `useListPageEntry: settledListPageEntry`). 깜빡임은 0(켜짐)으로 둔다.
 */
export function settledListPageEntry({ grid = null }: { readonly grid?: ListPageGrid | null } = {}): ListPageEntry {
  const settled = grid === null ? null : gridOpenDrawAt(grid.shape, 0, false)
  return { isBodyShown: true, bodyDraw: 0, grid: settled, keyLock: { current: false } }
}
