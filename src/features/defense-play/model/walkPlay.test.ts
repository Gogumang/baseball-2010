import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advanceRunners, EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { arrivalApplicationOf, runPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { acceptsWalkPlaySkipKey, isWalkPlayResult, runWalkPlay } from '@/features/defense-play/model/walkPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'

function 세는난수(): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    next: () => {
      rolls += 1
      return 0.5
    },
    nextInRange: (minimum, maximum) => {
      rolls += 1
      return minimum + 0.5 * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
    count: () => rolls,
  }
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
          const result = runWalkPlay({ bases, outs, pitchJudgement: 3, stealingFrom })
          const fixed = advanceRunners(bases, { kind: '볼넷' }, outs)
          expect(result.advance).toEqual({ bases: fixed.bases, runsScored: fixed.runsScored, outsAdded: 0 })
          expect(result.throwBase).toBe(-1)
          expect(result.resultCode).toBeNull()
        }
      }
    }
  })

  it('판 안에서 난수를 하나도 안 쓴다 — 종류 2 의 도루 주자 리드는 틱 0(rand(0,9) 없음) · 포수가 손에 안 쥐어 CPU 송구가 없다', () => {
    const random = 세는난수()
    const play = runPitchArrivalPlay(
      { gameMode: 4, pitchJudgement: 3, stealingFrom: [1], bases: 루(true, false, true), outs: 1, defenseIsCpu: true, offenseIsCpu: false },
      random,
    )
    // rollPassedBall 한 번뿐
    expect(random.count()).toBe(1)
    expect(play?.kind).toBe(2)
    expect(play !== null && arrivalApplicationOf(play)).toBe('freePass')
    expect(play?.callSoundId).toBeNull()
    expect(play?.recordIds).toEqual([])
  })

  it('타자주자가 목록 맨 앞(칸 0)에서 홈 → 1루로 달리고, 다 선 뒤 관문 17 그림(+0x120 이 그림마다 3)에 닫힌다', () => {
    const result = runWalkPlay({ bases: EMPTY_BASES, outs: 0, pitchJudgement: 4, runAbility: 500 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([0])
    expect(result.ticks[0].runners[0]).toMatchObject({ base: 1, isAdvancing: true })
    // 속도 335 · 홈 → 1루 7772 → 24 틱째에 닿는다 — 그 뒤 17 그림
    expect(result.ticks).toHaveLength(41)
    expect(result.pitchJudgement).toBe(4)
    expect(isWalkPlayResult(result)).toBe(true)
    expect(acceptsWalkPlaySkipKey(result)).toBe(true)
  })

  it('공은 투수판(0xd7c24 = (20000, 0, 24500)) 땅 위에 놓여 있다 — 0xa276c(공, 2)', () => {
    const result = runWalkPlay({ bases: EMPTY_BASES, outs: 0, pitchJudgement: 3 })
    expect(result.ticks[0].ball).toMatchObject({ x: 20000, z: 24500, height: 0, isFlying: false })
  })

  it('밀리는 1루 주자는 6 틱 리드로 2루 쪽에 나가 있고, 안 밀리는 2루 주자(도루 아님)는 13 틱 나갔다가 제 루로 돌아오는 중이다', () => {
    const result = runWalkPlay({ bases: 루(true, false, false), outs: 0, pitchJudgement: 3, runAbility: 500 })
    expect(result.ticks[0].runners[1]).toMatchObject({ base: 2, isAdvancing: true })
    const alone = runWalkPlay({ bases: 루(false, true, false), outs: 0, pitchJudgement: 3, runAbility: 500 })
    expect(alone.ticks[0].runners[1]).toMatchObject({ base: 2, isAdvancing: false })
  })

  it('안 밀리는 도루 주자는 0x46664 가 제 루로 되돌린다 — 2루 단독 도루 + 볼넷은 2루에 그대로(리드 틱 0 이라 루 위)', () => {
    const result = runWalkPlay({ bases: 루(false, true, false), outs: 0, pitchJudgement: 3, stealingFrom: [2] })
    expect(result.ticks[0].runners[1]).toMatchObject({ x: 20000, z: 19170, base: 2 })
    expect(result.advance.bases).toEqual(루(true, true, false))
  })

  it('만루면 3루 주자가 홈을 밟아 1점(메시지 0x13) — 2아웃이어도 타자주자가 살아 1루로 가는 중이라 보류가 없다', () => {
    const result = runWalkPlay({ bases: 루(true, true, true), outs: 2, pitchJudgement: 3 })
    expect(result.advance.runsScored).toBe(1)
    expect(result.voidedRuns).toBe(0)
  })
})
