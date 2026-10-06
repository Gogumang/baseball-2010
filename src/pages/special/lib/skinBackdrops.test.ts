import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BALL_PATTERN_COLUMNS, BALL_PATTERN_PERIOD, BALL_PATTERN_ROWS, MAIN_TITLE_BACKDROP, ballPatternCounterAfter,
  ballPatternTilesOf, mainTitleLineYs, nextBallPatternCounter,
} from '@/pages/special/lib/skinBackdrops'
import { GPOINT_ANIMATION } from '@/pages/special/ui/SkinBackdrops'

describe('메뉴 바탕 0x58371', () => {
  it('main_title 프레임 13 · 이미지 7 을 (240 − 40 − 2, 2), 3줄마다 검정 선 107 개', () => {
    expect(MAIN_TITLE_BACKDROP.frame).toBe(13)
    expect([MAIN_TITLE_BACKDROP.badgeX, MAIN_TITLE_BACKDROP.badgeY]).toEqual([198, 2])
    const ys = mainTitleLineYs()
    expect(ys).toHaveLength(107)
    expect(ys.slice(0, 3)).toEqual([0, 3, 6])
    expect(ys[ys.length - 1]).toBe(318)
  })
})

describe('공 무늬 바탕 0x5fd61', () => {
  it('열 = 240/23 + 3 = 13 · 줄 = 320/23 + 2 = 15 · 주기 23 + 15 = 38', () => {
    expect([BALL_PATTERN_COLUMNS, BALL_PATTERN_ROWS, BALL_PATTERN_PERIOD]).toEqual([13, 15, 38])
  })

  it('[skin+0x414] — 0 에서 1 → 38 을 돌고 38 다음은 1', () => {
    expect(nextBallPatternCounter(0)).toBe(1)
    expect(nextBallPatternCounter(37)).toBe(38)
    expect(nextBallPatternCounter(38)).toBe(1)
    expect([0, 1, 38, 39, 76, 77].map(ballPatternCounterAfter)).toEqual([0, 1, 38, 1, 38, 1])
  })

  it('칸 자리 — 시작 2 × (c − 23), 38 간격, 홀수 줄은 19 왼쪽', () => {
    const tiles = ballPatternTilesOf(0)
    expect(tiles).toHaveLength(13 * 15)
    expect(tiles[0]).toEqual({ x: -46, y: -46 })
    expect(tiles[1]).toEqual({ x: -8, y: -46 })
    expect(tiles[13]).toEqual({ x: -65, y: -8 })
    expect(ballPatternTilesOf(38)[0]).toEqual({ x: 30, y: 30 })
  })

  it('gpoint 애니 0 은 에셋 그대로 — 프레임 0~5 · 지연 3', () => {
    const animations = JSON.parse(readFileSync('public/sprites/gpoint/frames/animations.json', 'utf8')) as
      readonly (readonly { frame: number; delay: number }[])[]
    expect(GPOINT_ANIMATION).toEqual(animations[0].map(({ frame, delay }) => ({ frame, delay })))
  })
})
