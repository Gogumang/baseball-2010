import { useLayoutEffect } from 'react'

/** 앱이 그리는 뿌리 — 모든 화면 · 덮개가 이 안에 있다 (`app/main.tsx`) */
const ROOT_ID = 'root'
/** 원작 240×320 화면 버퍼 자리 (`RawScreen` 의 판) */
const SCREEN_SELECTOR = '[data-original-screen]'
const SCREEN_WIDTH = 240

/**
 * **그린 화면 통째로 옮기기** 0xba888(화면, dx, dy) — 화면 버퍼의 픽셀을 (dx, dy) 만큼 옮기고(0xb95b0) 비운 줄 · 칸을 0(검정)으로
 * 채운다(0x1400428). 장면 그리기 끝(창 0x746cd · 효과기 0xbd844 순서)에서 부르므로 그 틀에 그린 것 **모두**가 옮겨진다.
 * 버퍼는 240×320 이라 밖으로 나간 픽셀은 버려진다.
 *
 * 웹은 `#root` 를 원작 픽셀 × 배율만큼 옮기고, 옮기기 전 화면 판(`RawScreen`) 자리로 잘라 낸다(clip-path — 옮긴 뒤 좌표계라
 * 오프셋만큼 거꾸로 민다). 잘려 나간 바깥에는 옮기기 전 화면 판 바깥 틀 자리에 검정 받침을 깔아 흔들지 않을 때와 같게 둔다.
 * 비운 줄 · 칸은 판 바깥 틀의 검정이 들어와 원본처럼 검정이다.
 * `offset` 이 null 이거나 (0, 0) 이면 되돌린다. 뿌리가 없으면(시험) 아무 일도 안 한다. 화면 판이 없으면 옮기기만 한다.
 */
export function useWholeScreenOffset(offset: { readonly x: number; readonly y: number } | null): void {
  const x = offset?.x ?? 0
  const y = offset?.y ?? 0
  useLayoutEffect(() => {
    const root = document.getElementById(ROOT_ID)
    if (root === null || (x === 0 && y === 0)) return undefined
    const screen = root.querySelector<HTMLElement>(SCREEN_SELECTOR)
    // 옮기기 전에 잰다 — 앞 효과의 정리가 이미 되돌려 두었다
    const rootBox = root.getBoundingClientRect()
    const screenBox = screen?.getBoundingClientRect() ?? null
    const frameBox = screen?.parentElement?.getBoundingClientRect() ?? null
    const previous = { transform: root.style.transform, clipPath: root.style.clipPath }
    root.style.transform = `translate(calc(${x}px * var(--zoom, 1)), calc(${y}px * var(--zoom, 1)))`

    let backing: HTMLDivElement | null = null
    if (screenBox !== null && screenBox.width > 0) {
      const scale = screenBox.width / SCREEN_WIDTH
      const dx = x * scale
      const dy = y * scale
      const top = screenBox.top - rootBox.top - dy
      const left = screenBox.left - rootBox.left - dx
      const right = rootBox.right - screenBox.right + dx
      const bottom = rootBox.bottom - screenBox.bottom + dy
      root.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`
      if (frameBox !== null) {
        backing = document.createElement('div')
        backing.dataset.screenShakeBacking = ''
        Object.assign(backing.style, {
          position: 'fixed',
          left: `${frameBox.left}px`,
          top: `${frameBox.top}px`,
          width: `${frameBox.width}px`,
          height: `${frameBox.height}px`,
          background: '#000000',
          zIndex: '-1',
          pointerEvents: 'none',
        })
        document.body.appendChild(backing)
      }
    }
    return () => {
      root.style.transform = previous.transform
      root.style.clipPath = previous.clipPath
      backing?.remove()
    }
  }, [x, y])
}
