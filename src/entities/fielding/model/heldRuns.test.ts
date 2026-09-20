import { describe, expect, it } from 'vitest'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { createRunner } from '@/entities/fielding/model/fieldingState'
import {
  EMPTY_HELD_RUNS,
  onRunnerReachesHome,
  releaseHeldRuns,
  resetHeldRuns,
  runsAfterTwoOutRule,
  shouldHoldRun,
} from '@/entities/fielding/model/heldRuns'

const 주력500 = runnerSpeedOf(500)
/** 1루로 살아서 뛰고 있는 타자주자 */
const 살아있는타자주자 = createRunner(0, 0, 주력500, { targetBase: 1, isBatterRunner: true })
const 아웃된타자주자 = { ...살아있는타자주자, isOut: true }

describe('2아웃 득점 보류 — state[0] (S2 ②절)', () => {
  it('보류 판정표', () => {
    const 표: readonly [string, number, boolean, typeof 살아있는타자주자 | undefined, boolean, boolean][] = [
      // [설명, 아웃, 공이 땅에 닿음, 타자주자, 득점한 주자가 타자주자 자신, 보류인가]
      ['1아웃이면 바로 득점', 1, true, 아웃된타자주자, false, false],
      ['공이 안 닿았으면 바로 득점(뜬공)', 2, false, 아웃된타자주자, false, false],
      ['득점한 주자가 타자주자 자신이면 바로 득점', 2, true, 아웃된타자주자, true, false],
      ['2아웃 땅볼 + 타자주자가 아웃 → 보류', 2, true, 아웃된타자주자, false, true],
      ['2아웃 땅볼 + 타자주자가 아직 살아 뛰는 중 → 바로 득점', 2, true, 살아있는타자주자, false, false],
    ]
    표.forEach(([, outs, ballOnGround, batterRunner, scoringRunnerIsBatterRunner, held]) => {
      expect(shouldHoldRun({ outs, ballOnGround, batterRunner, scoringRunnerIsBatterRunner })).toBe(held)
    })
  })

  it('보류면 점수판이 안 오르고 state[0] 만 오른다', () => {
    const 뒤 = onRunnerReachesHome(EMPTY_HELD_RUNS, {
      outs: 2,
      ballOnGround: true,
      batterRunner: 아웃된타자주자,
      scoringRunnerIsBatterRunner: false,
    })
    expect(뒤).toEqual({ heldRuns: 1, scoreboardRuns: 0 })
  })

  it('즉시 득점이면 메시지 0x13 으로 점수판이 오른다', () => {
    const 뒤 = onRunnerReachesHome(EMPTY_HELD_RUNS, {
      outs: 1,
      ballOnGround: true,
      batterRunner: 살아있는타자주자,
      scoringRunnerIsBatterRunner: false,
    })
    expect(뒤).toEqual({ heldRuns: 0, scoreboardRuns: 1 })
  })
})

describe('보류 해제 — 0xaa34c', () => {
  const 보류2 = { heldRuns: 2, scoreboardRuns: 0 }

  it('**3아웃이면 영영 안 푼다 = 득점 무효**', () => {
    const 뒤 = releaseHeldRuns(보류2, {
      outs: 3,
      ballOnGround: true,
      batterRunner: 아웃된타자주자,
      someRunnerStillActive: false,
    })
    expect(뒤).toEqual(보류2)
    // 다음 플레이 초기화(0xb67d0)가 보류분을 버린다
    expect(resetHeldRuns(뒤)).toEqual({ heldRuns: 0, scoreboardRuns: 0 })
  })

  it('아웃이 2 이하고 기다릴 이유가 없으면 보류분을 한꺼번에 올린다', () => {
    const 뒤 = releaseHeldRuns(보류2, {
      outs: 2,
      ballOnGround: true,
      batterRunner: 살아있는타자주자,
      someRunnerStillActive: true,
    })
    expect(뒤).toEqual({ heldRuns: 0, scoreboardRuns: 2 })
  })

  it('아직 정리 안 된 주자가 있고 타자주자가 아웃이면 계속 보류한다', () => {
    const 뒤 = releaseHeldRuns(보류2, {
      outs: 2,
      ballOnGround: true,
      batterRunner: 아웃된타자주자,
      someRunnerStillActive: true,
    })
    expect(뒤).toEqual(보류2)
  })

  it('보류분이 없으면 아무 일도 안 한다', () => {
    expect(
      releaseHeldRuns(EMPTY_HELD_RUNS, {
        outs: 3,
        ballOnGround: true,
        batterRunner: undefined,
        someRunnerStillActive: false,
      }),
    ).toBe(EMPTY_HELD_RUNS)
  })
})

describe('타석 단위 엔진에 옮길 때의 같은 결과 규칙 (S2 2-5)', () => {
  it('땅볼로 타자주자가 아웃되며 3아웃이 되면 그 타석 득점은 0 이다', () => {
    expect(runsAfterTwoOutRule(2, { outsAfter: 3, ballOnGround: true, batterRunnerOut: true })).toBe(0)
    expect(runsAfterTwoOutRule(2, { outsAfter: 3, ballOnGround: false, batterRunnerOut: true })).toBe(2)
    expect(runsAfterTwoOutRule(2, { outsAfter: 2, ballOnGround: true, batterRunnerOut: true })).toBe(2)
    expect(runsAfterTwoOutRule(2, { outsAfter: 3, ballOnGround: true, batterRunnerOut: false })).toBe(2)
  })
})
