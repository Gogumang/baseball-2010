import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { passedBallTrajectoryOf, runPassedBallPlay } from '@/features/defense-play/model/passedBallPlay'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'

/** 높이가 0 · 30 · 0 · 30 … 으로 튀는 궤적 */
const 튀는궤적 = {
  length: 10,
  pointAt: (tick: number) => ({ x: 0, y: tick % 2 === 0 ? 0 : 30, z: 0 }),
} as unknown as BattedBallTrajectory

const 기본 = { trajectory: 튀는궤적, onTrajectory: true, bigHitWatch: false, playKind: 9, resultCode: null }

describe('공 그리기 0x36dfc 의 파티클 조건 — 판 종류를 안 본다 (0x46c88 46cce)', () => {
  it('공+0x68 이 0 인 그림(깐 그림)은 안 쏜다', () => {
    expect(ballParticleFactsOf({ ...기본, ballTick: 0, at: 4 })).toBeNull()
  })

  it('주자 판(종류 9)도 튐 갈래를 본다 — 다음 점 높이, 궤적 끝 점이면 null', () => {
    expect(ballParticleFactsOf({ ...기본, ballTick: 2, at: 4 })).toEqual({ bigHit: false, bounceNextHeight: 30 })
    expect(ballParticleFactsOf({ ...기본, ballTick: 7, at: 9 })?.bounceNextHeight).toBeNull()
  })

  it('큰 타구 갈래는 판 종류 1 · 8 만 (36f84~36f92)', () => {
    for (const playKind of [2, 4, 5, 9]) {
      expect(ballParticleFactsOf({ ...기본, bigHitWatch: true, playKind, ballTick: 1, at: 1 })?.bigHit).toBe(false)
    }
    expect(ballParticleFactsOf({ ...기본, bigHitWatch: true, playKind: 1, ballTick: 1, at: 1 })?.bigHit).toBe(true)
  })

  it('결과 코드 9~11 · 24~26 은 튐을 안 쏜다', () => {
    for (const resultCode of [9, 10, 11, 24, 25, 26]) {
      expect(ballParticleFactsOf({ ...기본, resultCode, ballTick: 2, at: 2 })?.bounceNextHeight).toBeNull()
    }
  })
})

describe('주자 판 스냅샷의 파티클 조건', () => {
  it('폭투 · 포일 판 — 쫓는 공이 굴러가는 그림은 다음 점 높이를 싣는다(판 틱으로 읽는 궤적)', () => {
    const shot = { angle: 95, strength: 220, verticalSpeed: -100 }
    const result = runPassedBallPlay({ batterHand: 0, shot, bases: EMPTY_BASES, outs: 0 })
    const trajectory = passedBallTrajectoryOf(shot)
    const flying = result.ticks.filter((view) => view.ballParticles != null)
    expect(flying.length).toBeGreaterThan(0)
    for (const view of flying) {
      expect(view.ballParticles?.bigHit).toBe(false)
    }
    // 판 시작 공은 판 틱 0 부터 — 틱 1 그림의 다음 점은 궤적 2 번 점
    const first = result.ticks[1]
    if (first?.ballParticles != null && first.ballParticles.bounceNextHeight !== null) {
      expect(first.ballParticles.bounceNextHeight).toBe(trajectory.pointAt(2).y)
    }
    // 쥔 공 · 깐 그림은 안 쏜다
    expect(result.ticks[0]?.ballParticles ?? null).toBeNull()
  })

  it('견제 판 — 송구가 나는 동안만 조건을 싣고, 쥔 뒤로는 없다', () => {
    const result = runPickoffPlay({ targetBase: 1, bases: { ...EMPTY_BASES, first: true }, outs: 0 })
    const last = result.ticks[result.ticks.length - 1]
    expect(last?.ballParticles ?? null).toBeNull()
    expect(result.ticks.some((view) => view.ballParticles != null)).toBe(true)
  })
})

describe('주자 판이 보는 경기 +0xfd4 (`sceneResultCode`)', () => {
  it('견제 판 — 앞 공의 결과 코드 9~11 이면 튐을 안 쏘고, 모든 틱에 그 값을 싣는다', () => {
    const 견제 = (sceneResultCode: number | null) =>
      runPickoffPlay({ targetBase: 1, bases: { ...EMPTY_BASES, first: true }, outs: 0, sceneResultCode })
    const 파울뒤 = 견제(10)
    expect(파울뒤.ticks.every((view) => view.sceneResultCode === 10)).toBe(true)
    expect(파울뒤.ticks.every((view) => (view.ballParticles?.bounceNextHeight ?? null) === null)).toBe(true)
    expect(견제(25).ticks[0]?.sceneResultCode).toBe(25)
    // 안 휘두른 앞 공(0) · 정해지지 않은 값(null)은 거르지 않는다 — 같은 판
    expect(견제(0).ticks.map((view) => view.ballParticles)).toEqual(견제(null).ticks.map((view) => view.ballParticles))
  })

  it('폭투 · 포일 판 — 넘긴 값을 그대로 싣는다', () => {
    const shot = { angle: 95, strength: 220, verticalSpeed: -100 }
    const result = runPassedBallPlay({ batterHand: 0, shot, bases: EMPTY_BASES, outs: 0, sceneResultCode: 0 })
    expect(result.ticks.every((view) => view.sceneResultCode === 0)).toBe(true)
  })
})
