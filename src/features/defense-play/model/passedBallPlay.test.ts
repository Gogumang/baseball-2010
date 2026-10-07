import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { createRunner } from '@/entities/fielding/model/fieldingState'
import { passedBallStrikeoutOf } from '@/entities/fielding/model/passedBall'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  isPassedBallPlayResult,
  passedBallCallSoundIdOf,
  passedBallCovers,
  passedBallTrajectoryOf,
  runPassedBallPlay,
} from '@/features/defense-play/model/passedBallPlay'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlayEngine'
import { runStealPlay } from '@/features/defense-play/model/stealPlay'

function 세는난수(ratio: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    next: () => {
      rolls += 1
      return ratio
    },
    nextInRange: (minimum, maximum) => {
      rolls += 1
      return minimum + ratio * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
    count: () => rolls,
  }
}

const 가운데 = { angle: 95, strength: 220, verticalSpeed: -100 }
const 짧은 = { angle: 95, strength: 150, verticalSpeed: -100 }
const 만루 = { first: true, second: true, third: true }

describe('낫아웃 갈래 0x3e09e~0x3e0e0 — 종류 9 안에서만', () => {
  it('삼진이 아니면 없음 · 1루 주자가 있고 1아웃 이하면 삼진 그대로 · 아니면 타자가 뛴다', () => {
    expect(passedBallStrikeoutOf({ pitchJudgement: 1, firstBaseOccupied: false, outs: 0 })).toBe('none')
    expect(passedBallStrikeoutOf({ pitchJudgement: 5, firstBaseOccupied: true, outs: 1 })).toBe('strikeoutStands')
    expect(passedBallStrikeoutOf({ pitchJudgement: 5, firstBaseOccupied: true, outs: 2 })).toBe('batterRuns')
    expect(passedBallStrikeoutOf({ pitchJudgement: 5, firstBaseOccupied: false, outs: 0 })).toBe('batterRuns')
  })
})

describe('폭투·포일 한 판 — 종류 9 (0x3507c · 0xb284a)', () => {
  it('공은 홈플레이트 뒤쪽으로 간다 — 0x3507c 의 부호 없는 각(S8 5-4)', () => {
    for (const angle of [60, 95, 130]) {
      const trajectory = passedBallTrajectoryOf({ angle, strength: 220, verticalSpeed: -100 })
      const last = trajectory.pointAt(trajectory.length - 1)
      expect(last.z, `${angle}°`).toBeGreaterThan(basePosition(0).z)
    }
  })

  it('포수가 쫓아 줍는다 — P+0x112 = 1 로 시작해 바운드 전에 잡아도 뜬공 아웃이 아니다', () => {
    const result = runPassedBallPlay({ shot: 가운데, bases: EMPTY_BASES, outs: 0 })
    expect(result.catchFielderSlot).toBe(1)
    expect(result.caughtOnTheFly).toBe(false)
    expect(result.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 0 })
    expect(result.resultCode).toBeNull()
    expect(passedBallCallSoundIdOf(result)).toBeNull()
  })

  it('낫아웃이면 타자주자가 맨 앞(0번)에 서고 사람이 1루로 던지면 포스(결과 2)로 잡힌다 — 콜 20', () => {
    // 예보 n 은 포수가 건너뛴 4틱을 안 센다(b13ec 가 n++ 앞) — 가운데(220)는 포수가 15틱에야 주워 1루가 늦다. 짧게 튄 공으로
    const result = runPassedBallPlay({ shot: 짧은, bases: EMPTY_BASES, outs: 0, batterRuns: true, manualThrowBase: 1 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([0])
    expect(result.throwBase).toBe(1)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
    expect(result.tagOut).toBe(false)
    expect(passedBallCallSoundIdOf(result)).toBe(20)
    expect(result.runnerFates).toEqual([{ fromBase: 0, scored: false, retired: true }])
  })

  it('주자 목록은 찬 루 오름차순 — 낫아웃 타자주자가 없으면 번호는 1 부터', () => {
    const result = runPassedBallPlay({ shot: 가운데, bases: 만루, outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1, 2, 3])
  })

  it('난수는 줍는 순간 펌블 굴림(0xb41d0) 한 번 — 송구가 나가면 악송구 굴림 · 긴 송구 흔들림 굴림 · 받는 펌블 굴림이 더', () => {
    const quiet = 세는난수(0.9)
    runPassedBallPlay({ shot: 가운데, bases: EMPTY_BASES, outs: 0, random: quiet })
    expect(quiet.count()).toBe(1)
    const throwing = 세는난수(0.9)
    runPassedBallPlay({ shot: 가운데, bases: EMPTY_BASES, outs: 0, batterRuns: true, random: throwing, manualThrowBase: 1 })
    // 줍기 펌블(b4224) · 악송구(a1828) · 흔들림(a198c — 투수가 1루까지 8200 넘게 던진다) · 받는 1루수의 펌블(b4224)
    expect(throwing.count()).toBe(4)
    // 키 없는 사람 수동 송구는 던지지 않는다 — 낫아웃 타자주자는 1루에 산다
    const holding = 세는난수(0.9)
    const kept = runPassedBallPlay({ shot: 가운데, bases: EMPTY_BASES, outs: 0, batterRuns: true, random: holding })
    expect(holding.count()).toBe(1)
    expect(kept.throwBase).toBe(-1)
    expect(kept.advance.bases.first).toBe(true)
  })

  it('커버 — 포수가 쫓으면 홈은 투수가 맡되 홈으로 올 주자가 없으면 비운다 (0xb1d48 · 0xb1b88)', () => {
    expect(passedBallCovers(1, false, [])).toEqual([-1, 2, 3, 4])
    expect(passedBallCovers(1, false, [createRunner(1, 3, 335)])).toEqual([0, 2, 3, 4])
    // 2루 주자는 3루로 가는 중일 때만 "홈으로 올 주자" 다 (r−2 갈래)
    expect(passedBallCovers(1, true, [createRunner(1, 2, 335)])).toEqual([-1, 2, 5, 4])
    expect(passedBallCovers(1, true, [createRunner(1, 2, 335, { targetBase: 3 })])).toEqual([0, 2, 5, 4])
  })

  it('재생 칸에 든 결과가 폭투·포일 판인지 가를 수 있다 — 도루 판은 아니다', () => {
    expect(isPassedBallPlayResult(runPassedBallPlay({ shot: 가운데, bases: EMPTY_BASES, outs: 0 }))).toBe(true)
    expect(isPassedBallPlayResult(runStealPlay({ bases: { ...EMPTY_BASES, first: true }, stealingFrom: [1], outs: 0 }))).toBe(false)
    expect(isPassedBallPlayResult(null)).toBe(false)
  })
})
