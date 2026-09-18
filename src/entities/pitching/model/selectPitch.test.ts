import { describe, expect, it } from 'vitest'
import { flightMillisecondsOf, selectPitch } from '@/entities/pitching/model/selectPitch'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

const 상황: PitchSituation = { strikes: 0, balls: 0, outs: 0, runnerCount: 0, batterSide: 1, side: 1 }
const 투수 = (control: number, pitchMask = 0x1143) => ({ control, velocity: 60, repertoire: { form: 0, pitchMask, magicId: 0 } })

function 존적중비율(control: number, attempts: number): number {
  const random = createSeededRandom(20100901)
  let insideCount = 0
  for (let index = 0; index < attempts; index += 1) {
    if (isInsideStrikeZone(selectPitch(투수(control), 상황, random).plate)) insideCount += 1
  }
  return insideCount / attempts
}

const FASTBALL = PITCH_TYPES[0]

describe('selectPitch — 원본 CPU 투구 (0x344dc → 0x9eeac → 0x345fc → 0xb74bc → 0x4dc78)', () => {
  it('같은 시드는 같은 공을 낸다', () => {
    expect(selectPitch(투수(60), 상황, createSeededRandom(42))).toEqual(selectPitch(투수(60), 상황, createSeededRandom(42)))
  })

  it('보유 구질만 던진다 — 마스크 0x1143 은 1·2·7·9·13 (+ 빈 칸은 직구)', () => {
    const random = createSeededRandom(7)
    const names = new Set(Array.from({ length: 200 }, () => selectPitch(투수(60), 상황, random).type))
    expect([...names].sort()).toEqual(['CHANGEUP', 'CURVE', 'FASTBALL', 'H.SHOOT', 'TWO-SEAM'].sort())
  })

  it('경로는 원본 N 점이고 마지막 점이 존 좌표 plate 가 된다', () => {
    const pitch = selectPitch(투수(60), 상황, createSeededRandom(3))
    expect(pitch.worldPath).not.toBeNull()
    expect(pitch.worldPath).toHaveLength(pitch.frameCount)
    expect(pitch.stageSide).toBe(1)
  })

  it('제구가 높을수록 존 안에 들어오는 비율이 높다', () => {
    const 저제구 = 존적중비율(10, 400)
    const 고제구 = 존적중비율(95, 400)
    expect(고제구, `저제구=${저제구}, 고제구=${고제구}`).toBeGreaterThan(저제구)
  })

  it('마선수 폼(6~10)도 공을 만든다 — 싸이커 폼 6 은 좌우 반전', () => {
    const 싸이커 = ACE_PITCHER_REPERTOIRES[0]
    const pitch = selectPitch({ control: 67, velocity: 55, repertoire: 싸이커 }, 상황, createSeededRandom(5))
    expect(싸이커.form).toBe(6)
    expect(pitch.worldPath?.[0].x).toBeGreaterThan(20000)
  })
})

describe('flightMillisecondsOf — 사용자 투구(투수편)용', () => {
  it('구속이 높을수록 비행 시간이 짧다 (원본 FASTBALL 18→12 프레임)', () => {
    const 느린직구 = flightMillisecondsOf(FASTBALL.flightSteps, 0)
    const 빠른직구 = flightMillisecondsOf(FASTBALL.flightSteps, 100)
    expect(빠른직구).toBeLessThan(느린직구)
    expect(느린직구).toBe(FASTBALL.flightSteps[0] * millisecondsPerFrame())
    expect(빠른직구).toBe(FASTBALL.flightSteps[3] * millisecondsPerFrame())
  })

  it('S.CURVE 와 SPECIAL 은 원본이 반대로 느려진다', () => {
    for (const name of ['S.CURVE', 'SPECIAL']) {
      const type = PITCH_TYPES.find((candidate) => candidate.name === name)
      if (type === undefined) throw new Error(`${name} 구질을 찾지 못했습니다`)
      expect(flightMillisecondsOf(type.flightSteps, 100)).toBeGreaterThan(flightMillisecondsOf(type.flightSteps, 0))
    }
  })
})
