import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import {
  BALL_PATTERN_COLUMNS, BALL_PATTERN_PERIOD, BALL_PATTERN_ROWS, MAIN_TITLE_BACKDROP, ballPatternCounterAfter, ballPatternRect565,
  ballPatternTilesOf, blurScreen565, mainTitleLineYs, nextBallPatternCounter, rgbOf565, rgbTo565, whitenStep3Of565,
} from '@/pages/special/lib/skinBackdrops'
import { GPOINT_ANIMATION } from '@/pages/special/ui/SkinBackdrops'
import { grayPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import type { Sprite565 } from '@/shared/lib/pixelEffect/screenCompose'

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

describe('B-91 고친 길 — 흐리기는 사본에서 읽고, 공 무늬 왼쪽 · 위 가장자리를 채운다', () => {
  afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

  it('흐리기 — 왼쪽 이웃이 이미 흐린 값이 아니라 처음 값이다', () => {
    const white = rgbTo565(255, 255, 255)
    const 화면 = () => Uint16Array.from([0, 0, 0, 0, 0, white, 0, 0, 0, 0, 0, 0])
    const 원본 = 화면()
    blurScreen565(원본, 4, 3, 1)
    setBugfixConfigForTests(bugfixConfigWith(['B-91']))
    const 고침 = 화면()
    blurScreen565(고침, 4, 3, 1)
    // (2, 1) 의 왼쪽 이웃 (1, 1) 은 흰색 — 원본은 흐린 뒤 검정이 된 (1, 1) 을 읽는다
    expect(원본[6]).toBe(0)
    expect(rgbOf565(고침[6])[0]).toBeGreaterThan(0)
  })

  it('공 무늬 — 화면에 걸치는 공이 끝없는 무늬와 같다 (원본은 c = 31 … 38 에서 왼쪽 · 위 줄이 빈다)', () => {
    const key = (tile: { readonly x: number; readonly y: number }) => `${tile.x},${tile.y}`
    const 보이나 = (tile: { readonly x: number; readonly y: number }) => tile.x + 23 > 0 && tile.x < 240 && tile.y + 23 > 0 && tile.y < 320
    /** 시작 2(c − 23) 에서 사방으로 끝없이 깐 무늬 가운데 화면에 걸치는 것 */
    const 끝없는 = (counter: number) => {
      const start = 2 * (counter - 23)
      const tiles: string[] = []
      for (let row = -4; row < 20; row += 1) {
        for (let column = -4; column < 20; column += 1) {
          const tile = { x: start + 38 * column - (Math.abs(row) % 2 === 1 ? 19 : 0), y: start + 38 * row }
          if (보이나(tile)) tiles.push(key(tile))
        }
      }
      return tiles.sort()
    }
    const 그린 = (counter: number) => ballPatternTilesOf(counter).filter(보이나).map(key).sort()
    const 모든c = Array.from({ length: BALL_PATTERN_PERIOD }, (_, index) => index + 1)
    expect(모든c.filter((counter) => 그린(counter).join() !== 끝없는(counter).join())).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
    setBugfixConfigForTests(bugfixConfigWith(['B-91']))
    expect(모든c.filter((counter) => 그린(counter).join() !== 끝없는(counter).join())).toEqual([])
  })
})

describe('공 무늬 사각형 다시 그리기 (Q-03 r301 — 카드 로고 아래)', () => {
  // 23×23 칸 — 왼쪽 위 한 칸만 불투명
  const tile: Sprite565 = {
    width: 23, height: 23, pixels: new Uint16Array(23 * 23).fill(0x1234), opaque: new Uint8Array(23 * 23).map((_, index) => (index === 0 ? 1 : 0)),
  }
  const backdrop = rgbTo565(147, 199, 229)

  it('바탕 색 위에 칸마다 gpoint 그림 — 칸 자리는 `ballPatternTilesOf` 그대로', () => {
    const counter = 7
    const first = ballPatternTilesOf(counter).find((at) => at.x >= 0 && at.y >= 0 && at.x < 200 && at.y < 200)!
    const rect = { x: first.x - 1, y: first.y, width: 3, height: 1 }
    expect(Array.from(ballPatternRect565(rect, counter, tile))).toEqual([backdrop, 0x1234, backdrop])
  })

  it('흑백 사각형 안은 회색 식', () => {
    const rect = { x: 0, y: 0, width: 2, height: 1 }
    const out = ballPatternRect565(rect, 1, { ...tile, opaque: new Uint8Array(23 * 23) }, [{ x: 1, y: 0, width: 5, height: 5 }])
    expect(Array.from(out)).toEqual([backdrop, grayPixel565(backdrop)])
  })
})

