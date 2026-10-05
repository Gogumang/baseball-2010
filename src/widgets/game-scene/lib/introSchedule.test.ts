import { describe, expect, it } from 'vitest'
import {
  INTRO_TICKS,
  hasGameIntro,
  introBandAlphaOf,
  introCounterAt,
  introFadeOf,
} from '@/widgets/game-scene/lib/introSchedule'

describe('경기 시작 인트로 (상태 0xc)', () => {
  it('270 → 0 을 5씩 — 54틱이면 끝난다 (0x39e3c)', () => {
    expect(INTRO_TICKS).toBe(54)
    expect(introCounterAt(0)).toBe(270)
    expect(introCounterAt(53)).toBe(5)
    expect(introCounterAt(54)).toBe(0)
    expect(introCounterAt(99)).toBe(0)
  })

  it('카운터 59 이하 마지막 12틱이 네 계단으로 흐려진다', () => {
    expect(introFadeOf(60)).toEqual({ alpha: 255, level: 15 })
    expect(introFadeOf(55)).toEqual({ alpha: 255, level: 15 })
    expect(introFadeOf(45)).toEqual({ alpha: 225, level: 13 })
    expect(introFadeOf(30)).toEqual({ alpha: 195, level: 11 })
    expect(introFadeOf(15)).toEqual({ alpha: 165, level: 9 })
    expect(introFadeOf(0)).toEqual({ alpha: 135, level: 7 })
    expect(introBandAlphaOf({ alpha: 255, level: 15 })).toBe(170)
  })

  it('모드 1·2·3·4 만 인트로가 선다 — 대전(8·9)·홈런더비(7)는 없다 (0x48b20)', () => {
    expect([1, 2, 3, 4].every(hasGameIntro)).toBe(true)
    expect([5, 6, 7, 8, 9].some(hasGameIntro)).toBe(false)
  })
})
