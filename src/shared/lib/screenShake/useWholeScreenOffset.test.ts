// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWholeScreenOffset } from '@/shared/lib/screenShake/useWholeScreenOffset'

const boxOf = (left: number, top: number, width: number, height: number) => () =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect

/** 480×800 창 — 뿌리는 창 전체, 화면 판 바깥 틀은 (120, 0) 240×800, 판은 (120, 240) 240×320 (배율 1) */
function mountRoot() {
  const root = document.createElement('div')
  root.id = 'root'
  root.getBoundingClientRect = boxOf(0, 0, 480, 800)
  const frame = document.createElement('div')
  frame.getBoundingClientRect = boxOf(120, 0, 240, 800)
  const stage = document.createElement('div')
  stage.dataset.originalScreen = ''
  stage.getBoundingClientRect = boxOf(120, 240, 240, 320)
  frame.appendChild(stage)
  root.appendChild(frame)
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('화면 전체 흔들기 0xba888 — 240×320 버퍼 밖은 잘린다', () => {
  it('뿌리를 옮기고 옮기기 전 판 자리로 자르며, 판 바깥 틀 자리에 검정 받침을 깐다', () => {
    const root = mountRoot()
    const { rerender, unmount } = renderHook(({ offset }) => useWholeScreenOffset(offset), { initialProps: { offset: { x: 3, y: -2 } } })
    expect(root.style.transform).toContain('translate(calc(3px')
    // 옮긴 뒤 좌표계 — 판 (120, 240)~(360, 560) 을 (−3, +2) 만큼 거꾸로
    expect(root.style.clipPath).toBe('inset(242px 123px 238px 117px)')
    const backing = document.querySelector<HTMLElement>('[data-screen-shake-backing]')
    expect(backing?.style.left).toBe('120px')
    expect(backing?.style.height).toBe('800px')

    rerender({ offset: { x: 0, y: 0 } })
    expect(root.style.transform).toBe('')
    expect(root.style.clipPath).toBe('')
    expect(document.querySelector('[data-screen-shake-backing]')).toBeNull()
    unmount()
  })
})
