import { describe, expect, it } from 'vitest'
import {
  flightMillisecondsOf,
  rollCpuPitchTypeOnPitcherChangeTick,
  selectPitch as selectChoice,
} from '@/entities/pitching/model/selectPitch'
import type { CpuPitchChoice, PitchSituation } from '@/entities/pitching/model/selectPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { computerPitchTypeOf, pitchListOf, targetKindOf } from '@/entities/pitching/model/pitchIntelligence'
import { applyControlError, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import { createMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'

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

function 공(choice: CpuPitchChoice): Pitch {
  if (choice.kind !== '투구') throw new Error(`공이 아니라 견제다 (${choice.base}루)`)
  return choice.pitch
}

/** 견제를 끈 기존 호출 — 늘 공이 나온다 */
const selectPitch = (...args: Parameters<typeof selectChoice>) => 공(selectChoice(...args))

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

  it('구질은 공마다 9번 굴리고 마지막 값을 쓴다 — 상태 0xf 틱 0~8 의 메시지 0x644 마다 0x344dc (0x53850 · 0x39c1c)', () => {
    const list = pitchListOf(0x1143, false)
    let differsFromFirstRoll = false
    for (let seed = 1; seed <= 30; seed += 1) {
      const choice = selectChoice(투수(60), 상황, createSeededRandom(seed))
      const expected = createSeededRandom(seed)
      let typeNumber = 0
      for (let tick = 0; tick < 9; tick += 1) typeNumber = computerPitchTypeOf({ list, magicCount: 0, ...상황 }, expected)
      expect(choice.kind === '투구' ? choice.pitchTypeNumber : -1).toBe(typeNumber)
      if (computerPitchTypeOf({ list, magicCount: 0, ...상황 }, createSeededRandom(seed)) !== typeNumber) differsFromFirstRoll = true
    }
    // 첫 굴림 값과 다른 공이 있다 — 한 번만 굴리면 이 시험이 깨진다
    expect(differsFromFirstRoll).toBe(true)
  })

  it('마선수 폼(6~10)도 공을 만든다 — 싸이커 폼 6 은 좌우 반전', () => {
    const 싸이커 = ACE_PITCHER_REPERTOIRES[0]
    const pitch = selectPitch({ control: 67, velocity: 55, repertoire: 싸이커 }, 상황, createSeededRandom(5))
    expect(싸이커.form).toBe(6)
    expect(pitch.worldPath?.[0].x).toBeGreaterThan(20000)
  })
})

describe('selectPitch 체력 — 소모 0xa5e14 는 0x11 진입(0x3dec6)이라 놓기 0x4dc78 앞이다', () => {
  const 지친투수 = { ...투수(60), staminaPercent: 0 }

  it('구질을 고른 뒤 깎은 체력%로 피로 · 제구 등급을 낸다 — 깎은 뒤 0 이면 처음부터 0 인 투수와 같은 공', () => {
    const 받은구질: number[] = []
    const 깎임 = selectPitch(
      {
        ...투수(60),
        staminaPercent: 1,
        staminaPercentAfterPitch: (typeNumber) => {
          받은구질.push(typeNumber)
          return 0
        },
      },
      상황,
      createSeededRandom(42),
    )
    const 처음부터 = selectPitch(지친투수, 상황, createSeededRandom(42))
    expect(받은구질).toHaveLength(1)
    expect(깎임.type).toBe(PITCH_TYPES[받은구질[0] - 1].name)
    // 공에 깎은 뒤 체력%를 실어 스윙 판정 0xab214 까지 넘긴다 — 그 칸만 다르다
    expect(깎임).toEqual({ ...처음부터, pitcherStaminaPercent: 0 })
  })

  it('셈을 안 넘기면 예전 그대로 지금 체력%를 쓰고 공에 아무것도 안 싣는다', () => {
    expect(selectPitch(지친투수, 상황, createSeededRandom(42)).pitcherStaminaPercent).toBeUndefined()
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

  it('마구는 제구 등급을 굴리지 않고 5 다 (0x4dbac 4dbb8) — 구질 → 종류 → 목표점 → 제구 오차(등급 5) 뒤 굴림 없음', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    const actual = createSeededRandom(11)
    const pitch = selectPitch(마투수(0), 마구상황, actual, 'hard', { ...state })
    expect(pitch.type).toBe('싸이킥 스타')
    expect(pitch.controlTier).toBe(5)

    const expected = createSeededRandom(11)
    const repertoire = ACE_PITCHER_REPERTOIRES[0]
    expect(
      computerPitchTypeOf({ list: pitchListOf(repertoire.pitchMask, true), magicCount: 3, ...마구상황 }, expected),
    ).toBe(22)
    const kind = targetKindOf('hard', 마구상황, expected)
    const target = pitchTargetOf(kind, 마구상황, expected)
    applyControlError(target, { tier: 5, isComputer: true }, expected)
    // 제구 등급 굴림(0xb74bc)도 실투 굴림(0x33cbc)도 없다 — 두 난수열이 같은 자리에 서 있다
    expect(actual.rand(0, 0x7fffffff)).toBe(expected.rand(0, 0x7fffffff))
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

describe('selectPitch CPU 견제 — 0x345fc 종류 4 = 0x34848 (I-controls 4a-2)', () => {
  /** 1루 주자 한 명 — 주자열 1, 종류 4 가중치 w4 = 3 */
  const 일루상황: PitchSituation = { strikes: 1, balls: 1, outs: 0, runnerCount: 1, batterSide: 1, side: 1 }
  const 일루만 = { hasRunnerOnBase: (base: number) => base === 1 }

  /** 견제가 나오는 첫 시드 */
  function 견제시드(situation: PitchSituation, pickoff: { hasRunnerOnBase: (base: number) => boolean }): number {
    for (let seed = 1; seed < 5000; seed += 1) {
      if (selectChoice(투수(60), situation, createSeededRandom(seed), 'hard', undefined, pickoff).kind === '견제') return seed
    }
    throw new Error('견제가 안 나온다')
  }

  it('주자가 있는 투구의 일부(약 3%)는 공 대신 견제다 — 루는 늘 주자가 있는 루', () => {
    const random = createSeededRandom(2025)
    let pickoffs = 0
    const attempts = 4000
    for (let index = 0; index < attempts; index += 1) {
      const choice = selectChoice(투수(60), 일루상황, random, 'hard', undefined, 일루만)
      if (choice.kind === '견제') {
        pickoffs += 1
        expect(choice.base).toBe(1)
      }
    }
    expect(pickoffs / attempts).toBeGreaterThan(0.015)
    expect(pickoffs / attempts).toBeLessThan(0.05)
  })

  it('난수 차례: 구질 → 목표 종류 → rand(1,4) 를 주자 있는 루까지 반복 — 목표점·제구·곡선은 안 굴린다', () => {
    const 이삼루 = { hasRunnerOnBase: (base: number) => base === 2 || base === 3 }
    const 상황2: PitchSituation = { ...일루상황, runnerCount: 2 }
    const seed = 견제시드(상황2, 이삼루)
    const actual = createSeededRandom(seed)
    const choice = selectChoice(투수(60), 상황2, actual, 'hard', undefined, 이삼루)

    const expected = createSeededRandom(seed)
    // 구질은 상태 0xf 틱 0~8 에 9번 (0x644 → 0x344dc)
    for (let tick = 0; tick < 9; tick += 1) {
      computerPitchTypeOf({ list: pitchListOf(0x1143, false), magicCount: 0, ...상황2 }, expected)
    }
    expect(targetKindOf('hard', 상황2, expected)).toBe(4)
    let base = 0
    do {
      base = expected.rand(1, 4)
    } while (!이삼루.hasRunnerOnBase(base))

    expect(choice).toEqual({ kind: '견제', base })
    // 그 뒤 굴림이 없다 — 두 난수열이 같은 자리에 서 있다
    expect(actual.rand(0, 0x7fffffff)).toBe(expected.rand(0, 0x7fffffff))
  })

  it('견제를 안 켜면(옵션 없음) 같은 시드에서 예전처럼 공을 던진다 — 종류 4 → 1 (알려진 어긋남)', () => {
    const seed = 견제시드(일루상황, 일루만)
    expect(selectChoice(투수(60), 일루상황, createSeededRandom(seed)).kind).toBe('투구')
  })

  it('주자가 없거나 만루면 견제하지 않는다 (0x34684 → 종류 1)', () => {
    const 만루: PitchSituation = { ...일루상황, runnerCount: 3 }
    const 모두 = { hasRunnerOnBase: () => true }
    const random = createSeededRandom(99)
    for (let index = 0; index < 2000; index += 1) {
      expect(selectChoice(투수(60), 만루, random, 'hard', undefined, 모두).kind).toBe('투구')
      expect(selectChoice(투수(60), 상황, random, 'hard', undefined, 모두).kind).toBe('투구')
    }
  })

  it('견제면 마구 상태를 안 고친다 — 소모(0x34894)·싣기(0x3de10) 둘 다 0x34888 뒤라 안 지난다', () => {
    const 마투수 = { control: 67, velocity: 55, repertoire: ACE_PITCHER_REPERTOIRES[0] }
    const 마구상황: PitchSituation = { strikes: 0, balls: 1, outs: 0, runnerCount: 2, batterSide: 1, side: 1 }
    const 일이루 = { hasRunnerOnBase: (base: number) => base <= 2 }
    for (let seed = 1; seed < 5000; seed += 1) {
      const state = { remaining: 3, ballMagicNumber: 5 }
      const choice = selectChoice(마투수, 마구상황, createSeededRandom(seed), 'hard', state, 일이루)
      if (choice.kind === '견제') {
        expect(state).toEqual({ remaining: 3, ballMagicNumber: 5 })
        return
      }
    }
    throw new Error('견제가 안 나온다')
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

  it('S.CURVE 와 KNUCKLE 은 원본이 반대로 느려진다', () => {
    for (const name of ['S.CURVE', 'KNUCKLE']) {
      const type = PITCH_TYPES.find((candidate) => candidate.name === name)
      if (type === undefined) throw new Error(`${name} 구질을 찾지 못했습니다`)
      expect(flightMillisecondsOf(type.flightSteps, 100)).toBeGreaterThan(flightMillisecondsOf(type.flightSteps, 0))
    }
  })
})

describe('selectPitch 실투 판정 0x33cbc — 사람이 칠 때도 CPU 공마다 (0x4dea0)', () => {
  /** 굴림 값을 적어 두고, 지정한 차례만 바꿔 다시 내는 난수 */
  function 기록난수(base: () => number, 바꿀: Map<number, number> = new Map()) {
    const values: number[] = []
    const random = createFractionRandom(() => {
      const index = values.length
      const value = 바꿀.get(index) ?? base()
      values.push(value)
      return value
    })
    return { random, values }
  }

  it('마구가 아니면 곡선 뒤 rand(0,100) 을 한 번 더 굴린다 — 그 굴림이 0 이면 실투, 99 면 아니다', () => {
    const seed = createSeededRandom(77)
    const 처음 = 기록난수(() => seed.rand(0, 0x40000000) / 0x40000000)
    const 공1 = selectChoice(투수(60), 상황, 처음.random)
    expect(공1.kind).toBe('투구')
    const 마지막 = 처음.values.length - 1
    const 다시 = (value: number) => {
      const 재생 = [...처음.values]
      const { random } = 기록난수(() => 재생.shift() ?? 0, new Map([[마지막, value]]))
      return selectChoice(투수(60), 상황, random)
    }
    const 실투 = 다시(0)
    const 정상 = 다시(0.995)
    expect(실투.kind === '투구' && 실투.isMistakePitch).toBe(true)
    expect(정상.kind === '투구' && 정상.isMistakePitch).toBe(false)
    // 실투 굴림은 맨 끝이라 구질·제구 등급은 같다. 공은 실투면 한가운데로 다시 놓인다 (0x4dec0~0x4df5e)
    if (실투.kind !== '투구' || 정상.kind !== '투구') throw new Error('견제')
    expect(실투.pitchTypeNumber).toBe(정상.pitchTypeNumber)
    expect(실투.pitch.type).toBe(정상.pitch.type)
    expect(실투.pitch.controlTier).toBe(정상.pitch.controlTier)
    expect(실투.pitch.plate).toEqual({ x: 0, y: 0 })
    expect(실투.pitch.frameCount).toBe(실투.pitchTypeNumber === 1 ? 18 : 20)
    expect(실투.pitch.worldPath).toHaveLength(실투.pitch.frameCount)
    expect(실투.pitch.worldPath?.at(-1)).toEqual(ZONE_CENTERS[상황.side])
    expect(실투.pitch.flightDurationMilliseconds).toBe(실투.pitch.frameCount * millisecondsPerFrame())
  })

  it('실투 공의 N 은 구질 1(직구)이면 18, 아니면 20 — 레코드 N 과 상관없다 (0x4dec0 · 0x4df14)', () => {
    const 결과 = new Map<number, number>()
    for (let seed = 1; seed <= 400 && 결과.size < 2; seed += 1) {
      const base = createSeededRandom(seed)
      const 처음 = 기록난수(() => base.rand(0, 0x40000000) / 0x40000000)
      const 공1 = selectChoice(투수(60), 상황, 처음.random)
      if (공1.kind !== '투구') continue
      const 재생 = [...처음.values]
      const { random } = 기록난수(() => 재생.shift() ?? 0, new Map([[처음.values.length - 1, 0]]))
      const 실투 = selectChoice(투수(60), 상황, random)
      if (실투.kind !== '투구' || !실투.isMistakePitch) continue
      결과.set(실투.pitchTypeNumber === 1 ? 1 : 0, 실투.pitch.frameCount)
    }
    expect(결과.get(1)).toBe(18)
    expect(결과.get(0)).toBe(20)
  })

  it('타자 압도(스킬 22)는 실투율 +5 — 굴림 값 7.x% 에서 갈린다 (구속 600·등급 그대로 p 를 넘는다)', () => {
    const seed = createSeededRandom(77)
    const 처음 = 기록난수(() => seed.rand(0, 0x40000000) / 0x40000000)
    const 공1 = selectChoice(투수(60), 상황, 처음.random)
    if (공1.kind !== '투구') throw new Error('견제')
    const 마지막 = 처음.values.length - 1
    // p 는 등급·구속으로 정해진다. 압도면 같은 굴림 값에서도 p+5 로 견주므로 실투가 되는 경계가 5 오른다
    const 결과 = (roll: number, intimidates: boolean) => {
      const 재생 = [...처음.values]
      const { random } = 기록난수(() => 재생.shift() ?? 0, new Map([[마지막, roll / 100]]))
      const choice = selectChoice(투수(60), 상황, random, 'hard', undefined, undefined, intimidates)
      return choice.kind === '투구' && choice.isMistakePitch
    }
    const 경계 = Array.from({ length: 100 }, (_, roll) => roll).find((roll) => !결과(roll, false)) ?? 100
    const 압도경계 = Array.from({ length: 100 }, (_, roll) => roll).find((roll) => !결과(roll, true)) ?? 100
    expect(압도경계 - 경계).toBe(5)
  })
})

describe('홈런더비 목표점 (0x345fc 의 0x3460e 모드 7 갈래)', () => {
  it('목표 종류·목표점을 굴리지 않는다 — 같은 난수에서 두 굴림(종류 rand(0,10000)·목표점)이 빠진다', () => {
    /** 뽑은 횟수를 센다 */
    const 세는난수 = () => {
      const inner = createSeededRandom(7)
      let count = 0
      return {
        get count() { return count },
        rand: (lo: number, hi: number) => { count += 1; return inner.rand(lo, hi) },
        rand9d: inner.rand9d,
      }
    }
    const 보통 = 세는난수()
    selectChoice(투수(60, 0x1), 상황, 보통)
    const 더비 = 세는난수()
    const 공더비 = 공(selectChoice(투수(60, 0x1), 상황, 더비, 'hard', undefined, undefined, false, 1))
    expect(더비.count).toBeLessThan(보통.count)
    expect(공더비.pitcherForm).toBe(0)
  })

  it('주자가 있어도 견제하지 않는다', () => {
    const 주자상황 = { ...상황, runnerCount: 1 }
    for (let seed = 0; seed < 50; seed += 1) {
      const choice = selectChoice(투수(60), 주자상황, createSeededRandom(seed), 'hard', undefined,
        { hasRunnerOnBase: (base) => base === 1 }, false, 1)
      expect(choice.kind).toBe('투구')
    }
  })
})

describe('홈런더비 구질 (0x344dc 의 0x344ea 모드 7 갈래)', () => {
  /** 뽑은 횟수를 센다 */
  const 세는난수 = (seed: number) => {
    const inner = createSeededRandom(seed)
    let count = 0
    return {
      get count() { return count },
      rand: (lo: number, hi: number) => { count += 1; return inner.rand(lo, hi) },
      rand9d: inner.rand9d,
    }
  }
  const 마투수 = { control: 67, velocity: 55, repertoire: ACE_PITCHER_REPERTOIRES[1] }

  it('단계 0 (구질 1) — 구질을 굴리지 않고 늘 직구, 목록에 다른 구질이 있어도', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const choice = selectChoice(투수(60), 상황, createSeededRandom(seed), 'hard', undefined, undefined, false, 1)
      if (choice.kind !== '투구') throw new Error('견제')
      expect(choice.pitchTypeNumber).toBe(1)
      expect(choice.pitch.type).toBe('FASTBALL')
    }
  })

  it('구질 굴림 rand(0,6) 이 빠진다 — 구질 목록이 달라도 같은 시드면 굴림 수·공이 같다', () => {
    const 보통상황 = { ...상황, strikes: 1, balls: 1 }
    const 한구질 = 세는난수(3)
    const 공한구질 = 공(selectChoice(투수(60, 0x1), 보통상황, 한구질, 'hard', undefined, undefined, false, 1))
    const 여러구질 = 세는난수(3)
    const 공여러구질 = 공(selectChoice(투수(60, 0x1143), 보통상황, 여러구질, 'hard', undefined, undefined, false, 1))
    expect(여러구질.count).toBe(한구질.count)
    expect(공여러구질.plate).toEqual(공한구질.plate)
    // 일반 갈래(1-1 은 마구 때가 아니라 rand(0,6) 을 굴린다)보다 적다
    const 보통 = 세는난수(3)
    selectChoice(투수(60, 0x1143), 보통상황, 보통)
    expect(보통.count).toBeGreaterThan(여러구질.count)
  })

  it('단계 ≥ 1 (구질 22) — 볼카운트와 무관하게 늘 마구, 제구 등급 5 · 실투 굴림 없음', () => {
    const magic = createMagicPitchGameState(마투수.repertoire)
    const 보통상황 = { ...상황, strikes: 1, balls: 1 }
    const random = 세는난수(9)
    const choice = selectChoice(마투수, 보통상황, random, 'hard', magic, undefined, false, 22)
    if (choice.kind !== '투구') throw new Error('견제')
    expect(choice.pitchTypeNumber).toBe(22)
    expect(choice.pitch.isMagicPitch).toBe(true)
    expect(choice.pitch.controlTier).toBe(5)
    expect(choice.isMistakePitch).toBe(false)
  })

  it('마구 횟수가 줄지 않는다 (0x345fc 가 소모 0x34894 앞에서 끝난다) — 공+0x10 은 늘 투수 +0x18', () => {
    const magic = createMagicPitchGameState(마투수.repertoire)
    const start = magic.remaining
    const random = createSeededRandom(11)
    for (let index = 0; index < start + 5; index += 1) {
      const choice = selectChoice(마투수, 상황, random, 'hard', magic, undefined, false, 22)
      if (choice.kind !== '투구') throw new Error('견제')
      expect(choice.pitch.magicNumber).toBe(마투수.repertoire.magicId)
    }
    expect(magic.remaining).toBe(start)
  })
})

describe('CPU 투수 교체 틱의 구질 굴림 — 0x3d954 가 0x16 을 예약한 0xf 틱 0 에도 0x53850 → 0x644 → 0x344dc 한 번', () => {
  const 굴림기록 = () => {
    const calls: [number, number][] = []
    const inner = createSeededRandom(5)
    return {
      calls,
      random: { rand: (lo: number, hi: number) => { calls.push([lo, hi]); return inner.rand(lo, hi) }, rand9d: inner.rand9d },
    }
  }
  const 보통 = { pitchMask: 0x1143, magicId: 0 }
  const 마구투수 = { pitchMask: 0x1143, magicId: 1 }

  it('마구 칸이 없으면 볼카운트와 상관없이 rand(0,6) 한 번', () => {
    const { calls, random } = 굴림기록()
    rollCpuPitchTypeOnPitcherChangeTick({ repertoire: 보통, runnerCount: 2, strikes: 2, balls: 0 }, random)
    expect(calls).toEqual([[0, 6]])
  })

  it('마구 조건(0-0)이고 남은 마구가 있으면 굴림이 없고, 남은 게 0 이면 한 번', () => {
    const 남음 = 굴림기록()
    rollCpuPitchTypeOnPitcherChangeTick({ repertoire: 마구투수, magicRemaining: 2, runnerCount: 0, strikes: 0, balls: 0 }, 남음.random)
    expect(남음.calls).toEqual([])
    const 바닥 = 굴림기록()
    rollCpuPitchTypeOnPitcherChangeTick({ repertoire: 마구투수, magicRemaining: 0, runnerCount: 0, strikes: 0, balls: 0 }, 바닥.random)
    expect(바닥.calls).toEqual([[0, 6]])
  })

  it('마구 조건이 아니면(1-1) 마구 투수도 한 번', () => {
    const { calls, random } = 굴림기록()
    rollCpuPitchTypeOnPitcherChangeTick({ repertoire: 마구투수, magicRemaining: 2, runnerCount: 0, strikes: 1, balls: 1 }, random)
    expect(calls).toEqual([[0, 6]])
  })
})
