import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BALL_PATTERN_COLUMNS, BALL_PATTERN_PERIOD, BALL_PATTERN_ROWS, MAIN_TITLE_BACKDROP, ballPatternCounterAfter,
  ballPatternTilesOf, blurScreen565, mainTitleLineYs, nextBallPatternCounter, rgbOf565, rgbTo565, whitenStep3Of565,
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

describe('메뉴 바탕 16비트 연산 — 흐리기 0xbdc2c · 단계 덮기 0x9a628', () => {
  it('565 ↔ 8비트는 비트 복제 — 에셋 값이 그대로 돈다', () => {
    expect(rgbOf565(rgbTo565(82, 4, 99))).toEqual([82, 4, 99])
    expect(rgbTo565(255, 255, 255)).toBe(0xffff)
  })

  it('흐리기 모드 1 — 가운데를 빼고 왼쪽·오른쪽·위·아래 넷의 평균, 제자리라 왼쪽·위는 이미 흐린 값', () => {
    const white = 0xffff
    const black = 0
    // 3×3 에서 가운데 하나만 칠해진다 — 네 이웃이 흰·흰·흰·검정이면 3/4
    const pixels = Uint16Array.from([white, white, white, white, black, black, white, black, black])
    blurScreen565(pixels, 3, 3, 1)
    const r = ((0xf8 * 2) >> 2) >> 3
    expect(pixels[4]).toBe(rgbTo565(((0xf8 * 2) >> 2), ((0xfc * 2) >> 2), ((0xf8 * 2) >> 2)))
    expect((pixels[4] >> 11) & 0x1f).toBe(r)
    // 가장자리는 안쪽 값을 베낀다 — 줄 0 = 줄 1, 칸 0 = 칸 1
    expect(pixels[1]).toBe(pixels[4])
    expect(pixels[3]).toBe(pixels[4])
  })

  it('단계 3 은 색 몫 (3 + 1)/16 — 검정 위 흰색은 칸마다 7/31 · 15/63 (마스크로 낮은 비트를 버린다)', () => {
    const covered = whitenStep3Of565(0, 0xffff)
    expect([(covered >> 11) & 0x1f, (covered >> 5) & 0x3f, covered & 0x1f]).toEqual([7, 15, 7])
    // 흰 위 흰색도 낮은 비트를 버려 29/31 · 61/63 으로 조금 어두워진다 (원본 그대로)
    const white = whitenStep3Of565(0xffff, 0xffff)
    expect([(white >> 11) & 0x1f, (white >> 5) & 0x3f, white & 0x1f]).toEqual([29, 61, 29])
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
