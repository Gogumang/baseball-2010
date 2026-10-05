// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { RadarChart } from '@/pages/management/ui/RadarChart'

/**
 * 레이더 숫자 색 — 0x7ba44(0x7c008~0x7c088) 가 기본값 0xb6415(기록,k,0) 과 실효값을 견줘
 * 실효가 낮으면 (0xff,0,0) · 높으면 (0,0xff,0x40) 을 정하고, 0x5a990 이 숫자만 효과 0xb(단색)로 찍는다.
 */
afterEach(cleanup)

const 칠한숫자 = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('div[style*="mask-image"]')].map((element) => ({
    color: element.style.background,
    src: element.style.maskImage,
  }))

describe('기본정보 레이더 숫자 색 (0x7ba44 → 0x5a990)', () => {
  it('실효가 기본보다 낮은 칸은 빨강, 높은 칸은 초록 단색 숫자로 찍고 같은 칸은 색이 없다', () => {
    const { container } = render(
      <RadarChart base={{ hit: 500, power: 500, defense: 500, run: 500 }} shown={{ hit: 300, power: 520, defense: 500, run: 500 }} />,
    )

    const tinted = 칠한숫자(container)
    // 300 · 520 → 세 글자씩
    expect(tinted).toHaveLength(6)
    expect(tinted.slice(0, 3).every(({ color }) => color === 'rgb(255, 0, 0)')).toBe(true)
    expect(tinted.slice(3).every(({ color }) => color === 'rgb(0, 255, 64)')).toBe(true)
    expect(tinted[0].src).toContain('./sprites/num/023.png')
  })
})
