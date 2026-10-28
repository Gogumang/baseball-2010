import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { advanceRunners, EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { arrivalApplicationOf, runPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { acceptsWalkPlaySkipKey, isWalkPlayResult, opensWalkPlayAtArrival, runWalkPlay } from '@/features/defense-play/model/walkPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'

function 세는난수(): RandomPort & { readonly count: () => number } {
  let rolls = 0
  const inner = createFractionRandom(() => {
    rolls += 1
    return 0.5
  })
  return { ...inner, count: () => rolls }
}

const 루 = (first: boolean, second: boolean, third: boolean): BaseState => ({ first, second, third })
const 모든루: readonly BaseState[] = [false, true].flatMap((first) =>
  [false, true].flatMap((second) => [false, true].map((third) => 루(first, second, third))),
)

describe('볼넷 · 사구 밀어내기 판 — 종류 2 (0xb288c · 0x46418 · 0xa9e44 · 0x3d7b8 · 0x46664)', () => {
  it('진루 결과는 보통 길(밀어내기)과 같다 — 루 8 × 아웃 3 × 도루 출발 모든 조합, 아웃 · 송구 없음', () => {
    for (const bases of 모든루) {
      const occupied = ([1, 2, 3] as const).filter((base) => (base === 1 ? bases.first : base === 2 ? bases.second : bases.third))
      const stealSets: StealBase[][] = [[]]
      for (const base of occupied) for (const set of [...stealSets]) stealSets.push([...set, base])
      for (let outs = 0; outs <= 2; outs += 1) {
        for (const stealingFrom of stealSets) {
          const result = runWalkPlay({ batterHand: 0, bases, outs, pitchJudgement: 3, stealingFrom })
          const fixed = advanceRunners(bases, { kind: '볼넷' }, outs)
          expect(result.advance).toEqual({ bases: fixed.bases, runsScored: fixed.runsScored, outsAdded: 0 })
          expect(result.throwBase).toBe(-1)
          expect(result.resultCode).toBeNull()
        }
      }
    }
  })

  it('도루 출발 중이면 공 도착에서 곧장 연 판이다 — 3e0e4 → 3e114 0x17 (A-24), 아니면 0x12 대기 뒤 판', () => {
    const 도루 = runWalkPlay({ batterHand: 0, bases: 루(true, false, false), outs: 0, pitchJudgement: 4, stealingFrom: [1] })
    const 보통 = runWalkPlay({ batterHand: 0, bases: 루(true, false, false), outs: 0, pitchJudgement: 4 })
    expect(opensWalkPlayAtArrival(도루)).toBe(true)
    expect(opensWalkPlayAtArrival(보통)).toBe(false)
    expect('opensAtArrival' in 보통).toBe(false)
    // 진루는 같다 — 판이 서는 때만 다르다
    expect(도루.advance).toEqual(보통.advance)
    const 판 = runPitchArrivalPlay(
      { batterHand: 0, gameMode: 4, pitchJudgement: 3, stealingFrom: [1], bases: 루(true, false, false), outs: 2 },
      세는난수(),
    )
    expect(판?.kind).toBe(2)
    expect(판 !== null && opensWalkPlayAtArrival(판.result)).toBe(true)
  })

  it('판 안에서 난수를 하나도 안 쓴다 — 종류 2 의 도루 주자 리드는 틱 0(rand(0,9) 없음) · 포수가 손에 안 쥐어 CPU 송구가 없다', () => {
    const random = 세는난수()
    const play = runPitchArrivalPlay(
      {
        batterHand: 0,
        gameMode: 4,
        pitchJudgement: 3,
        stealingFrom: [1],
        bases: 루(true, false, true),
        outs: 1,
        defenseIsCpu: true,
        offenseIsCpu: false,
      },
      random,
    )
    // rollPassedBall 한 번뿐
    expect(random.count()).toBe(1)
    expect(play?.kind).toBe(2)
    expect(play !== null && arrivalApplicationOf(play)).toBe('freePass')
    expect(play?.callSoundId).toBeNull()
    expect(play?.recordIds).toEqual([])
  })

  it('타자주자가 목록 맨 앞(칸 0)에서 타석 자리 → 1루로 달리고, 다 선 뒤 관문 17 그림(+0x120 이 그림마다 3)에 닫힌다', () => {
    const result = runWalkPlay({ batterHand: 0, bases: EMPTY_BASES, outs: 0, pitchJudgement: 4, runAbility: 500 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([0])
    expect(result.ticks[0].runners[0]).toMatchObject({ base: 1, isAdvancing: true })
    // 속도 335 · 우타 타석 자리(19300, 29345) → 1루는 한 걸음이 맨해튼 거리(11816, 0xbf158 → 0xbfa2c)로 나눈 몫이라 35 틱째에 닿는다
    // — 그 뒤 17 그림. 세기는 도착 뒤 G2 부터라 마지막이 G2 에 떨어져 G1 이 열린 그림(목록 틱 · 카메라만 도는 그림,
    // `closingListFrame`)이 하나 더 붙는다
    expect(result.ticks).toHaveLength(53)
    expect(result.ticks.at(-1)?.closingListFrame).toBe(true)
    expect(result.ticks.slice(0, -1).some((view) => view.closingListFrame === true)).toBe(false)
    expect(result.pitchJudgement).toBe(4)
    expect(isWalkPlayResult(result)).toBe(true)
    expect(acceptsWalkPlaySkipKey(result)).toBe(true)
  })

  it('공은 투수판(0xd7c24 = (20000, 0, 24500)) 땅 위에 놓여 있다 — 0xa276c(공, 2)', () => {
    const result = runWalkPlay({ batterHand: 0, bases: EMPTY_BASES, outs: 0, pitchJudgement: 3 })
    expect(result.ticks[0].ball).toMatchObject({ x: 20000, z: 24500, height: 0, isFlying: false })
  })

  it('밀리는 1루 주자는 6 틱 리드로 2루 쪽에 나가 있고, 안 밀리는 2루 주자(도루 아님)는 13 틱 나갔다가 제 루로 돌아오는 중이다', () => {
    const result = runWalkPlay({ batterHand: 0, bases: 루(true, false, false), outs: 0, pitchJudgement: 3, runAbility: 500 })
    expect(result.ticks[0].runners[1]).toMatchObject({ base: 2, isAdvancing: true })
    const alone = runWalkPlay({ batterHand: 0, bases: 루(false, true, false), outs: 0, pitchJudgement: 3, runAbility: 500 })
    expect(alone.ticks[0].runners[1]).toMatchObject({ base: 2, isAdvancing: false })
  })

  it('안 밀리는 도루 주자는 0x46664 가 제 루로 되돌린다 — 2루 단독 도루 + 볼넷은 2루에 그대로(리드 틱 0 이라 루 위)', () => {
    const result = runWalkPlay({ batterHand: 0, bases: 루(false, true, false), outs: 0, pitchJudgement: 3, stealingFrom: [2] })
    expect(result.ticks[0].runners[1]).toMatchObject({ x: 20000, z: 19170, base: 2 })
    expect(result.advance.bases).toEqual(루(true, true, false))
  })

  it('만루면 3루 주자가 홈을 밟아 1점(메시지 0x13) — 2아웃이어도 타자주자가 살아 1루로 가는 중이라 보류가 없다', () => {
    const result = runWalkPlay({ batterHand: 0, bases: 루(true, true, true), outs: 2, pitchJudgement: 3 })
    expect(result.advance.runsScored).toBe(1)
    expect(result.voidedRuns).toBe(0)
  })
})

describe('밀어내기 판의 타자주자도 타석 자리에서 뛴다 — 0x4650e 0xa93ac a9446 → vt94 0xa0884 (r326)', () => {
  it('좌타(손 1)는 홈 x+700 · 우타(손 0)는 x−700, 둘 다 z−100 — 좌타는 1루가 가까워 31 틱 · 우타 35 틱에 닿는다', () => {
    const 판 = (batterHand: number) => runWalkPlay({ batterHand, bases: EMPTY_BASES, outs: 0, pitchJudgement: 3, runAbility: 500 })
    expect(판(1).ticks[0].runners[0]).toMatchObject({ x: 20_700, z: 29_345 })
    expect(판(0).ticks[0].runners[0]).toMatchObject({ x: 19_300, z: 29_345 })
    const 닿는틱 = (batterHand: number) => 판(batterHand).ticks.findIndex((view) => !view.runners[0].isAdvancing)
    expect(닿는틱(1)).toBe(31)
    expect(닿는틱(0)).toBe(35)
    expect(판(1).ticks).toHaveLength(49)
    // 진루는 손과 무관하게 보통 길(밀어내기)과 같다
    expect(판(1).advance).toEqual(판(0).advance)
  })
})
