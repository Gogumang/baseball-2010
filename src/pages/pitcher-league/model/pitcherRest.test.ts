import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  pitcherRestBlockReasonOf,
  recoverAfterPitcherRest,
  runPitcherRest,
} from '@/pages/pitcher-league/model/pitcherRest'

/**
 * 투수편 [휴식] — 사기 10~15 (0x18e3c) + 결과 창을 닫을 때 회복 판정 (0x1b308).
 * 원본이 모드 3·4 를 한 코드로 돌리므로 값은 타자편 `outing.test.ts` 와 같아야 한다 (G 2절).
 */

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  morale: 50,
  ...overrides,
})

const 최소 = { next: () => 0, nextInRange: (minimum: number) => minimum, pick: <T,>(c: readonly T[]) => c[0] }
const 최대 = { ...최소, next: () => 0.999 }

describe('투수편 휴식 — 사기 회복 (0x18e3c)', () => {
  it('사기가 10~15 오르고 주기 행동 한 칸을 쓴다', () => {
    expect(runPitcherRest(투수({ morale: 30 }), 최소)).toMatchObject({
      moraleGain: 10,
      career: { morale: 40, hasActedThisCycle: true },
    })
    expect(runPitcherRest(투수({ morale: 30 }), 최대).moraleGain).toBe(15)
  })

  it('⚠️ 원본 그대로 — 사기가 최고면 아파도 거절한다 (0x12682, StrMODE[91])', () => {
    expect(pitcherRestBlockReasonOf(투수({ morale: 100, isInjured: true, isSick: true }))).toBe('사기최고')
  })
})

describe('투수편 휴식 회복 판정 (0x1b308) — 질병 60% · 부상 30%', () => {
  it('굴림이 낮으면 둘 다 낫는다', () => {
    const 나음 = recoverAfterPitcherRest(
      투수({ isInjured: true, isSick: true, illnessName: '감기', injuryRemaining: 2, illnessRemaining: 3 }),
      최소,
    )

    expect(나음.career).toMatchObject({ isInjured: false, isSick: false, injuredGamesPlayed: 0 })
    expect(나음.recoveries).toEqual(['다음 질병이 치료되었습니다 [감기]', '부상에서 회복 되었습니다.'])
  })

  it('굴림이 높으면 안 낫고 남은 기간만 하루씩 준다', () => {
    const 그대로 = recoverAfterPitcherRest(
      투수({ isInjured: true, isSick: true, injuryRemaining: 3, illnessRemaining: 3 }),
      최대,
    )

    expect(그대로.career).toMatchObject({
      isInjured: true,
      isSick: true,
      injuryRemaining: 2,
      illnessRemaining: 2,
    })
    expect(그대로.recoveries).toEqual([])
  })

  it('남은 기간이 0 이 되면 굴림과 상관없이 낫는다', () => {
    const 거의 = recoverAfterPitcherRest(
      투수({ isInjured: true, isSick: true, illnessName: '몸살', injuryRemaining: 1, illnessRemaining: 0 }),
      최대,
    )

    expect([거의.career.isInjured, 거의.career.isSick]).toEqual([false, false])
    // 치료된 질병은 이벤트 쿨다운 +0x7c = 20 을 받는다
    expect(거의.career.illnessCooldown).toBe(20)
  })
})
