// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { RadarChart } from '@/pages/management/ui/RadarChart'

/**
 * 레이더 숫자 색 — 0x7ba44(0x7c008~0x7c088) 가 기본값 0xb6415(기록,k,0) 과 실효값을 견줘
 * 실효가 낮으면 (0xff,0,0) · 높으면 (0,0xff,0x40) 을 정하고, 0x5a990 이 숫자만 효과 0xb(단색)로 찍는다.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 칠한숫자 = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('div[style*="mask-image"]')].map((element) => ({
    color: element.style.background,
    src: element.style.maskImage,
  }))

describe('기본정보 레이더 숫자 색 (0x7ba44 → 0x5a990)', () => {
  it('실효가 기본보다 낮은 칸은 빨강, 높은 칸은 초록 단색 숫자로 찍고 같은 칸은 색이 없다', () => {
    vi.useFakeTimers()
    const { container } = render(
      <RadarChart base={{ hit: 500, power: 500, defense: 500, run: 500 }} shown={{ hit: 300, power: 520, defense: 500, run: 500 }} />,
    )
    // 첫 그림은 0 에서 한 걸음(48) — 숫자도 자라는 지금값이다. 색은 처음부터 최종값으로 견준 색이다(0x5ad94)
    expect(칠한숫자(container)).toHaveLength(4)
    act(() => {
      // 0 → 520 은 11 걸음 — 넉넉히 넘긴다
      vi.advanceTimersByTime(millisecondsPerFrame() * 15 + 20)
    })

    const tinted = 칠한숫자(container)
    // 300 · 520 → 세 글자씩
    expect(tinted).toHaveLength(6)
    expect(tinted.slice(0, 3).every(({ color }) => color === 'rgb(255, 0, 0)')).toBe(true)
    // 효과 0xb 는 565 로 찍는다 — (0, 0xff, 0x40) → B5 8 → 66
    expect(tinted.slice(3).every(({ color }) => color === 'rgb(0, 255, 66)')).toBe(true)
    expect(tinted[0].src).toContain('./sprites/num/023.png')
  })
})
