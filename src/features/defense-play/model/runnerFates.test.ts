import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import {
  baserunnerAllowedOfFates,
  chargedRunsOfFates,
  runnerFatesWithoutPlay,
  type RunnerFate,
} from '@/features/defense-play/model/runnerFates'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 뜬공아웃: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
const 주자3루: BaseState = { first: false, second: false, third: true }
const 주자13루: BaseState = { first: true, second: false, third: true }
const 만루: BaseState = { first: true, second: true, third: true }
const 깊은뜬공: BattedBallPattern = [90, 900, 1500, 0]

const fate = (fromBase: number, scored: boolean, retired: boolean): RunnerFate => ({ fromBase, scored, retired })

function play(outcome: AtBatOutcome, bases: BaseState, outs: number, pattern?: BattedBallPattern) {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(pattern ?? representativePatternOf(outcome)),
    bases,
    outs,
  })
}

describe('주자 운명 목록 — 정산 0xa8024 가 읽는 +0x95·+0x96', () => {
  it('타구 진행기: 목록은 [타자주자, 찬 루 오름차순] 이다 (0xa9a10 + 0x46418/0xa93ac)', () => {
    const 결과 = play(단타, 주자13루, 0)
    expect(결과.runnerFates.map((one) => one.fromBase)).toEqual([0, 1, 3])
  })

  it('홈을 밟은 주자는 +0x95 와 +0x96 이 둘 다 선다 (0xaa1b0/0xaa1cc → 0xa9520)', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 깊은뜬공)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.runnerFates).toEqual([fate(0, false, true), fate(3, true, true)])
  })

  it('2아웃 보류가 3아웃으로 날아가도 그 주자의 +0x95 는 남는다 (0xaa1cc 는 점수판을 안 건드린다)', () => {
    const 결과 = play(뜬공아웃, 주자3루, 2, 깊은뜬공)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.voidedRuns).toBeGreaterThanOrEqual(1)
    expect(결과.runnerFates).toEqual([fate(0, false, true), fate(3, true, true)])
    // 그런데 3아웃이고 목록 0번(잡힌 타자)이 끝났으니 R+0x128 은 안 센다
    expect(chargedRunsOfFates(결과.runnerFates, 3)).toBe(0)
  })

  it('3아웃이 아닌 플레이는 +0x95 수가 점수판 득점과 같다 (보류는 3아웃에서만 날아간다)', () => {
    const outcomes: AtBatOutcome[] = [땅볼아웃, 뜬공아웃, 단타, { kind: '안타', bases: 2 }, { kind: '안타', bases: 3 }]
    for (const outcome of outcomes) {
      for (const pattern of Object.values(BATTED_BALL_PATTERNS).flat().slice(0, 60)) {
        const 결과 = play(outcome, 만루, 0, pattern)
        if (결과.advance.outsAdded >= 3) continue
        const scored = 결과.runnerFates.filter((one) => one.scored).length
        expect(scored, `${outcome.kind} ${pattern.join(',')}`).toBe(결과.advance.runsScored)
        expect(결과.runnerFates.map((one) => one.fromBase)).toEqual([0, 1, 2, 3])
      }
    }
  })

  it('견제: 타자주자 없이 찬 루 오름차순, 루에 붙은 주자는 아무 표시도 없다', () => {
    const 결과 = runPickoffPlay({ targetBase: 1, bases: 주자13루, outs: 0, offenseIsCpu: true })
    expect(결과.runnerFates).toEqual([fate(1, false, false), fate(3, false, false)])
  })

  it('홈런 재생: 타자주자와 주자 전원이 득점·처리 끝', () => {
    const 결과 = homeRunPlaybackOf({ outcome: { kind: '홈런' }, bases: 주자3루 })
    expect(결과?.runnerFates).toEqual([fate(0, true, true), fate(3, true, true)])
  })
})

describe('진행기를 안 도는 결과 — runnerFatesWithoutPlay', () => {
  it('삼진은 타자주자가 목록에 없다 (0xae24c 가 0x17 없이 정산한다)', () => {
    expect(runnerFatesWithoutPlay(주자3루, { kind: '삼진' })).toEqual([fate(3, false, false)])
    expect(runnerFatesWithoutPlay(EMPTY_BASES, { kind: '삼진' })).toEqual([])
  })

  it('볼넷·사구는 타자주자가 맨 앞에 들고, 만루면 3루 주자만 득점한다 (종류 2)', () => {
    expect(runnerFatesWithoutPlay(주자13루, { kind: '볼넷' })).toEqual([
      fate(0, false, false),
      fate(1, false, false),
      fate(3, false, false),
    ])
    expect(runnerFatesWithoutPlay(만루, { kind: '사구' })).toEqual([
      fate(0, false, false),
      fate(1, false, false),
      fate(2, false, false),
      fate(3, true, true),
    ])
  })

  it('인플레이 타구는 받지 않는다', () => {
    expect(() => runnerFatesWithoutPlay(만루, 단타)).toThrow()
  })
})

describe('R+0x128 · R+0x130 셈', () => {
  it('R+0x128: 3아웃이고 목록 0번이 끝났으면 0, 아니면 +0x95 수 (0xa8ec0)', () => {
    const 두득점 = [fate(0, false, false), fate(2, true, true), fate(3, true, true)]
    expect(chargedRunsOfFates(두득점, 2)).toBe(2)
    // 3아웃이지만 목록 0번(타자주자)이 살았다 — 보류됐다 날아간 득점까지 센다
    expect(chargedRunsOfFates(두득점, 3)).toBe(2)
    const 타자아웃 = [fate(0, false, true), fate(3, true, true)]
    expect(chargedRunsOfFates(타자아웃, 3)).toBe(0)
    expect(chargedRunsOfFates(타자아웃, 2)).toBe(1)
  })

  it('R+0x130: 마지막 원소의 +0x96 이 꺼져 있으면 1, 빈 목록은 0 (0xa8c5c~0xa8c86)', () => {
    expect(baserunnerAllowedOfFates([])).toBe(false)
    expect(baserunnerAllowedOfFates([fate(0, false, false)])).toBe(true)
    expect(baserunnerAllowedOfFates([fate(0, false, false), fate(3, true, true)])).toBe(false)
    expect(baserunnerAllowedOfFates([fate(0, false, true), fate(2, false, false)])).toBe(true)
  })
})
