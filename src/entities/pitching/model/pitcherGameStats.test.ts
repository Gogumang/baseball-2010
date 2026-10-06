import { describe, expect, it } from 'vitest'
import {
  cpuPitchStatsOf,
  pitcherGameStatOf,
  pitcherGameStatsOf,
} from '@/entities/pitching/model/pitcherGameStats'
import { selectPitch } from '@/entities/pitching/model/selectPitch'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

describe('pitcherGameStatOf — 0xb570c 의 피로(0xb58e6) → 팀·코치 정액 → 0..999 자르기', () => {
  it('체력% 구간 감소 (55 이상 없음 · 35~54 −10% · 20~34 −30% · 1~19 −50% · 0 이하 −90%)', () => {
    expect([90, 55, 54, 35, 34, 20, 19, 1, 0, -3].map((percent) => pitcherGameStatOf(537, percent))).toEqual([
      537, 537, 484, 484, 376, 376, 269, 269, 54, 54,
    ])
  })

  it('정액은 피로 **뒤에** 더한다 — 먼저 더한 값에 피로를 먹이면 다르다', () => {
    // 밑값 500 · 팀 집중 400(+17) · 체력 30% → trunc(500 − 150) + 17 = 367 (먼저 더하면 517 → 362)
    expect(pitcherGameStatOf(500, 30, 17)).toBe(367)
  })

  it('자르기는 맨 끝 한 번 — 냉정으로 넘친 제구 1098 이 체력 40% 면 989 (먼저 자르면 900)', () => {
    expect(pitcherGameStatOf(1098, 40)).toBe(989)
    expect(pitcherGameStatOf(1098, 90)).toBe(999)
    expect(pitcherGameStatOf(-5, 90, -10)).toBe(0)
  })

  it('세 칸을 한꺼번에', () => {
    expect(
      pitcherGameStatsOf(
        { beforeFatigue: { control: 600, velocity: 700, breaking: 800 }, bonusAfterFatigue: { control: 5, velocity: 17, breaking: 17 } },
        19,
      ),
    ).toEqual({ control: 305, velocity: 367, breaking: 417 })
  })
})

describe('cpuPitchStatsOf — selectPitch 가 쓰는 값', () => {
  it('재료가 없으면 옛 경계 그대로 (0~100 칸 × 10, 지치지 않음)', () => {
    expect(cpuPitchStatsOf({ control: 54, velocity: 60 })).toEqual({
      control: 540,
      velocity: 600,
      breaking: 600,
      mistakeVelocity: 600,
      isNotExhausted: true,
    })
  })

  it('원본 재료가 있으면 반올림 없는 값을 쓴다 (537 → 537, 540 아님)', () => {
    const stats = cpuPitchStatsOf({
      control: 54,
      velocity: 60,
      gameAbility: { beforeFatigue: { control: 537, velocity: 602, breaking: 411 } },
    })
    expect(stats).toMatchObject({ control: 537, velocity: 602, breaking: 411, mistakeVelocity: 602, isNotExhausted: true })
  })

  it('실투 판정의 구속은 체력 인자 90 이라 피로가 없다 (0xb570d(…, 90, 1))', () => {
    const stats = cpuPitchStatsOf({
      control: 54,
      velocity: 60,
      gameAbility: { beforeFatigue: { control: 537, velocity: 602, breaking: 411 }, bonusAfterFatigue: { control: 0, velocity: 17, breaking: 17 } },
      staminaPercent: 10,
    })
    expect(stats).toMatchObject({ control: 269, velocity: 318, breaking: 223, mistakeVelocity: 619, isNotExhausted: true })
  })

  it('체력% 0 이면 제구 등급이 지친 갈래로 간다 (0xb74bc 셋째 인자 0)', () => {
    expect(cpuPitchStatsOf({ control: 54, velocity: 60, staminaPercent: 0 }).isNotExhausted).toBe(false)
    expect(cpuPitchStatsOf({ control: 54, velocity: 60, staminaPercent: 1 }).isNotExhausted).toBe(true)
  })
})

describe('selectPitch — 체력%가 제구 등급을 바꾼다 (난수 차례는 같다)', () => {
  const 상황: PitchSituation = { strikes: 0, balls: 0, outs: 0, runnerCount: 0, batterSide: 1, side: 1 }
  const repertoire = { form: 0, pitchMask: 1, magicId: 0 }
  const 투구 = (staminaPercent?: number) => {
    const choice = selectPitch(
      {
        control: 60,
        velocity: 60,
        repertoire,
        // 제구 200 은 체력 0% 의 −90%(20)여도 같은 행(0~249)이다
        gameAbility: { beforeFatigue: { control: 200, velocity: 600, breaking: 600 } },
        ...(staminaPercent === undefined ? {} : { staminaPercent }),
      },
      상황,
      createSeededRandom(77),
    )
    if (choice.kind !== '투구') throw new Error('견제')
    return choice.pitch
  }

  it('체력% 를 안 넘기면 90 을 넘긴 것과 같다', () => {
    expect(투구()).toEqual(투구(90))
  })

  it('지친 투수(0%)는 같은 굴림에서 등급이 두 칸 내려간다(바닥 0)', () => {
    const 기운 = 투구(90).controlTier
    const 지침 = 투구(0).controlTier
    expect(지침).toBe(Math.max(0, 기운 - 2))
  })
})
