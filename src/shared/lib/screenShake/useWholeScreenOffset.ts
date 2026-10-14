import { useLayoutEffect } from 'react'

/** 앱이 그리는 뿌리 — 모든 화면 · 덮개가 이 안에 있다 (`app/main.tsx`) */
const ROOT_ID = 'root'

/**
 * **그린 화면 통째로 옮기기** 0xba888(화면, dx, dy) — 화면 버퍼의 픽셀을 (dx, dy) 만큼 옮기고(0xb95b0) 비운 줄 · 칸을 0(검정)으로
 * 채운다(0x1400428). 장면 그리기 끝(창 0x746cd · 효과기 0xbd844 순서)에서 부르므로 그 틀에 그린 것 **모두**가 옮겨진다.
 *
 * 웹은 `#root` 를 원작 픽셀 × 배율(`--zoom`) 만큼 옮긴다 — 화면 판(RawScreen)의 바깥이 검정이라 비운 자리는 검정으로 보인다.
 * ⚠️ 근사: 원본은 240×320 밖으로 나간 픽셀이 잘리지만 웹은 판 밖 검정 여백 위로 몇 px 비친다.
 * `offset` 이 null 이거나 (0, 0) 이면 되돌린다. 뿌리가 없으면(시험) 아무 일도 안 한다.
 */
export function useWholeScreenOffset(offset: { readonly x: number; readonly y: number } | null): void {
  const x = offset?.x ?? 0
  const y = offset?.y ?? 0
  useLayoutEffect(() => {
    const root = document.getElementById(ROOT_ID)
    if (root === null || (x === 0 && y === 0)) return undefined
    const previous = root.style.transform
    root.style.transform = `translate(calc(${x}px * var(--zoom, 1)), calc(${y}px * var(--zoom, 1)))`
    return () => {
      root.style.transform = previous
    }
  }, [x, y])
}
