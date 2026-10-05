import { describe, expect, it } from 'vitest'
import { outingBlockReasonOf, outingBlockTextOf, runOuting } from '@/entities/career/model/outing'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 투수편(모드 3) 외출 — 원본은 타자편과 같은 상태 112·113·126 · 같은 코드(가드 0x16cf0 · 효과 0x15234 ·
 * 입원 회복 0x1575c)를 돈다. 그래서 같은 난수면 같은 칸이 같은 값만큼 움직여야 한다.
 */

const 최소 = { next: () => 0, nextInRange: (minimum: number) => minimum, pick: <T,>(candidates: readonly T[]) => candidates[0] }

function 기능(name: string) {
  const found = OUTING_PLACES.flatMap((place) => place.functions).find((f) => f.name === name)
  if (found === undefined) throw new Error(name)
  return found
}

function 투수(overrides: Partial<PitcherCareer> = {}): PitcherCareer {
  return { ...createPitcherCareer('투수'), morale: 50, money: 10_000, popularity: 1000, ...overrides }
}

describe('투수편 외출 (모드 3 — 타자편과 같은 코드)', () => {
  it('같은 시드면 타자와 같은 칸이 같은 값만큼 움직인다 — 행동·외출 횟수도 쓴다', () => {
    const 공통 = { morale: 50, money: 10_000, popularity: 1000, reputation: 100 }
    for (const name of ['팬미팅', '외식', '야구교실', 'CF촬영']) {
      const pitcher = runOuting(투수(공통), 기능(name), createSeededRandom(7))
      const batter = runOuting({ ...createCareer('타자'), ...공통 }, 기능(name), createSeededRandom(7))
      expect([pitcher.popularity, pitcher.reputation, pitcher.morale, pitcher.money]).toEqual([
        batter.popularity,
        batter.reputation,
        batter.morale,
        batter.money,
      ])
      expect(pitcher.hasActedThisCycle).toBe(true)
      expect(pitcher.outingsThisSeason).toBe(1)
    }
  })

  it('서브 아이템 5~9 보정이 투수에게도 먹는다 (기록[0x5d+장소], 점프표 0xcc6c4)', () => {
    const 없음 = 투수()
    const 전부 = 투수({ subItemIds: [5, 6, 7, 8, 9] })

    expect(runOuting(전부, 기능('팬미팅'), 최소).popularity - runOuting(없음, 기능('팬미팅'), 최소).popularity).toBe(2)
    expect(runOuting(전부, 기능('외식'), 최소).morale - runOuting(없음, 기능('외식'), 최소).morale).toBe(4)
    expect(runOuting(전부, 기능('CF촬영'), 최소).money - runOuting(없음, 기능('CF촬영'), 최소).money).toBe(400)
    const 학교 = runOuting(전부, 기능('야구교실'), 최소)
    const 학교없음 = runOuting(없음, 기능('야구교실'), 최소)
    expect([학교.popularity - 학교없음.popularity, 학교.reputation - 학교없음.reputation]).toEqual([1, 1])
    // 보험증서 — 입원 소지금 0, 사기 +1
    const 환자 = { isSick: true, illnessName: '감기', illnessRemaining: 3 }
    const 입원 = runOuting(투수({ ...환자, subItemIds: [7] }), 기능('입원'), 최소)
    const 입원없음 = runOuting(투수(환자), 기능('입원'), 최소)
    expect(입원.money).toBe(10_000)
    expect(입원.morale - 입원없음.morale).toBe(1)
  })

  it('입원은 질병을 90% 로 고친다 (0x1575c) — 투수 병 칸도 같은 자리', () => {
    const 나음 = runOuting(투수({ isSick: true, illnessName: '감기', illnessRemaining: 3 }), 기능('입원'), 최소)
    expect(나음.isSick).toBe(false)
  })

  it('가드 순서·알림은 원본 0x16cf0 그대로 — 인기도 [62] → 소지금 [77] → 건강 [196] → 사기 [91]', () => {
    expect(outingBlockReasonOf(투수({ popularity: 599 }), 기능('팬미팅'))).toBe('인기도부족')
    expect(outingBlockTextOf('인기도부족', 기능('팬미팅'))).toBe('인기도가 부족합니다. 필요한 인기도 : 600')
    expect(outingBlockReasonOf(투수({ money: 0 }), 기능('외식'))).toBe('소지금부족')
    expect(outingBlockReasonOf(투수(), 기능('입원'))).toBe('건강함')
    expect(outingBlockReasonOf(투수({ morale: 100 }), 기능('외식'))).toBe('사기최고')
    expect(outingBlockReasonOf(투수({ hasActedThisCycle: true }), 기능('외식'))).toBe('이미행동함')
  })
})
