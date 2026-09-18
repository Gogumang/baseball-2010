import { describe, expect, it } from 'vitest'
import { pitchGradeOf, quickPitchOf, simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 타자: QuickAtBatBatter = { hit: 500, power: 500, run: 500, skillIds: [] }
const 투수: QuickAtBatPitcher = { control: 500, velocity: 500, stamina: 90, skillIds: [] }

/** 뽑힌 값을 차례로 돌려주는 난수. 모자라면 마지막 값을 반복한다 */
function 순서난수(values: readonly number[]): RandomPort & { readonly draws: number[] } {
  const draws: number[] = []
  let index = 0
  return {
    draws,
    next: () => {
      const value = values[Math.min(index, values.length - 1)] ?? 0
      index += 1
      draws.push(value)
      return value
    },
    nextInRange: (minimum, maximum) => minimum + 0.5 * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}
const 고정 = (value: number): RandomPort => 순서난수([value])

describe('pitchGradeOf — 0xb74bc 누적 확률표', () => {
  it('능력 250 마다 줄이 바뀌고, 뽑은 값이 처음 걸리는 칸을 고른다', () => {
    // 줄 0(0~249) 은 5·15·70·97·100 — 만분율로 500·1500·7000·9700·10000
    expect(pitchGradeOf(100, 90, 고정(0.04))).toBe(0)
    expect(pitchGradeOf(100, 90, 고정(0.1))).toBe(1)
    expect(pitchGradeOf(100, 90, 고정(0.5))).toBe(2)
    // 줄 3(750~999) 은 2·5·45·91·100 이라 같은 난수에서 더 높은 칸이 나온다
    expect(pitchGradeOf(800, 90, 고정(0.5))).toBe(3)
  })

  it('지친 투수(스태미나 0)는 한 칸씩 내려가고 0 에서 멈춘다', () => {
    expect(pitchGradeOf(100, 0, 고정(0.04))).toBe(0)
    expect(pitchGradeOf(100, 0, 고정(0.5))).toBe(0)
    expect(pitchGradeOf(100, 0, 고정(0.98))).toBe(2)
  })

  it('능력이 표 밖으로 나가도 마지막 줄로 자른다', () => {
    expect(pitchGradeOf(9999, 90, 고정(0.5))).toBe(pitchGradeOf(999, 90, 고정(0.5)))
  })
})

describe('quickPitchOf — 0xc11f0 투구 한 번', () => {
  it('난수가 모두 0 이면 오차는 −13 으로 뽑힌 뒤 부호 난수 0 에 뒤집혀 +13 이 된다', () => {
    const pitch = quickPitchOf(타자, 투수, { inning: 1 }, 고정(0))

    // 두 판정(30%·15%)은 모두 안에 들지만 양쪽 굴림이 0 으로 같아 보정이 붙지 않는다
    expect(pitch.power).toBe(75)
    expect([pitch.spreadX, pitch.spreadY]).toEqual([13, 13])
  })

  it('부호 난수가 1 이면 뽑힌 −13 이 그대로 남는다', () => {
    // 오차 두 번(0) → 30%판정(0.9 통과) → 15%판정(0.9 통과) → 부호 두 번(0.9)
    const pitch = quickPitchOf(타자, 투수, { inning: 1 }, 순서난수([0, 0, 0.9, 0.9, 0.9]))

    expect([pitch.spreadX, pitch.spreadY]).toEqual([-13, -13])
  })

  it('30% 안에 들고 타자 히트 쪽이 지면 스윙 세기가 0 이 된다 (0xc1584 = 2999)', () => {
    // 뽑는 순서: 오차X · 오차Y · 30%판정 · 투수구속 · 타자히트 · 15%판정 …
    const 약한스윙 = quickPitchOf(타자, 투수, { inning: 1 }, 순서난수([0.5, 0.5, 0.2, 0.9, 0.1, 0.9]))
    expect(약한스윙.power).toBe(0)

    const 정상 = quickPitchOf(타자, 투수, { inning: 1 }, 순서난수([0.5, 0.5, 0.2, 0.1, 0.9, 0.9]))
    expect(정상.power).toBe(75)
  })

  it('15% 안에 들고 타자 파워 쪽이 이기면 코스 오차가 3 씩 좁혀진다 (0xc1590 = 1499)', () => {
    // 30% 판정은 통과시키고(0.9), 15% 판정만 걸리게 한다
    const 좁힘 = quickPitchOf(타자, 투수, { inning: 1 }, 순서난수([0.9, 0.9, 0.9, 0, 0, 0.1, 0.1, 0.9, 0.9, 0.9]))

    // |오차| − 3 을 거친 뒤 부호 난수가 0.9 라 양수로 남는다
    expect(Math.abs(좁힘.spreadX)).toBeLessThan(21)
  })

  it('10회 이후에는 스윙 세기가 이닝마다 5 씩 오르고 100 에서 멈춘다', () => {
    const random = () => 순서난수([0.9, 0.9, 0.9, 0.9])

    expect(quickPitchOf(타자, 투수, { inning: 10 }, random()).power).toBe(80)
    expect(quickPitchOf(타자, 투수, { inning: 14 }, random()).power).toBe(100)
    expect(quickPitchOf(타자, 투수, { inning: 20 }, random()).power).toBe(100)
  })
})

describe('simulateQuickAtBat — 타석 하나', () => {
  it('헛스윙만 나오면 세 번째에 삼진으로 끝난다 — 간이 타석에는 볼넷이 없다', () => {
    // 오차를 크게 뽑아(0.99) contact 를 0 으로 만든다
    expect(simulateQuickAtBat(타자, 투수, { inning: 1 }, 고정(0.99))).toEqual({ kind: '삼진' })
  })

  it('타석은 반드시 끝난다 — 파울만 이어져도 무한 루프에 빠지지 않는다', () => {
    for (const seed of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      expect(simulateQuickAtBat(타자, 투수, { inning: 1 }, 고정(seed))).toHaveProperty('kind')
    }
  })

  it('능력이 높을수록 안타가 늘어난다 — 확률표가 아니라 원본 판정을 쓴다는 증거', () => {
    const 쳐낸비율 = (batter: QuickAtBatBatter) => {
      let seed = 12345
      const random: RandomPort = {
        // 결정론적인 값 뽑기 (선형 합동)
        next: () => {
          seed = (seed * 1103515245 + 12345) % 2147483648
          return seed / 2147483648
        },
        nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
        pick: (candidates) => candidates[0],
      }
      let hits = 0
      for (let index = 0; index < 400; index += 1) {
        const outcome = simulateQuickAtBat(batter, 투수, { inning: 1 }, random)
        if (outcome.kind === '안타' || outcome.kind === '홈런') hits += 1
      }
      return hits / 400
    }

    const 약한타자 = 쳐낸비율({ hit: 100, power: 100, run: 100, skillIds: [] })
    const 강한타자 = 쳐낸비율({ hit: 900, power: 900, run: 900, skillIds: [] })

    expect(강한타자).toBeGreaterThan(약한타자)
  })
})
