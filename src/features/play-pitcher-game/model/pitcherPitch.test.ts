import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { MAGIC_PITCH_SLOT, MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import {
  COURSE_GRID,
  GAUGE_CELL_COUNT,
  PITCH_SLOT_COUNT,
  buildHumanPitch,
  canSelectSlot,
  courseTargetOf,
  drainStamina,
  fatiguedStatsOf,
  pitchGradeOf,
  pitchSlotsOf,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitcherRepertoire, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'

const 씨앗 = (seed: number) => createSeededRandom(seed)
/** 난수를 안 쓰는 갈래를 볼 때 쓰는 고정 난수 */
const 고정: RandomPort = { next: () => 0, nextInRange: (minimum) => minimum, pick: (c) => c[0] }

/** 직구 + 기본 변화구 몇 개 + 마구 1(파이어 볼) */
const 레퍼토리: PitcherRepertoire = { pitchMask: 0b101_0111, form: 0, magicNumber: 1 }
const 능력: PitcherStats = { control: 500, velocity: 500, breaking: 500, stamina: 400 }

describe('구질 칸 (0xb6d2c)', () => {
  it('칸은 여섯이고 마구는 칸 5 에만 들어간다', () => {
    const 칸 = pitchSlotsOf(레퍼토리)

    expect(칸).toHaveLength(PITCH_SLOT_COUNT)
    expect(칸[MAGIC_PITCH_SLOT].typeNumber).toBe(MAGIC_PITCH_TYPE_NUMBER)
    expect(칸[MAGIC_PITCH_SLOT].name).toBe('파이어 볼')
  })

  it('마구 번호가 0 이면 칸 5 가 비어 고를 수 없다', () => {
    const 칸 = pitchSlotsOf({ ...레퍼토리, magicNumber: 0 })

    expect(칸[MAGIC_PITCH_SLOT].typeNumber).toBe(0)
    expect(canSelectSlot(칸[MAGIC_PITCH_SLOT], 5)).toBe(false)
  })

  it('남은 마구 횟수가 0 이면 마구 칸이 막힌다 (0x50db8)', () => {
    const 칸 = pitchSlotsOf(레퍼토리)

    expect(canSelectSlot(칸[MAGIC_PITCH_SLOT], 1)).toBe(true)
    expect(canSelectSlot(칸[MAGIC_PITCH_SLOT], 0)).toBe(false)
  })
})

describe('투구 등급 t (0x50e08 · 0x4dbac)', () => {
  const 바탕 = { gaugeSettingOn: true, typeNumber: 1, effectiveControl: 500, staminaPercent: 100 }

  it('게이지를 켜면 누른 칸 g → max(g − 4, 1) 이고 안 누르면 0 이다', () => {
    const 등급 = [0, 1, 5, 6, 7, 8, 9].map((cell) =>
      pitchGradeOf({ ...바탕, gaugeCell: cell }, 고정),
    )

    expect(등급).toEqual([0, 1, 1, 2, 3, 4, 5])
  })

  it('칸은 0~9 열 개다', () => {
    expect(GAUGE_CELL_COUNT).toBe(10)
  })

  it('마구는 게이지를 쓰지 않고 늘 5 다 (0x4dbae)', () => {
    const 등급 = pitchGradeOf(
      { ...바탕, typeNumber: MAGIC_PITCH_TYPE_NUMBER, gaugeCell: 0 },
      고정,
    )

    expect(등급).toBe(5)
  })

  it('게이지를 끄면 제구·체력 확률표로 뽑는다 — 칸을 눌러도 무시된다', () => {
    const 등급 = pitchGradeOf(
      { ...바탕, gaugeSettingOn: false, gaugeCell: 9 },
      씨앗(20100901),
    )

    expect(등급).toBeGreaterThanOrEqual(0)
    expect(등급).toBeLessThanOrEqual(5)
  })
})

describe('스태미나 소모 (0xa5e14 → 0xaeb08)', () => {
  const 바탕 = {
    typeNumber: 1,
    staminaAbility: 400,
    teamMorale: 80,
    isFirstPitcher: true,
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  }

  it('체력 400·사기 80·선발 첫 투수면 직구 한 개에 약 1% 가 깎인다', () => {
    // 용량 X = 400 + 200 + 250 = 850, 직구 소모 9 → 100·9/850 ≈ 1.06%
    const 남은 = drainStamina({ ...바탕, stamina: FULL_STAMINA })

    expect(FULL_STAMINA - 남은).toBeGreaterThan(90)
    expect(FULL_STAMINA - 남은).toBeLessThan(120)
  })

  it('⚠️ 원본 버그 그대로 — 0 인 투수가 한 개 더 던지면 1% 로 되살아난다', () => {
    expect(drainStamina({ ...바탕, stamina: 0 })).toBe(100)
  })

  it('비겁자 + 끈기는 2c − 1 이라 끈기만 있을 때보다 더 깎인다', () => {
    const 보통 = drainStamina({ ...바탕, stamina: FULL_STAMINA })
    const 비겁 = drainStamina({ ...바탕, stamina: FULL_STAMINA, pitcherIsCoward: true })
    const 비겁끈기 = drainStamina({
      ...바탕,
      stamina: FULL_STAMINA,
      pitcherIsCoward: true,
      pitcherEndures: true,
    })

    expect(비겁).toBeLessThan(보통)
    expect(비겁끈기).toBeGreaterThan(비겁)
    expect(비겁끈기).toBeLessThan(보통)
  })

  it('구원은 +200 이 없어 같은 체력이면 더 빨리 지친다', () => {
    const 선발 = drainStamina({ ...바탕, stamina: FULL_STAMINA })
    const 구원 = drainStamina({ ...바탕, stamina: FULL_STAMINA, isFirstPitcher: false })

    expect(구원).toBeLessThan(선발)
  })
})

describe('체력%에 따른 능력치 감소 (0xb58e6)', () => {
  it('체력이 55% 이상이면 깎이지 않고, 0% 면 90% 가 깎인다', () => {
    expect(fatiguedStatsOf(능력, FULL_STAMINA).control).toBe(500)
    expect(fatiguedStatsOf(능력, 0).control).toBe(50)
  })

  it('체력 칸(능력치 3)은 감소 대상이 아니다 — 용량 계산의 바탕이라 그대로 둔다', () => {
    expect(fatiguedStatsOf(능력, 0).stamina).toBe(400)
  })

  it('0..999 자르기는 피로 뒤다 — 999 를 넘은 제구(냉정 22)가 먼저 깎인다 (0xb5b06)', () => {
    const 넘침 = { ...능력, control: 1098 }

    expect(fatiguedStatsOf(넘침, FULL_STAMINA).control).toBe(999)
    // 체력 40%: 1098 − trunc(1098/10) = 989 (먼저 잘랐다면 900)
    expect(fatiguedStatsOf(넘침, 4000).control).toBe(989)
  })
})

describe('코스 칸', () => {
  it('3×3 이고 가운데 칸(4)은 존 중심이다', () => {
    expect(COURSE_GRID).toBe(3)
    const 가운데 = courseTargetOf(4, 0)
    const 왼위 = courseTargetOf(0, 0)

    expect(왼위.x).toBeLessThan(가운데.x)
    expect(왼위.y).toBeGreaterThan(가운데.y)
  })
})

describe('사람 투구 만들기', () => {
  it('원본 pitch.zt1 궤적을 그대로 쓴다 — 월드 경로가 나오고 등급이 실린다', () => {
    const 공 = buildHumanPitch(
      {
        typeNumber: 1,
        courseCell: 4,
        grade: 5,
        gaugeCell: 9,
        stats: 능력,
        repertoire: 레퍼토리,
        side: 1,
      },
      씨앗(11),
    )

    expect(공.type).toBe('FASTBALL')
    expect(공.controlTier).toBe(5)
    expect(공.worldPath?.length).toBe(공.frameCount)
    expect(공.frameCount).toBeGreaterThan(0)
  })

  it('마구는 이름이 마구 이름이고 궤적 레코드도 따로 고른다', () => {
    const 공 = buildHumanPitch(
      {
        typeNumber: MAGIC_PITCH_TYPE_NUMBER,
        courseCell: 4,
        grade: 5,
        gaugeCell: 9,
        stats: 능력,
        repertoire: 레퍼토리,
        side: 1,
      },
      씨앗(11),
    )

    expect(공.type).toBe('파이어 볼')
    expect(공.breakOffset).toEqual({ x: 0, y: 0 })
    expect((공.worldPath ?? []).length).toBeGreaterThan(0)
  })

  it('등급이 높을수록 노린 칸에서 덜 벗어난다 (표 0xcfd60)', () => {
    const 벗어남 = (grade: number) => {
      let total = 0
      for (let seed = 1; seed <= 60; seed += 1) {
        const 공 = buildHumanPitch(
          {
            typeNumber: 1,
            courseCell: 4,
            grade,
            gaugeCell: grade + 4,
            stats: 능력,
            repertoire: 레퍼토리,
            side: 1,
          },
          씨앗(seed),
        )
        total += Math.abs(공.plate.x) + Math.abs(공.plate.y)
      }
      return total / 60
    }

    expect(벗어남(5)).toBeLessThan(벗어남(0))
  })
})

/**
 * 흩어짐 반지름의 그림 칸 scene+0x17bc (0x4dc78) — 게이지를 안 쓴 공은 0x4dce0 이 t + 3 을 넣고,
 * 게이지로 정한 공은 커서가 멈춘 칸(누른 칸 g)이다. 반지름 = slt_pitch 프레임 min(0x3b + 칸, 0x43) 폭/2.
 */
describe('제구 흩어짐 그림 칸 (0x4dce0)', () => {
  const 던지기 = (overrides: { typeNumber?: number; grade: number; gaugeCell: number }, seed: number) =>
    buildHumanPitch(
      {
        typeNumber: overrides.typeNumber ?? 1,
        courseCell: 4,
        grade: overrides.grade,
        gaugeCell: overrides.gaugeCell,
        stats: 능력,
        repertoire: 레퍼토리,
        side: 1,
      },
      씨앗(seed),
    )
  const 도착 = (공: ReturnType<typeof buildHumanPitch>) => 공.worldPath![공.worldPath!.length - 1]

  it('게이지를 안 쓰면(칸 0) 칸은 t + 3 — 같은 t 를 칸 t + 3 으로 누른 공과 같은 자리다', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      expect(도착(던지기({ grade: 3, gaugeCell: 0 }, seed))).toEqual(도착(던지기({ grade: 3, gaugeCell: 6 }, seed)))
    }
  })

  it('게이지를 안 쓴 t = 3 공은 반지름 10(프레임 0x41)이라 중심에서 30·(10+2) = 360 안이다', () => {
    const 중심x = 20585
    const 중심y = 1202
    for (let seed = 1; seed <= 200; seed += 1) {
      const 점 = 도착(던지기({ grade: 3, gaugeCell: 0 }, seed))
      expect(Math.abs(점.x - 중심x)).toBeLessThanOrEqual(360)
      expect(Math.abs(점.y - 중심y)).toBeLessThanOrEqual(360)
    }
  })

  it('마구는 게이지를 안 쓰는 공(0x3f500)이라 누른 칸과 상관없이 t + 3 = 8 이다', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const 마구 = { typeNumber: MAGIC_PITCH_TYPE_NUMBER, grade: 5 }
      expect(도착(던지기({ ...마구, gaugeCell: 1 }, seed))).toEqual(도착(던지기({ ...마구, gaugeCell: 0 }, seed)))
    }
  })
})

/**
 * 투수 미션 조준 흔들림 (0x39c5c) — 세기는 미션 레코드 바이트 13(`conditionCode`)다.
 * 여기서는 **값이 진짜 전달되는지**만 본다. 흔드는 식 자체는 `entities/pitching` 쪽 시험이 맡는다.
 */
describe('미션 조준 흔들림 전달', () => {
  const 던지기 = (missionConditionCode?: number) =>
    buildHumanPitch(
      {
        typeNumber: 1,
        courseCell: 4,
        grade: 3,
        gaugeCell: 6,
        stats: 능력,
        repertoire: 레퍼토리,
        side: 1,
        ...(missionConditionCode === undefined ? {} : { missionConditionCode }),
      },
      씨앗(7),
    )

  it('안 넘기면 지금까지와 똑같이 논다', () => {
    expect(던지기().plate).toEqual(던지기(undefined).plate)
  })

  it('세기 0 은 난수를 한 톨도 안 쓴다 — 안 넘긴 것과 같은 공이다', () => {
    expect(던지기(0).plate).toEqual(던지기().plate)
  })

  it('세기 3(존 안 아무 데로 옮기기)은 다른 공이 된다', () => {
    expect(던지기(3).plate).not.toEqual(던지기().plate)
  })

  it('세기 1(가로만 ±40)은 세로가 그대로일 수도 있을 만큼 작게 흔든다', () => {
    const 흔든공 = 던지기(1)
    const 안흔든공 = 던지기()

    expect(Math.abs(흔든공.plate.x - 안흔든공.plate.x)).toBeGreaterThan(0)
  })
})

describe('구질 칸 이름은 원본 이름표 [0x140026c] 칸 그대로 — t ≥ 16 도 (16 SF … 21 KNUCKLE)', () => {
  it('구질 하나씩 — 그 칸 이름이 이름표 칸 t (16 SF · 17 S.CHANGEUP · 18 GYRO · 19 P.SINKER · 20 P.SLIDER · 21 KNUCKLE)', () => {
    const names: string[] = []
    for (let t = 1; t <= 21; t += 1) {
      const slot = pitchSlotsOf({ pitchMask: 1 << (t - 1), form: 0, magicNumber: 0 }).find((each) => each.typeNumber === t)!
      expect(slot.name).toBe(pitchTypeNameOf(t))
      names.push(slot.name)
    }
    expect(names.slice(15)).toEqual(['SF', 'S.CHANGEUP', 'GYRO', 'P.SINKER', 'P.SLIDER', 'KNUCKLE'])
  })

  it('마구 공은 isMagicPitch — 0x34be0 의 타이밍 폭 22 · 12 가 이름이 아니라 구질 22 로 걸린다', () => {
    const pitch = buildHumanPitch(
      {
        typeNumber: MAGIC_PITCH_TYPE_NUMBER,
        stats: { control: 500, velocity: 500, breaking: 500, stamina: 500 },
        repertoire: 레퍼토리,
        side: 0,
        courseCell: 4,
        grade: 3,
      } as Parameters<typeof buildHumanPitch>[0],
      createSeededRandom(1),
    )
    expect(pitch.isMagicPitch).toBe(true)
  })
})
