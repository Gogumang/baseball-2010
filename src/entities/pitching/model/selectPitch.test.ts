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

describe('selectPitch 마구 — CPU 상대 투수 (0x344dc · 0x345fc · 0x3de10 · 0x46fa8)', () => {
  const 마투수 = (index: number) => ({
    control: 67,
    velocity: 55,
    repertoire: ACE_PITCHER_REPERTOIRES[index],
  })
  /** 마구가 반드시 나오는 상황 (주자 2명) · 안 나오는 상황 (1-1, 주자 없음) */
  const 마구상황: PitchSituation = { strikes: 0, balls: 1, outs: 0, runnerCount: 2, batterSide: 1, side: 1 }
  const 보통상황: PitchSituation = { strikes: 1, balls: 1, outs: 0, runnerCount: 0, batterSide: 1, side: 1 }

  it('마구 상태를 안 넘기면 마구가 나오지 않는다 (남은 횟수 0 — 기본값은 꺼짐)', () => {
    const random = createSeededRandom(4242)
    for (let index = 0; index < 200; index += 1) {
      expect(selectPitch(마투수(0), 마구상황, random).magicNumber).toBe(0)
    }
  })

  it('마구 번호가 0 인 일반 투수는 마구를 절대 던지지 않는다 (레코드 +0x18 = 0)', () => {
    const random = createSeededRandom(2010)
    const names = new Set(
      Array.from({ length: 500 }, () => selectPitch(투수(60), 마구상황, random).type),
    )
    expect([...names].every((name) => PITCH_TYPES.some((type) => type.name === name))).toBe(true)
  })

  it('마투수는 주자 2명 상황에서 반드시 마구다 (0x34536)', () => {
    const pitch = selectPitch(마투수(0), 마구상황, createSeededRandom(11), 'hard', {
      remaining: 3,
      ballMagicNumber: 0,
    })
    expect(pitch.type).toBe('싸이킥 스타')
    // 첫 마구는 소모되지 않는다(공+0x10 == 0) — 대신 공에 번호 5 가 실린다
    expect(pitch.magicNumber).toBe(5)
  })

  it('남은 횟수가 0 이면 마구가 나오지 않는다 (0x34518 · 0x3456c)', () => {
    const random = createSeededRandom(11)
    for (let index = 0; index < 200; index += 1) {
      const pitch = selectPitch(마투수(0), 마구상황, random, 'hard', { remaining: 0, ballMagicNumber: 0 })
      expect(pitch.type).not.toBe('싸이킥 스타')
    }
  })

  it('한 경기 마구 수 = 표 값 + 1 — 첫 마구가 공짜인 원본 버그 그대로 (0x345fc 조건 공+0x10 != 0)', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    let magicCount = 0
    const random = createSeededRandom(777)
    // 늘 마구가 나오는 상황으로 몰아서 세면 소모 규칙만 남는다
    for (let index = 0; index < 50; index += 1) {
      if (selectPitch(마투수(0), 마구상황, random, 'hard', state).type === '싸이킥 스타') magicCount += 1
    }
    expect(state.remaining).toBe(0)
    // 마투수 Lv1 표 값 3 (0xd8509) + 첫 마구 한 번
    expect(magicCount).toBe(4)
  })

  it('마구를 던진 뒤 직구에도 공+0x10 이 남는다 — 원본 버그 그대로 (H2 3-4)', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    expect(selectPitch(마투수(0), 마구상황, createSeededRandom(5), 'hard', state).magicNumber).toBe(5)
    const 보통공 = selectPitch(마투수(0), 보통상황, createSeededRandom(5), 'hard', state)
    expect(보통공.type).not.toBe('싸이킥 스타')
    expect(보통공.magicNumber).toBe(5)
    // 그림 종류는 되돌리는 코드가 있어서(0x3d954) 마구가 아닌 공엔 남지 않는다
    expect(보통공.ballKind).toBe(0)
  })

  it('공 그림 종류는 발렌타인 2(날개) · 드래고나 1(불꽃), 나머지 마투수는 0 (0x4725c · 0x4736e)', () => {
    const kinds = [0, 1, 2, 3, 4].map(
      (index) =>
        selectPitch(마투수(index), 마구상황, createSeededRandom(31), 'hard', {
          remaining: 3,
          ballMagicNumber: 0,
        }).ballKind,
    )
    expect(kinds).toEqual([0, 0, 0, 2, 1])
  })

  it('마구 궤적은 구질 22 블록의 m+7 번 레코드다 (0x9e944)', () => {
    const 드래고나 = selectPitch(마투수(4), 마구상황, createSeededRandom(9), 'hard', {
      remaining: 3,
      ballMagicNumber: 0,
    })
    expect(드래고나.type).toBe('브레스 웨폰')
    // 레코드 16 = 브레스 웨폰, 38틱
    expect(드래고나.frameCount).toBe(38)
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
