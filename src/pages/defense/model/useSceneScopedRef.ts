import { useState, type MutableRefObject } from 'react'

/**
 * **경기 장면 0x104 의 수명으로 드는 칸** — 장면 +0x1961~(HOMERUN 글자 칸) · +0xfdc(번트 종류) · 경기 상태 +0x36(표시 비거리) 처럼
 * 원본이 장면을 새로 만들 때(경기 · 미션 · 다시하기마다 0x327b8 → 장면 0x104 새로 만들기, 경기 상태는 셋업의 0xb6814) 0 이 되고
 * 그 장면이 사는 동안(판 · 타석 · 이닝을 건너) 남는 값.
 *
 * 웹 화면은 경기 하나보다 길게 살거나(미션 라우트는 목록 · 설명 · 진행을 다 그린다) 경기 도중에도 다시 그려지므로 마운트 수명으로는
 * 장면 수명이 안 맞는다. 부르는 쪽이 **장면 하나를 가리키는 값**(`sceneKey` — 그 경기를 세울 때 새로 만든 객체)을 넘기면, 그 값이
 * 바뀔 때 `initial` 로 되돌린다.
 */
export function useSceneScopedRef<T>(initial: T, sceneKey: unknown): MutableRefObject<T> {
  const [scope] = useState(() => createSceneScope(initial, sceneKey))
  return scope.refFor(initial, sceneKey)
}

/**
 * 장면 칸 하나 — 칸 객체는 늘 같고, 장면 열쇠가 바뀐 렌더에서 그 자리를 `initial` 로 되돌린다(같은 칸을 쥔 곳도 되돌린 값을 본다).
 * 렌더 중에 고치는 것은 예전 그대로다 — 장면을 새로 만든 그림부터 0 이다
 */
function createSceneScope<T>(initial: T, sceneKey: unknown) {
  const ref: MutableRefObject<T> = { current: initial }
  let key = sceneKey
  return {
    refFor(next: T, nextKey: unknown): MutableRefObject<T> {
      if (key !== nextKey) {
        key = nextKey
        ref.current = next
      }
      return ref
    },
  }
}
