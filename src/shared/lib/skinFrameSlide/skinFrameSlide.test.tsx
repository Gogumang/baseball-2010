// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import {
  FRAME_SLIDE_END,
  drawSkinFrameSlide,
  isSkinFrameSliding,
  resetSkinFrameSlide,
  startSkinFrameSlide,
  stopSkinFrameSlide,
  useSkinFrameSlide,
} from '@/shared/lib/skinFrameSlide/skinFrameSlide'
import { frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'

afterEach(cleanup)

function 머리띠({ tick, starts }: { readonly tick: number; readonly starts: boolean }) {
  return <span data-slide={useSkinFrameSlide(tick, starts)} />
}
const slideOf = (container: HTMLElement) => Number(container.querySelector('span')?.dataset.slide)

describe('머리띠 미끄러짐 [skin+0x84] · [+0x86] — 앱에 하나 (r168)', () => {
  it('0x54d94: 깃발이 서 있으면 두 배 · 끝에 닿으면 30 · 깃발 0, 깃발이 없으면 늘 30', () => {
    resetSkinFrameSlide()
    expect(drawSkinFrameSlide()).toBe(FRAME_SLIDE_END)
    startSkinFrameSlide()
    expect([1, 2, 3, 4, 5].map(() => drawSkinFrameSlide())).toEqual([2, 4, 8, 16, 30])
    expect(isSkinFrameSliding()).toBe(false)
    expect([0, 1, 2, 3, 4].map(frameSlideOf)).toEqual([2, 4, 8, 16, 30])
  })

  it('세우는 화면 → 미끄러지는 도중 세우지 않는 화면으로 가면 남은 걸음을 잇는다', () => {
    resetSkinFrameSlide()
    const 앞 = render(<머리띠 tick={0} starts />)
    expect(slideOf(앞.container)).toBe(2)
    앞.rerender(<머리띠 tick={1} starts />)
    expect(slideOf(앞.container)).toBe(4)
    cleanup()
    const 뒤 = render(<머리띠 tick={0} starts={false} />)
    expect(slideOf(뒤.container)).toBe(8)
    뒤.rerender(<머리띠 tick={2} starts={false} />)
    expect(slideOf(뒤.container)).toBe(30)
    expect(isSkinFrameSliding()).toBe(false)
  })

  it('깃발을 지우는 들어옴(기록연감 0x2407c · 경기 중 0x3c26a · 0x3c3b8) 뒤엔 첫 그림부터 30', () => {
    resetSkinFrameSlide()
    render(<머리띠 tick={0} starts />)
    cleanup()
    stopSkinFrameSlide()
    const 뒤 = render(<머리띠 tick={0} starts={false} />)
    expect(slideOf(뒤.container)).toBe(30)
  })

  it('같은 틱을 다시 그리면 안 옮긴다 · 다 내려온 뒤 세우지 않는 화면은 30', () => {
    resetSkinFrameSlide()
    const 화면 = render(<머리띠 tick={0} starts />)
    화면.rerender(<머리띠 tick={0} starts />)
    expect(slideOf(화면.container)).toBe(2)
    화면.rerender(<머리띠 tick={9} starts />)
    expect(slideOf(화면.container)).toBe(30)
    cleanup()
    expect(slideOf(render(<머리띠 tick={0} starts={false} />).container)).toBe(30)
  })
})
