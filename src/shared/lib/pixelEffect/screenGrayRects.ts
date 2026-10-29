import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * **0xc37a8 흑백 사각형 알림판** — 0xc37a8(x, y, w, h) 은 이미 그린 화면 사각형을 제자리에서 회색으로 바꾼다(`grayRect565`).
 * DOM 은 화면 픽셀을 못 읽으므로, 사각형을 거는 쪽(커맨드 줄 0x7e418)이 여기에 사각형을 올리고 그 **아래 겹**(공 무늬 바탕 따위)이
 * 자기 회색 사본을 그 사각형으로 잘라 얹는다. 겹은 모두 불투명 복사라 `회색(겹친 결과) = 겹친 결과(겹마다 회색)` 이다.
 */
export interface ScreenGrayRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const owners = new Map<symbol, readonly ScreenGrayRect[]>()
let snapshot: readonly ScreenGrayRect[] = []
const listeners = new Set<() => void>()

function publish(owner: symbol, rects: readonly ScreenGrayRect[] | null): void {
  if (rects === null || rects.length === 0) owners.delete(owner)
  else owners.set(owner, rects)
  snapshot = [...owners.values()].flat()
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const sameRects = (a: readonly ScreenGrayRect[], b: readonly ScreenGrayRect[]) =>
  a.length === b.length &&
  a.every((rect, index) => rect.x === b[index].x && rect.y === b[index].y && rect.width === b[index].width && rect.height === b[index].height)

/** 지금 걸린 흑백 사각형들 — 훅 밖(캔버스 그리기)에서 읽는다 */
export const screenGrayRectsNow = (): readonly ScreenGrayRect[] => snapshot

/** 흑백 사각형이 바뀌면 부른다 — 끊는 함수를 돌려준다 */
export const subscribeScreenGrayRects = subscribe

/** 지금 화면에 걸린 흑백 사각형들 (아래 겹이 읽는다) */
export function useScreenGrayRects(): readonly ScreenGrayRect[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

/** 흑백 사각형을 건다 — 그리는 동안(마운트된 동안)만. 그림 전에(레이아웃 단계) 올려 한 틀 늦지 않게 한다 */
export function usePublishScreenGrayRects(rects: readonly ScreenGrayRect[]): void {
  const [owner] = useState(() => Symbol('흑백'))
  const last = useRef<readonly ScreenGrayRect[]>([])
  useLayoutEffect(() => {
    if (sameRects(last.current, rects)) return
    last.current = rects
    publish(owner, rects)
  })
  useLayoutEffect(
    () => () => {
      last.current = []
      publish(owner, null)
    },
    [owner],
  )
}
