import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { passedBallStrikeoutOf } from '@/entities/fielding/model/passedBall'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  isPassedBallPlayResult,
  passedBallCallSoundIdOf,
  passedBallPlayEngineInputOf,
  passedBallTrajectoryOf,
  runPassedBallPlay,
} from '@/features/defense-play/model/passedBallPlay'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlayEngine'
import { runStealPlay } from '@/features/defense-play/model/stealPlay'

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

  it('공은 타구와 같은 쏘기 길이다 — 0xbef58(공, 0xcfb70) 자리에서 메시지 0x11 의 덱 없는 갈래(51172)로 (r305)', () => {
    // 0x3507c 가 +0xfcc 를 인자로 넘기면 0x50faa 는 51040~51058 에서 공을 (20000, 1000, 30000) 에 놓고 그 칸으로 쏜다
    const trajectory = passedBallTrajectoryOf(가운데)
    expect(trajectory.pointAt(0)).toEqual({ x: 20000, y: 1000, z: 30000 })
    // 수직 −100 이라 첫 틱부터 내려가고(0xa2870 의 ±c), 각 95 는 홈플레이트 뒤쪽(z 증가)
    expect(trajectory.pointAt(1).y).toBeLessThan(1000)
    expect(trajectory.pointAt(1).z).toBeGreaterThan(30000)
  })

  it('포수가 쫓아 줍는다 — P+0x112 = 1 로 시작해 바운드 전에 잡아도 뜬공 아웃이 아니다', () => {
    const result = runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0 })
    expect(result.catchFielderSlot).toBe(1)
    expect(result.caughtOnTheFly).toBe(false)
    expect(result.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 0 })
    expect(result.resultCode).toBeNull()
    expect(passedBallCallSoundIdOf(result)).toBeNull()
  })

  it('낫아웃이면 타자주자가 맨 앞(0번)에 서고 사람이 1루로 던지면 포스(결과 2)로 잡힌다 — 콜 20', () => {
    // 예보 n 은 포수가 건너뛴 4틱을 안 센다(b13ec 가 n++ 앞) — 가운데(220)는 포수가 15틱에야 주워 1루가 늦다. 짧게 튄 공으로
    const result = runPassedBallPlay({ batterHand: 0, shot: 짧은, bases: EMPTY_BASES, outs: 0, batterRuns: true, manualThrowBase: 1 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([0])
    expect(result.throwBase).toBe(1)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
    expect(result.tagOut).toBe(false)
    expect(passedBallCallSoundIdOf(result)).toBe(20)
    expect(result.runnerFates).toEqual([{ fromBase: 0, scored: false, retired: true }])
  })

  it('주자 목록은 찬 루 오름차순 — 낫아웃 타자주자가 없으면 번호는 1 부터', () => {
    const result = runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: 만루, outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1, 2, 3])
  })

  it('난수는 줍는 순간 펌블 굴림(0xb41d0) 한 번 — 송구가 나가면 악송구 굴림 · 긴 송구 흔들림 굴림 · 받는 펌블 굴림이 더', () => {
    const quiet = 세는난수(0.9)
    runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0, random: quiet })
    expect(quiet.count()).toBe(1)
    const throwing = 세는난수(0.9)
    runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0, batterRuns: true, random: throwing, manualThrowBase: 1 })
    // 줍기 펌블(b4224) · 악송구(a1828) · 흔들림(a198c — 투수가 1루까지 8200 넘게 던진다) · 받는 1루수의 펌블(b4224)
    expect(throwing.count()).toBe(4)
    // 키 없는 사람 수동 송구는 던지지 않는다 — 낫아웃 타자주자는 1루에 산다
    const holding = 세는난수(0.9)
    const kept = runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0, batterRuns: true, random: holding })
    expect(holding.count()).toBe(1)
    expect(kept.throwBase).toBe(-1)
    expect(kept.advance.bases.first).toBe(true)
  })

  it('판 시작 커버 b2884 vt30 — 포수가 쫓으면 홈은 투수가 맡되 홈으로 올 주자가 없으면 비운다 (0xb1d48 · 0xb1b88 · r162)', () => {
    const coversOf = (bases: typeof EMPTY_BASES, stealingFrom?: readonly (1 | 2 | 3)[]) =>
      passedBallPlayEngineInputOf({ batterHand: 0, shot: 가운데, bases, outs: 0, stealingFrom }).play.coverOfBase
    const start = passedBallPlayEngineInputOf({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0 })
    expect(start.play.ballHolderSlot).toBe(1)
    // 공 첫 점 = 표준 배팅 지점(0xd8758)이라 2루는 b1e12 규칙 — 폭투 공 각(+95) + 90 > 0 → 유격수
    expect(coversOf(EMPTY_BASES)).toEqual([-1, 2, 5, 4])
    expect(coversOf({ ...EMPTY_BASES, third: true })).toEqual([0, 2, 5, 4])
    // 2루 주자는 3루로 가는 중일 때만 "홈으로 올 주자" 다 (r−2 갈래) — 판 시작 vt30 은 리드(0x3d7b8) 앞이라 도루 목표(0xa9bd4)만 본다
    expect(coversOf({ ...EMPTY_BASES, second: true })).toEqual([-1, 2, 5, 4])
    expect(coversOf({ ...EMPTY_BASES, second: true }, [2])).toEqual([0, 2, 5, 4])
    // 투수는 홈 커버(AI 2) · 2루 커버가 아닌 2루수는 0xb203a 로 기본 자리 0xd8764[0] (AI 0xa)
    expect(start.fielders[3]?.target).toEqual({ x: 25_500, y: 0, z: 17_500 })
    expect(start.fielders[3]?.aiState).toBe(0xa)
  })

  it('재생 칸에 든 결과가 폭투·포일 판인지 가를 수 있다 — 도루 판은 아니다', () => {
    expect(isPassedBallPlayResult(runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: EMPTY_BASES, outs: 0 }))).toBe(true)
    expect(isPassedBallPlayResult(runStealPlay({ bases: { ...EMPTY_BASES, first: true }, stealingFrom: [1], outs: 0 }))).toBe(false)
    expect(isPassedBallPlayResult(null)).toBe(false)
  })
})

describe('폭투·포일 판 그림 칸 — 포수 +0xb8 = 6(0x3e062) · 고리', () => {
  it('판정이 적은 포수 +0xb8 = 6 은 첫 그림 앞 야수 틱이 줄여 5 부터 보이고, 틱마다 하나씩 준다', () => {
    const result = runPassedBallPlay({ batterHand: 0, shot: 가운데, bases: { ...EMPTY_BASES, first: true }, outs: 0 })
    const 포수 = (tick: number) => result.ticks[tick]?.fielders.find((fielder) => fielder.slot === 1)
    expect(포수(0)?.fumbleTicks).toBe(5)
    expect(포수(1)?.fumbleTicks).toBe(4)
    expect(포수(5)?.fumbleTicks).toBe(0)
    expect(result.ticks[0].holderMark).toBeNull()
    const 쥔틱 = result.ticks.find((view) => view.holderMark != null)
    expect(쥔틱?.holderMark?.anim).toBe(3)
  })
})

describe('판 시작 리드 0x3d7b8 — 종류 9 도 돈다 (0x46418 4657e)', () => {
  it('도루 안 한 주자는 0xcffb0 틱 앞서 나갔다가 목표를 제 루로 되돌린다 — 굴림 없음', () => {
    const 난수 = 세는난수(0)
    const 시작 = passedBallPlayEngineInputOf({ batterHand: 0, shot: 가운데, bases: { ...EMPTY_BASES, second: true }, outs: 0, random: 난수 })
    const 주자 = 시작.runners[0]
    expect(주자.startBase).toBe(2)
    expect(주자.targetBase).toBe(2)
    expect(주자.position).not.toEqual(basePosition(2))
    expect(난수.count()).toBe(0)
  })

  it('도루 주자는 rand(0,9) 한 번 · 목표는 다음 루 그대로 (0xcffa8 + 덧틱)', () => {
    const 난수 = 세는난수(0)
    const 시작 = passedBallPlayEngineInputOf({ batterHand: 0,
      shot: 가운데,
      bases: { ...EMPTY_BASES, first: true },
      outs: 0,
      random: 난수,
      stealingFrom: [1],
    })
    expect(시작.runners[0].targetBase).toBe(2)
    expect(난수.count()).toBe(1)
  })

  it('낫아웃이면 0xa9e44 가 돌아 타자주자에 밀리는 1루 주자는 2루가 목표다 (2아웃)', () => {
    const 시작 = passedBallPlayEngineInputOf({ batterHand: 0,
      shot: 가운데,
      bases: { ...EMPTY_BASES, first: true, third: true },
      outs: 2,
      batterRuns: true,
    })
    expect(시작.runners.map((runner) => runner.targetBase)).toEqual([1, 2, 3])
  })
})

describe('낫아웃 타자주자는 타석 자리에서 뛴다 — 0x4650e 0xa93ac a9446 → vt94 0xa0884 (r326)', () => {
  it('좌타(손 1)는 홈 x+700 · 우타(손 0)는 x−700, 둘 다 z−100 — 구간 출발점은 홈 그대로', () => {
    const 첫자리 = (batterHand: number) =>
      passedBallPlayEngineInputOf({ batterHand, shot: 가운데, bases: EMPTY_BASES, outs: 0, batterRuns: true }).runners[0]
    expect(첫자리(1).position).toEqual({ x: 20_700, y: 0, z: 29_345 })
    expect(첫자리(0).position).toEqual({ x: 19_300, y: 0, z: 29_345 })
    expect(첫자리(1).legStart).toEqual(basePosition(0))
    expect(첫자리(1).isBatterRunner).toBe(true)
  })

  it('낫아웃이 아니면 타자주자가 없어 손이 판을 바꾸지 않는다', () => {
    const 판 = (batterHand: number) => runPassedBallPlay({ batterHand, shot: 가운데, bases: { first: true, second: false, third: false }, outs: 0 })
    expect(JSON.stringify(판(1).ticks)).toBe(JSON.stringify(판(0).ticks))
  })
})

