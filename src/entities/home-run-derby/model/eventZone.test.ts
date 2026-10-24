import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EVENT_ZONE_REWARD, EVENT_ZONE_REWARD_ENTRIES, eventZoneRewardFrameAt, eventZoneRewardXOf } from '@/entities/home-run-derby/model/eventZone'

describe('이벤트 존 보상 "200G" — trainning 애니 3 (0x36dfc 3730e · 37328 → 0x41098)', () => {
  it('칸은 animations.json [3] 그대로 — 프레임 15~24 · 지연 2 × 9 · 7', () => {
    const animations = JSON.parse(readFileSync('public/sprites/trainning/frames/animations.json', 'utf8')) as {
      frame: number
      delay: number
    }[][]
    expect(EVENT_ZONE_REWARD.animation).toBe(3)
    expect(animations[EVENT_ZONE_REWARD.animation]!.map(({ frame, delay }) => ({ frame, delay }))).toEqual(EVENT_ZONE_REWARD_ENTRIES)
  })

  it('21~23 은 0x67 겹(더하기 b = 200)이 든 프레임이다 — layers.json', () => {
    const listing = JSON.parse(readFileSync('public/sprites/trainning/frames/layers.json', 'utf8')) as Record<
      string, { effect: number; argument?: number }[]
    >
    expect(Object.keys(listing).sort()).toEqual(['021', '022', '023'])
    for (const entries of Object.values(listing)) {
      expect(entries.some((entry) => entry.effect === 2 && entry.argument === 200)).toBe(true)
    }
  })

  it('존을 놓은 그림이 첫 칸(빈 15) — 칸마다 지연만큼 그리고 끝 칸(24, 7 그림) 뒤 반복으로 15 로 돈다 (0x93cfd 인자 1)', () => {
    expect(eventZoneRewardFrameAt(0)).toBe(15)
    expect(eventZoneRewardFrameAt(2)).toBe(16)
    expect(eventZoneRewardFrameAt(12)).toBe(21)
    expect(eventZoneRewardFrameAt(17)).toBe(23)
    expect(eventZoneRewardFrameAt(18)).toBe(24)
    expect(eventZoneRewardFrameAt(24)).toBe(24)
    expect(eventZoneRewardFrameAt(25)).toBe(15)
  })

  it('x 는 +0xfcc(= −웹 각) + 0x5a 가 음수면 0x32, 아니면 0x8c · y 는 0x46 (4111c · 41158)', () => {
    expect(eventZoneRewardXOf(45)).toBe(0x8c)
    expect(eventZoneRewardXOf(90)).toBe(0x8c)
    expect(eventZoneRewardXOf(91)).toBe(0x32)
    expect(eventZoneRewardXOf(135)).toBe(0x32)
    expect(EVENT_ZONE_REWARD.y).toBe(0x46)
  })
})
