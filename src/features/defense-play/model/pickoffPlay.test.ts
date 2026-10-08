import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  isPickoffPlayResult,
  pickoffCallSoundIdOf,
  PICKOFF_RESULT,
  runPickoffPlay,
} from '@/features/defense-play/model/pickoffPlay'

/** 굴림 수를 세는 난수 — 값은 늘 같은 비율 */
function 세는난수(ratio: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    ...createFractionRandom(() => {
      rolls += 1
      return ratio
    }),
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }
const 만루 = { first: true, second: true, third: true }

describe('견제 한 판 — 종류 4 (0xb28be · 0xb47da · 0xb4292)', () => {
  it('리드 5틱(0xcffac)이면 공이 오기 전에 돌아와 있다 — 결과 9(세이프), 경기 상태는 그대로', () => {
    for (const targetBase of [1, 2, 3] as const) {
      const result = runPickoffPlay({ targetBase, bases: 만루, outs: 1, offenseIsCpu: true, random: 세는난수(0.9) })
      expect(result.resultCode, `${targetBase}루`).toBe(PICKOFF_RESULT.SAFE)
      expect(result.advance).toEqual({ bases: 만루, runsScored: 0, outsAdded: 0 })
      expect(result.tagOut).toBe(false)
    }
  })

  it('판이 열릴 때 주자는 루를 떠나 있다(0x46418 → 0x3d7b8) — 덧틱 5(rand(0,100) == 0)면 1·3루 주자는 돌아오기 전에 태그된다', () => {
    // 리드 굴림 셋(주자마다 0) → 악송구 굴림(0.9, 아님)
    const 차례 = [0, 0, 0, 0.9]
    let i = 0
    const 정한난수: RandomPort = createFractionRandom(() => 차례[Math.min(i++, 차례.length - 1)])
    const result = runPickoffPlay({ targetBase: 1, bases: 만루, outs: 1, offenseIsCpu: true, random: 정한난수 })
    expect(result.ticks[0].runners[0]).not.toMatchObject({ x: basePosition(1).x, z: basePosition(1).z })
    expect(result.resultCode).toBe(PICKOFF_RESULT.OUT)
    expect(result.tagOut).toBe(true)
    expect(pickoffCallSoundIdOf(result)).toBe(62)
    expect(result.advance).toEqual({ bases: { first: false, second: true, third: true }, runsScored: 0, outsAdded: 1 })
  })

  it('공은 대상 루 커버(루 번호 + 1)의 손에서 끝난다 — 2루도 늘 2루수다', () => {
    const result = runPickoffPlay({ targetBase: 2, bases: 만루, outs: 0 })
    const last = result.ticks[result.ticks.length - 1]
    expect(last.ball).toMatchObject({ x: basePosition(2).x, z: basePosition(2).z })
    const second = last.fielders.find((fielder) => fielder.slot === 3)
    expect(second).toMatchObject({ x: basePosition(2).x, z: basePosition(2).z })
  })

  it('타자주자를 만들지 않는다 — 그림의 주자는 루에 있던 주자뿐이다', () => {
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1])
  })

  it('난수는 주자마다 리드 rand(0,100) 한 번 → 악송구 굴림(0xa1828) 한 번 → 받는 펌블 굴림(b4224) 한 번', () => {
    const random = 세는난수(0.9)
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0, random })
    // 투수 → 1루는 8200 이하라 긴 송구 흔들림 굴림(a198c)이 없다
    expect(random.count()).toBe(3)
    expect(result.errantThrow).toBe(false)
  })

  it('악송구면 수평·수직 속도 · 방향 크기 · 부호 넷을 더 굴리고(0xa1868~0xa1924), 예보 vt24(0)가 고른 야수가 줍는다', () => {
    // 늘 0 인 난수 — 줍는 족족 움직이는 공을 펌블해 0xb3148 로 튕기고(튕김 rand(−20, 20) · 다시 줍는 펌블 굴림),
    // 그사이 자동 진루가 주자를 홈까지 보낸다. 루 위에서 쥔 적이 없어 결과 코드는 안 선다
    const random = 세는난수(0)
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0, random })
    expect(random.count()).toBe(34)
    expect(result.errantThrow).toBe(true)
    expect(result.fumbled).toBe(true)
    expect(result.resultCode).toBeNull()
    expect(result.advance).toEqual({ bases: { first: false, second: false, third: false }, runsScored: 1, outsAdded: 0 })
  })

  it('세이프 콜은 늘 17 이다 (0x51c14 의 종류 4·5 갈래) — 결과 코드가 없으면 소리도 없다', () => {
    expect(pickoffCallSoundIdOf({ resultCode: PICKOFF_RESULT.SAFE, tagOut: false })).toBe(17)
    expect(pickoffCallSoundIdOf({ resultCode: PICKOFF_RESULT.OUT, tagOut: true })).toBe(62)
    expect(pickoffCallSoundIdOf({ resultCode: null, tagOut: false })).toBeNull()
  })

  it('재생 칸에 든 결과가 견제 판인지 가를 수 있다', () => {
    const result = runPickoffPlay({ targetBase: 3, bases: 만루, outs: 0 })
    expect(isPickoffPlayResult(result)).toBe(true)
    expect(isPickoffPlayResult(null)).toBe(false)
  })
})

describe('견제사 뒤 결과 메시지 0xbba → 0xafa60 한 번 (0x51d40~0x51db4)', () => {
  it('받은 야수는 쥐기 0xb2710(P, f, 1)의 준비 틱이 남아 있어 견제사 뒤에도 이어 던지지 않는다', () => {
    let 견제사 = 0
    for (const targetBase of [1, 2, 3] as const) {
      for (let seed = 0; seed < 300; seed += 1) {
        const result = runPickoffPlay({
          targetBase,
          bases: 만루,
          outs: seed % 3,
          runAbility: [300, 500, 700, 900][seed % 4],
          random: createSeededRandom(seed),
        })
        if (result.resultCode === PICKOFF_RESULT.OUT) 견제사 += 1
        // 이어 던진 송구(0xb2c90 → 0xb2e38)는 "N번 야수가 b루로 송구" 로 남는다 — 견제 송구는 "b루 견제 송구"
        expect(result.log.some((line) => line.includes('루로 송구'))).toBe(false)
      }
    }
    expect(견제사).toBeGreaterThan(0)
  })
})

describe('견제를 받은 야수의 CPU 송구 결정 — 슬롯 2 의 0xafa60 (매 틱, `0xae6c8` = 수비 CPU || 송구 자동)', () => {
  it('견제사 뒤에도 판 진행 관문 0xb0d28 이 공을 쥔 채 17틱(관문 51 번)을 더 돌려, 받은 야수의 준비 틱(내야 3)이 끝난 틱에 점수식이 고를 수 있다', () => {
    const 사람 = runPickoffPlay({ targetBase: 1, bases: { first: true, second: false, third: false }, outs: 0 })
    const CPU = runPickoffPlay({
      targetBase: 1,
      bases: { first: true, second: false, third: false },
      outs: 0,
      defenseIsCpu: true,
    })

    // 6틱에 1루수가 받아 +0xc8 = 3 → 9틱에 준비. 8틱 견제사 뒤 주자가 없고 1루수가 공을 쥐어 +0x120 이 8틱 끝부터 한 그림에
    // 세 번(그리기 G3 · 0x3f060 G1 · 52502 G2) 올라 52번째 호출(25틱 끝의 G3)에서 닫힌다 — 수비 CPU · 사람 모두 같다
    // (점수식이 던질 루를 못 찾는다)
    expect(사람.throwArrivalTick).toBe(6)
    expect(사람.ticks).toHaveLength(26)
    expect(CPU.ticks).toHaveLength(26)
    expect(CPU.advance).toEqual(사람.advance)
    // 송구 설정이 자동이면 사람 수비도 같다
    expect(
      runPickoffPlay({ targetBase: 1, bases: { first: true, second: false, third: false }, outs: 0, throwMode: '자동' })
        .ticks,
    ).toHaveLength(26)
  })

  it('표본 — CPU 갈래가 돌아도 견제 판의 결과·굴림은 그대로다 (점수식이 던질 루를 못 찾는다)', () => {
    const 굴림 = (defenseIsCpu: boolean) => {
      let calls = 0
      const results: (number | null)[] = []
      for (let seed = 0; seed < 300; seed += 1) {
        const inner = createSeededRandom(seed)
        const random: RandomPort = {
          rand: (a, b) => {
            calls += 1
            return inner.rand(a, b)
          },
          rand9d: (n) => {
            calls += 1
            return inner.rand9d(n)
          },
        }
        const result = runPickoffPlay({ targetBase: ((seed % 3) + 1) as 1 | 2 | 3, bases: 만루, outs: seed % 3, random, defenseIsCpu })
        results.push(result.resultCode)
      }
      return { calls, results }
    }
    expect(굴림(true)).toEqual(굴림(false))
  })
})
