import { describe, expect, it } from 'vitest'
import {
  buildPitch,
  COURSE_GRID,
  courseOf,
  GOOD_WINDOW,
  judgeGauge,
  PERFECT_WINDOW,
  PITCH_SLOT_COUNT,
} from '@/entities/pitching/model/pitchCommand'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'

const 직구 = PITCH_TYPES.find((t) => t.name === 'FASTBALL')!
const 커브 = PITCH_TYPES.find((t) => t.name === 'CURVE')!
const 너클 = PITCH_TYPES.find((t) => t.name === 'KNUCKLE')!

describe('원본 구질 데이터', () => {
  it('원작 구질 21종이 순서대로 들어있다', () => {
    expect(PITCH_TYPES).toHaveLength(21)
    expect(PITCH_TYPES[0].name).toBe('FASTBALL')
    expect(PITCH_TYPES[PITCH_TYPES.length - 1].name).toBe('SPECIAL')
  })

  it('직구는 변화가 없고 변화구는 변화가 있다', () => {
    expect(직구.horizontalBreak).toBe(0)
    expect(직구.verticalBreak).toBe(0)
    expect(커브.verticalBreak).toBeLessThan(0)
  })

  it('직구가 가장 빠르고 변화구는 더 느리다 — 원본 궤적의 레코드 수 비율', () => {
    expect(직구.speed).toBe(1)
    expect(커브.speed).toBeLessThan(직구.speed)
    expect(너클.speed).toBeLessThan(직구.speed)
  })

  it('체인지업이 가장 크게 떨어진다 — 원본 최대 낙차', () => {
    const 체인지업 = PITCH_TYPES.find((t) => t.name === 'CHANGEUP')!
    const drops = PITCH_TYPES.map((t) => t.verticalBreak)

    expect(체인지업.verticalBreak).toBe(Math.min(...drops))
  })

  it('슬라이더는 왼쪽, 슛은 오른쪽으로 휜다', () => {
    const 슛 = PITCH_TYPES.find((t) => t.name === 'SHOOT')!
    const 슬라이더 = PITCH_TYPES.find((t) => t.name === 'SLIDER')!

    expect(슬라이더.horizontalBreak).toBeLessThan(0)
    expect(슛.horizontalBreak).toBeGreaterThan(0)
  })

  it('구질 슬롯은 원작의 다섯 자리다', () => {
    expect(PITCH_SLOT_COUNT).toBe(5)
  })
})

describe('judgeGauge — 투구 게이지', () => {
  it('오차가 아주 작으면 PERFECT다', () => {
    expect(judgeGauge(0)).toBe('PERFECT')
    expect(judgeGauge(PERFECT_WINDOW)).toBe('PERFECT')
  })

  it('조금 어긋나면 GOOD이다', () => {
    expect(judgeGauge(GOOD_WINDOW)).toBe('GOOD')
  })

  it('크게 어긋나면 BAD다', () => {
    expect(judgeGauge(0.5)).toBe('BAD')
  })

  it('빠르든 늦든 같은 크기면 같은 판정이다', () => {
    expect(judgeGauge(-0.15)).toBe(judgeGauge(0.15))
  })
})

describe('courseOf — 코스 격자', () => {
  it('가운데 칸은 존 한가운데다', () => {
    expect(courseOf(4)).toEqual({ x: 0, y: 0 })
  })

  it('아홉 칸이 모두 존 안에 들어간다', () => {
    for (let cell = 0; cell < COURSE_GRID * COURSE_GRID; cell += 1) {
      expect(isInsideStrikeZone(courseOf(cell)), `칸 ${cell}`).toBe(true)
    }
  })

  it('왼쪽 위 칸과 오른쪽 아래 칸이 대각으로 마주본다', () => {
    expect(courseOf(0)).toEqual({ x: -0.62, y: 0.62 })
    expect(courseOf(8)).toEqual({ x: 0.62, y: -0.62 })
  })
})

describe('buildPitch', () => {
  it('PERFECT 게이지는 제구를 높여 노린 코스에 더 붙는다', () => {
    const command = { type: 직구, aim: courseOf(4), gauge: 'PERFECT' as const }
    const bad = { ...command, gauge: 'BAD' as const }
    const pitcher = { control: 50, velocity: 60 }

    let perfectError = 0
    let badError = 0
    const random = createSeededRandom(20100901)
    for (let i = 0; i < 200; i += 1) {
      perfectError += Math.abs(buildPitch(command, pitcher, random).plate.x)
      badError += Math.abs(buildPitch(bad, pitcher, random).plate.x)
    }

    expect(perfectError, `perfect=${perfectError} bad=${badError}`).toBeLessThan(badError)
  })

  it('PERFECT 게이지는 공이 더 빠르다', () => {
    const pitcher = { control: 60, velocity: 60 }
    const perfect = buildPitch(
      { type: 직구, aim: courseOf(4), gauge: 'PERFECT' },
      pitcher,
      createSeededRandom(5),
    )
    const plain = buildPitch(
      { type: 직구, aim: courseOf(4), gauge: '사용안함' },
      pitcher,
      createSeededRandom(5),
    )

    expect(perfect.flightDurationMilliseconds).toBeLessThan(plain.flightDurationMilliseconds)
  })

  it('구속이 높을수록 비행 시간이 짧다', () => {
    const command = { type: 직구, aim: courseOf(4), gauge: '사용안함' as const }
    const 느림 = buildPitch(command, { control: 60, velocity: 0 }, createSeededRandom(5))
    const 빠름 = buildPitch(command, { control: 60, velocity: 100 }, createSeededRandom(5))

    expect(빠름.flightDurationMilliseconds).toBeLessThan(느림.flightDurationMilliseconds)
  })

  it('느린 구질은 같은 투수라도 더 오래 날아간다', () => {
    const pitcher = { control: 60, velocity: 60 }
    const fast = buildPitch({ type: 직구, aim: courseOf(4), gauge: '사용안함' }, pitcher, createSeededRandom(5))
    const slow = buildPitch({ type: 너클, aim: courseOf(4), gauge: '사용안함' }, pitcher, createSeededRandom(5))

    expect(slow.flightDurationMilliseconds).toBeGreaterThan(fast.flightDurationMilliseconds)
  })

  it('변화구는 변화량이 실린다', () => {
    const pitch = buildPitch(
      { type: 커브, aim: courseOf(4), gauge: '사용안함' },
      { control: 60, velocity: 60 },
      createSeededRandom(5),
    )

    expect(pitch.breakOffset.y).toBeLessThan(0)
  })

  it('같은 시드와 같은 명령이면 같은 공이 나온다', () => {
    const command = { type: 커브, aim: courseOf(2), gauge: 'GOOD' as const }
    const pitcher = { control: 55, velocity: 70 }

    expect(buildPitch(command, pitcher, createSeededRandom(7))).toEqual(
      buildPitch(command, pitcher, createSeededRandom(7)),
    )
  })
})
