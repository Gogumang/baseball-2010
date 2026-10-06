// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NationalCupBracket } from '@/pages/national-cup/ui/NationalCupBracket'
import { frameCenterOf, imageCenterOf } from '@/pages/national-cup/lib/nationalCupLayout'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/** 대진판 0x85af4 (나리 134 · 시즌 0xf3) — 직접 떴다 */

afterEach(cleanup)

const 띄우기 = (cup: NationalCup) => render(<NationalCupBracket cup={cup} onConfirm={vi.fn()} />)

const 칸 = (container: HTMLElement) =>
  [...container.querySelectorAll('span[data-team]')].map((node) => Number(node.getAttribute('data-team')))

const 로고 = (name: string) => screen.getByAltText(name)

describe('단계별 그림', () => {
  it('풀리그 1라운드(단계 4) — 위 경기 한국·일본 · 아래 경기 쿠바·미국, 로고는 박스 1~4 가운데', () => {
    const { container } = 띄우기(createNationalCup())
    expect(칸(container)).toEqual([10, 11, 12, 13])
    expect(container.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe('4')
    // 박스 1 (20,75,76,77) · 대한민국 로고 76×76 → (20, 75 + trunc(1/2)) = (20, 75)
    expect(로고('대한민국').style.left).toBe('20px')
    expect(로고('대한민국').style.top).toBe('75px')
    // 박스 4 (146,176,76,77) · 미국 로고 77×76 → d = −1 → 146 + 0 + (−1) = 145
    expect(로고('미국').style.left).toBe('145px')
    expect(로고('미국').style.top).toBe('176px')
  })

  it('풀리그 2라운드(단계 3)는 대진 표 [0,2,1,3] — 한국·쿠바 / 일본·미국', () => {
    const { container } = 띄우기({ ...createNationalCup(), stage: 3 })
    expect(칸(container)).toEqual([10, 12, 11, 13])
  })

  it('결승(단계 1)은 결승 두 팀만', () => {
    const { container } = 띄우기({ ...createNationalCup(), stage: 1, finalists: [10, 13] })
    expect(칸(container)).toEqual([10, 13])
  })

  it('끝(단계 0)은 우승국 하나 — 박스 0 (82,118,76,71)', () => {
    const { container } = 띄우기({ ...createNationalCup(), stage: 0, finalists: [10, 12], champion: 12 })
    expect(칸(container)).toEqual([12])
    expect(로고('쿠바').style.left).toBe('82px')
    expect(로고('쿠바').style.top).toBe('115px')
  })
})

describe('정렬 0x22', () => {
  it('그림(0xb9c5c): 가로는 C 나머지를 더해 양수면 올림 · 세로는 버림', () => {
    expect(imageCenterOf([0, 0, 76, 77], 75, 76)).toEqual({ x: 1, y: 0 })
    expect(imageCenterOf([0, 0, 76, 77], 77, 76)).toEqual({ x: -1, y: 0 })
  })

  it('프레임(0xb9d74): 가로는 산술 밀기(내림) · 세로는 양수면 올림', () => {
    expect(frameCenterOf([0, 0, 74, 18], 43, 10)).toEqual({ x: 15, y: 4 })
    expect(frameCenterOf([0, 0, 74, 17], 20, 10)).toEqual({ x: 27, y: 4 })
  })
})
