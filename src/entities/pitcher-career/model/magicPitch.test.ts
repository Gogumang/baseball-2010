import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PITCH_RECORDS } from '@/shared/config/original/pitchRecords'
import {
  ACE_MAGIC_PITCH_NAMES,
  MAGIC_PITCH_NAMES,
  MAGIC_PITCH_SLOT,
  MAGIC_PITCH_TRAITS,
  MAGIC_PITCH_TYPE_NUMBER,
  MAGIC_SPEED_RANGES,
  NO_MAGIC_PITCH_CORRECTION,
  SPIRIT_SKILL_BONUS,
  ballMagicNumberAfterPitch,
  canSelectMagicPitch,
  derbyPitchTypeOf,
  magicPitchCorrectionOf,
  magicPitchCountOf,
  magicPitchDisplaySpeedOf,
  magicPitchNameOf,
  magicPitchRecordIndexOf,
  magicSpeedRowOf,
} from '@/entities/pitcher-career/model/magicPitch'

describe('마구는 구질 22 하나다 (0xb6d6a)', () => {
  it("'0' 키 칸에 들어간다", () => {
    expect(MAGIC_PITCH_TYPE_NUMBER).toBe(22)
    expect(MAGIC_PITCH_SLOT).toBe(5)
  })

  it('남은 횟수가 0 이면 고를 수 없다', () => {
    expect(canSelectMagicPitch(1)).toBe(true)
    expect(canSelectMagicPitch(0)).toBe(false)
  })
})

describe('이름 — 번호 4 만 폼으로 셋으로 갈린다', () => {
  it('육성 투수는 여섯 이름을 본다', () => {
    expect(MAGIC_PITCH_NAMES).toHaveLength(6)
    expect([0, 1].map((form) => magicPitchNameOf(4, form))).toEqual(['샤이닝 볼', '샤이닝 볼'])
    expect(magicPitchNameOf(4, 2)).toBe('캐넌 볼')
    expect(magicPitchNameOf(4, 5)).toBe('미라지 볼')
  })

  it('1~3 은 폼과 상관없이 같은 이름이다', () => {
    expect([0, 2, 4].map((form) => magicPitchNameOf(1, form))).toEqual(['파이어 볼', '파이어 볼', '파이어 볼'])
    expect(magicPitchNameOf(2, 0)).toBe('웨이브 볼')
    expect(magicPitchNameOf(3, 0)).toBe('썬더 볼')
  })

  it('마투수 5~9 는 고유기 이름이다', () => {
    expect([5, 6, 7, 8, 9].map((number) => magicPitchNameOf(number, 6))).toEqual([...ACE_MAGIC_PITCH_NAMES])
  })

  it('마구가 없으면 이름도 없다', () => {
    expect(magicPitchNameOf(0, 0)).toBeNull()
  })
})

describe('한 경기 횟수 (표 0xd84ff · 0xd8509)', () => {
  const 육성 = { isAce: false, aceLevel: 0, hasSpiritSkill: false }

  it('육성은 번호별 4·5·6·7 이다', () => {
    expect([1, 2, 3, 4].map((number) => magicPitchCountOf({ ...육성, number }))).toEqual([4, 5, 6, 7])
  })

  it('마구가 없으면 0 이다', () => {
    expect(magicPitchCountOf({ ...육성, number: 0 })).toBe(0)
  })

  it('마투수는 레벨별 3·4·5·6·7 이다', () => {
    const counts = [0, 1, 2, 3, 4].map((aceLevel) =>
      magicPitchCountOf({ number: 5, isAce: true, aceLevel, hasSpiritSkill: false }),
    )
    expect(counts).toEqual([3, 4, 5, 6, 7])
  })

  it('투수 스킬 23 혼신은 +2 다', () => {
    expect(magicPitchCountOf({ ...육성, number: 1, hasSpiritSkill: true })).toBe(4 + SPIRIT_SKILL_BONUS)
  })
})

describe('타격 보정 (0x34d6c)', () => {
  it('육성 마구 1~4 는 구속·제구 +150·180·200·220 이다', () => {
    const bonuses = [1, 2, 3, 4].map(
      (number) => magicPitchCorrectionOf({ number, isAce: false, aceLevel: 0 }).velocityBonus,
    )
    expect(bonuses).toEqual([150, 180, 200, 220])
  })

  it('마투수 Lv0 과 Lv1 은 값이 같다', () => {
    const level0 = magicPitchCorrectionOf({ number: 5, isAce: true, aceLevel: 0 })
    const level1 = magicPitchCorrectionOf({ number: 5, isAce: true, aceLevel: 1 })
    expect(level0).toEqual(level1)
    expect(level0.velocityBonus).toBe(150)
  })

  it('⚠️ 원본 버그 그대로 — B·C 보정이 양수라 타자 쪽을 올린다', () => {
    const correction = magicPitchCorrectionOf({ number: 4, isAce: false, aceLevel: 0 })
    expect(correction.wellHitPercent).toBe(15)
    expect(correction.homeRunPercent).toBe(10)
  })

  it('마구가 없으면 보정도 없다', () => {
    expect(magicPitchCorrectionOf({ number: 0, isAce: false, aceLevel: 0 })).toBe(NO_MAGIC_PITCH_CORRECTION)
  })
})

describe('표시 구속 (표 0xcfda8)', () => {
  it('번호 4 만 폼으로 칸이 9·10 으로 옮겨진다', () => {
    expect(magicSpeedRowOf(4, 0)).toBe(3)
    expect(magicSpeedRowOf(4, 2)).toBe(9)
    expect(magicSpeedRowOf(4, 4)).toBe(10)
    expect(magicSpeedRowOf(1, 4)).toBe(0)
    expect(magicSpeedRowOf(9, 10)).toBe(8)
  })

  it('표 범위 안에서 뽑는다', () => {
    const random = createSeededRandom(31)
    for (let index = 0; index < 50; index += 1) {
      const speed = magicPitchDisplaySpeedOf(4, 0, random)
      expect(speed).toBeGreaterThanOrEqual(165)
      expect(speed).toBeLessThanOrEqual(170)
    }
  })

  it('표는 11칸이고 모두 145~170 km/h 사이다', () => {
    expect(MAGIC_SPEED_RANGES).toHaveLength(11)
    for (const [low, high] of MAGIC_SPEED_RANGES) {
      expect(low).toBeGreaterThanOrEqual(145)
      expect(high).toBeLessThanOrEqual(170)
    }
  })
})

describe('pitch.zt1 구질 22 레코드 고르기 (0x9e944)', () => {
  it('육성은 3(m−1) + 폼/2 다', () => {
    expect(magicPitchRecordIndexOf(1, 0)).toBe(0)
    expect(magicPitchRecordIndexOf(1, 3)).toBe(1)
    expect(magicPitchRecordIndexOf(2, 0)).toBe(3)
    expect(magicPitchRecordIndexOf(4, 4)).toBe(11)
  })

  it('폼 0 과 1(홀수 내림)은 같은 레코드다', () => {
    expect(magicPitchRecordIndexOf(3, 0)).toBe(magicPitchRecordIndexOf(3, 1))
  })

  it('마투수는 m + 7 이다', () => {
    expect([5, 6, 7, 8, 9].map((number) => magicPitchRecordIndexOf(number, 6))).toEqual([12, 13, 14, 15, 16])
  })

  it('모든 레코드 번호가 원본 구질 22 블록(17 레코드) 안이다', () => {
    const block = PITCH_RECORDS[MAGIC_PITCH_TYPE_NUMBER - 1]
    expect(block).toHaveLength(17)
    for (let number = 1; number <= 9; number += 1) {
      for (const form of [0, 2, 4]) {
        const index = magicPitchRecordIndexOf(number, form)
        if (index === null) continue
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(block.length)
      }
    }
  })

  it('마구가 아니면 레코드도 없다', () => {
    expect(magicPitchRecordIndexOf(0, 0)).toBeNull()
  })
})

describe('마구의 나머지 성질', () => {
  it('실투가 없고, 게이지 없이 t=5 이며, 소모는 직구와 같다', () => {
    expect(MAGIC_PITCH_TRAITS).toMatchObject({ neverMistake: true, grade: 5, staminaCost: 9 })
  })

  it('홈런더비는 마투수가 나온 뒤로 늘 마구다', () => {
    expect(derbyPitchTypeOf(0)).toBe(1)
    expect(derbyPitchTypeOf(1)).toBe(MAGIC_PITCH_TYPE_NUMBER)
  })
})

describe('⚠️ 공 객체의 마구 번호는 되돌아가지 않는다 (원본 그대로)', () => {
  it('마구를 던지면 그 번호가 실린다', () => {
    expect(ballMagicNumberAfterPitch(0, MAGIC_PITCH_TYPE_NUMBER, 3, 2)).toBe(3)
  })

  it('그 뒤 직구를 던져도 직전 번호가 남는다', () => {
    expect(ballMagicNumberAfterPitch(3, 1, 3, 2)).toBe(3)
  })

  it('남은 횟수가 0 이면(마지막 한 번) 새로 쓰지 않는다', () => {
    expect(ballMagicNumberAfterPitch(0, MAGIC_PITCH_TYPE_NUMBER, 3, 0)).toBe(0)
  })
})
