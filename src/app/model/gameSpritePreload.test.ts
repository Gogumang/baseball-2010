import { describe, expect, it } from 'vitest'
import { castOfAces, castOfCareer, gameSpritePreloadsOf } from '@/app/model/gameSpritePreload'
import { preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'

describe('gameSpritePreload — 경기 진입 때 두 팀 명단으로 고르는 선수 그림', () => {
  it('실린 마선수(우리 · 상대)의 타석 · 수비 그림을 받는다 — 안 실린 마선수(−1)는 빼고', () => {
    const cast = castOfAces({ ours: { batter: 0, pitcher: 0 }, opponent: { batter: 4, pitcher: -1 } })
    expect(cast).toEqual({ aceBatters: [0, 4], acePitchers: [0] })
    const urls = preloadImageUrlsOf(gameSpritePreloadsOf(cast))
    expect(urls).toContain('./sprites/batter_medica/frames/000.png')
    expect(urls).toContain('./sprites/batter_tiger/frames/006.png')
    expect(urls).toContain('./sprites/pitcher_psyker/frames/003.png')
    expect(urls).toContain('./sprites/defender_medica/frames/017.png')
    expect(urls).toContain('./sprites/defender_psyker/frames/000.png')
    expect(urls.some((url) => url.includes('batter_kao'))).toBe(false)
    expect(castOfAces(undefined)).toEqual({})
  })

  it('나리 사람 선수는 몸통 폼과 장비 등급 그림을 받고, 명단을 몰라도 두 몸통 폼은 늘 받는다', () => {
    const cast = castOfCareer({ battingTypeIndex: 1, battingSide: 0, equipmentLevels: { hit: 0, power: 3, run: 0 } as never })
    expect(cast.equippedBatters?.[0]?.bodyType).toBe(1)
    const urls = preloadImageUrlsOf(gameSpritePreloadsOf(cast))
    // 장타형은 겹 프레임이 +14 다 — 대기 첫 칸 0 → 014, 등급 색 줄이 있어 번호 지도도
    expect(urls).toContain('./sprites/item_bat_hand/frames/014.png')
    expect(urls).toContain('./sprites/item_bat_hand/frames/index/014.png')
    expect(urls).toContain('./sprites/batter_balancer/frames/000.png')
    expect(urls).toContain('./sprites/batter_sluger/frames/000.png')
    expect(urls).toContain('./sprites/defender/frames/index/017.png')
  })
})

describe('gameEntryCastPreloadsOf — 경기 첫 그림 몫', () => {
  it('타자 대기 자세 · 투수 선 자세 · 수비 서 있기 · 달리기만 — 스윙 · 포구 칸은 안 받는다', async () => {
    const { gameEntryCastPreloadsOf } = await import('@/app/model/gameSpritePreload')
    const urls = preloadImageUrlsOf(gameEntryCastPreloadsOf())
    expect(urls).toContain('./sprites/batter_balancer/frames/003.png')
    expect(urls).toContain('./sprites/batter_sluger/frames/004.png')
    expect(urls).not.toContain('./sprites/batter_balancer/frames/008.png')
    expect(urls).toContain('./sprites/pitcher/frames/022.png')
    expect(urls).toContain('./sprites/defender/frames/017.png')
    expect(urls).toContain('./sprites/defender/frames/index/028.png')
    expect(urls).not.toContain('./sprites/defender/frames/055.png')
  })
})
