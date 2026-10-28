import { describe, expect, it } from 'vitest'
import {
  arrivePitch,
  cpuPickoff,
  resolveRunnerPlay,
  startGame,
  startPlayerOutcome,
  startSteal,
  type GameProgress,
} from '@/features/play-game/model/gameFlow'
import { runLiveRunnerPlayWithoutKeys, startLiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { BaseState } from '@/entities/game/model/baseState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'

/**
 * 타자편(모드 4)의 사람 공격 주루 키 0x5331c — 도루 · 폭투 · CPU 견제 판을 붙들어(`pendingRunnerPlay`) 화면이 실시간으로 돌린다.
 * 상태 0x17 키 0x53420 은 조작 [+0xc] == 0(사람 공격)이면 판 종류를 안 보고 주루(0x582 진루 · 0x584 귀루 → 0xa9b04)와
 * OK 슬라이딩 0x585 를 보낸다. 키를 안 누른 판은 미리 돌린 판과 결과 · 난수 차례가 같아야 한다.
 */

const 주자 = (progress: GameProgress, bases: BaseState): GameProgress => ({ ...progress, game: { ...progress.game, bases } })
const 일루 = { first: true, second: false, third: false }

/** 비교할 경기 칸 — 재생 칸(`lastDefensePlay`)만 다르다(실시간으로 본 판은 다시 안 넣는다) */
const 칸 = (progress: GameProgress) => ({
  game: progress.game,
  recordIds: progress.recordIds,
  myStats: progress.myStats,
  pitcherLines: progress.pitcherLines,
  popularityPoints: progress.popularityPoints,
  doublePlays: progress.doublePlays,
  scoringPositionOuts: progress.scoringPositionOuts,
  pendingSettlementEvents: progress.pendingSettlementEvents,
  defenseScene: progress.defenseScene,
  log: progress.log.map((entry) => entry.text),
})

describe('타자편 공 도착 판(도루 · 폭투)을 붙들어 사람 주루 키를 받는다 — 0x53420 → 0x5331c', () => {
  const 공 = (resolution: PitchResolution, outcomeAfter: AtBatOutcome | null) => ({ resolution, outcomeAfter, batterHand: 0 })

  it('live 면 도루 판(종류 5)을 붙든다 — 판이 도는 동안 경기 상태 · 다음 공은 그대로', () => {
    let held = 0
    for (let seed = 1; seed <= 20; seed += 1) {
      const 시작 = startGame(createSeededRandom(seed))
      const 출발 = startSteal(주자(시작, 일루), 1, createSeededRandom(0))
      const step = arrivePitch(출발, 공({ kind: '볼' }, null), createSeededRandom(seed), { countAfter: { strikes: 0, balls: 1 }, live: true })
      const pending = step.progress.pendingRunnerPlay
      if (pending == null) continue // 판이 안 열렸다 — 없는 판
      held += 1
      expect(step.deferred).toBe(true)
      expect(step.play).toBeNull()
      expect(pending.side).toBe('공격')
      expect(step.progress.game).toBe(출발.game)
      expect(step.progress.lastDefensePlay).toBe(출발.lastDefensePlay)
      // 판이 도는 동안 도루 · 견제 · 다음 공이 안 나간다
      expect(startSteal(step.progress, 1, createSeededRandom(0))).toBe(step.progress)
      expect(cpuPickoff(step.progress, 1, createSeededRandom(1), { count: { strikes: 0, balls: 0 } })).toBe(step.progress)
      expect(arrivePitch(step.progress, 공({ kind: '볼' }, null), createSeededRandom(1), { countAfter: { strikes: 0, balls: 1 } }).progress).toBe(
        step.progress,
      )
    }
    expect(held).toBeGreaterThan(0)
  })

  it('키 없이 끝낸 실시간 판은 미리 돌린 판과 같다 — 결과 · 기록 · 난수 차례 (볼 · 스트라이크 · 삼진 + 도루)', () => {
    let compared = 0
    for (const [resolution, outcomeAfter] of [
      [{ kind: '볼' }, null],
      [{ kind: '스트라이크', isSwinging: false }, null],
      [{ kind: '스트라이크', isSwinging: true }, { kind: '삼진' }],
    ] as const) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const 시작 = startGame(createSeededRandom(seed))
        const 출발 = startSteal(주자(시작, 일루), 1, createSeededRandom(0))
        const 미리Random = createSeededRandom(seed * 7)
        const 미리 = arrivePitch(출발, 공(resolution, outcomeAfter), 미리Random, { countAfter: { strikes: 0, balls: 0 } })
        const 실시간Random = createSeededRandom(seed * 7)
        const 붙듦 = arrivePitch(출발, 공(resolution, outcomeAfter), 실시간Random, { countAfter: { strikes: 0, balls: 0 }, live: true })
        const pending = 붙듦.progress.pendingRunnerPlay
        if (pending == null) {
          expect(미리.play).toBeNull()
          continue
        }
        const 끝 = resolveRunnerPlay(붙듦.progress, runLiveRunnerPlayWithoutKeys(pending), 실시간Random)
        expect(끝.progress.pendingRunnerPlay ?? null).toBeNull()
        expect(끝.interrupted).toBe(미리.interrupted)
        expect(끝.play?.kind).toBe(미리.play?.kind)
        expect(끝.play?.result.advance).toEqual(미리.play?.result.advance)
        expect(끝.play?.callSoundId).toBe(미리.play?.callSoundId)
        expect(끝.play?.recordIds).toEqual(미리.play?.recordIds)
        expect(칸(끝.progress)).toEqual(칸(미리.progress))
        // 실시간으로 본 판은 재생 칸에 다시 안 넣는다
        expect(끝.play?.shownLive).toBe(true)
        expect(끝.progress.lastDefensePlay).toBe(출발.lastDefensePlay)
        // 타석이 끝난 공 — 타석 결과 쪽(`startPlayerOutcome` 의 `arrivalPlay`)도 같다
        let 미리뒤 = 미리.progress
        let 실시간뒤 = 끝.progress
        if (outcomeAfter !== null && !미리.interrupted) {
          미리뒤 = startPlayerOutcome(미리.progress, outcomeAfter, 미리Random, { arrivalPlay: 미리.play })
          실시간뒤 = startPlayerOutcome(끝.progress, outcomeAfter, 실시간Random, { arrivalPlay: 끝.play })
          expect(칸(실시간뒤)).toEqual(칸(미리뒤))
          expect(실시간뒤.lastDefensePlay).not.toBe(미리.play?.result)
        }
        expect(실시간Random.rand(0, 0x7fffffff)).toBe(미리Random.rand(0, 0x7fffffff))
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(5)
  })

  it('폭투 · 포일 판(종류 9)도 붙들고 키 없이 끝내면 미리 돌린 판과 같다', () => {
    // 0.1% 굴림(0x3dfac)이 서는 씨앗을 찾는다 — 도루 없이 볼
    let found = 0
    for (let seed = 1; seed <= 4000 && found < 2; seed += 1) {
      const 시작 = startGame(createSeededRandom(1))
      const 판 = 주자(시작, { first: true, second: false, third: true })
      const 실시간Random = createSeededRandom(seed)
      const 붙듦 = arrivePitch(판, 공({ kind: '볼' }, null), 실시간Random, { countAfter: { strikes: 0, balls: 1 }, live: true })
      const pending = 붙듦.progress.pendingRunnerPlay
      if (pending == null || pending.kind !== 'arrival') continue
      found += 1
      expect(pending.opened.kind).toBe(9)
      const 미리Random = createSeededRandom(seed)
      const 미리 = arrivePitch(판, 공({ kind: '볼' }, null), 미리Random, { countAfter: { strikes: 0, balls: 1 } })
      const 끝 = resolveRunnerPlay(붙듦.progress, runLiveRunnerPlayWithoutKeys(pending), 실시간Random)
      expect(끝.play?.kind).toBe(9)
      expect(칸(끝.progress)).toEqual(칸(미리.progress))
      expect(실시간Random.rand(0, 0x7fffffff)).toBe(미리Random.rand(0, 0x7fffffff))
    }
    expect(found).toBeGreaterThan(0)
  })

  it("붙든 도루 판에서 귀루 키('3' — 0x584 · 인자 1)를 누르면 1루 주자가 돌아서고 도루 기록 8 이 안 선다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const 시작 = startGame(createSeededRandom(seed))
      const 출발 = startSteal(주자(시작, 일루), 1, createSeededRandom(0))
      const random = createSeededRandom(seed)
      const 붙듦 = arrivePitch(출발, 공({ kind: '볼' }, null), random, { countAfter: { strikes: 0, balls: 1 }, live: true })
      const pending = 붙듦.progress.pendingRunnerPlay
      if (pending == null || pending.kind !== 'arrival' || pending.opened.kind !== 5) continue
      const stepper = startLiveRunnerPlay(pending)
      stepper.step({ key: '3' })
      while (!stepper.finished) stepper.step(null)
      const result = stepper.result()
      expect(result.log[0]).toBe('0틱 귀루 키 — 주자 1')
      const 끝 = resolveRunnerPlay(붙듦.progress, result, random)
      expect(끝.progress.recordIds.slice(출발.recordIds.length)).not.toContain(8)
      expect(끝.progress.game.bases.second).toBe(false)
      expect(끝.progress.game.battingOrderIndex).toBe(출발.game.battingOrderIndex)
      return
    }
    throw new Error('도루 판이 안 열렸다')
  })

  it('밀어내기 판(종류 2)은 키가 할 일이 없어 붙들지 않는다 (0xae794 마스크 0x232 · 0x518da)', () => {
    const 시작 = startGame(createSeededRandom(4))
    const 출발 = startSteal(주자(시작, 일루), 1, createSeededRandom(0))
    const step = arrivePitch(출발, 공({ kind: '볼' }, { kind: '볼넷' }), createSeededRandom(4), { countAfter: { strikes: 0, balls: 1 }, live: true })
    expect(step.progress.pendingRunnerPlay ?? null).toBeNull()
    expect(step.play?.kind).toBe(2)
  })
})

describe('타자편 CPU 견제 판(종류 4)도 붙들어 사람 주루 키를 받는다', () => {
  it('live 면 붙들고, 키 없이 끝내면 미리 돌린 견제와 같다 — 결과 · 기록 · 난수 차례', () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const 시작 = startGame(createSeededRandom(20100905))
      const 판 = 주자(시작, { first: true, second: false, third: true })
      const 미리Random = createSeededRandom(seed)
      const 미리 = cpuPickoff(판, 1, 미리Random, { count: { strikes: 0, balls: 0 } })
      const 실시간Random = createSeededRandom(seed)
      const 붙듦 = cpuPickoff(판, 1, 실시간Random, { count: { strikes: 0, balls: 0 }, live: true })
      const pending = 붙듦.pendingRunnerPlay
      expect(pending?.kind).toBe('pickoff')
      expect(pending?.side).toBe('공격')
      expect(붙듦.game).toBe(판.game)
      if (pending == null) continue
      const played = runLiveRunnerPlayWithoutKeys(pending)
      expect(isPickoffPlayResult(played)).toBe(true)
      const 끝 = resolveRunnerPlay(붙듦, played, 실시간Random)
      expect(끝.progress.pendingRunnerPlay ?? null).toBeNull()
      expect(칸(끝.progress)).toEqual(칸(미리))
      expect(끝.progress.lastDefensePlay).toBe(판.lastDefensePlay)
      expect(실시간Random.rand(0, 0x7fffffff)).toBe(미리Random.rand(0, 0x7fffffff))
    }
  })
})

describe('붙든 판도 판 끝 0xf 진입의 볼카운트를 들고 간다 — 교체 틱 굴림 0x344dc (r122)', () => {
  it('도루 판은 이 공 뒤 카운트(countAfter) · 견제 판은 지금 카운트(count)를 붙든 칸에 싣는다', () => {
    let held = 0
    for (let seed = 1; seed <= 20 && held === 0; seed += 1) {
      const 시작 = startGame(createSeededRandom(seed))
      const 출발 = startSteal(주자(시작, 일루), 1, createSeededRandom(0))
      const step = arrivePitch(출발, { batterHand: 0, resolution: { kind: '볼' }, outcomeAfter: null }, createSeededRandom(seed), {
        live: true,
        countAfter: { strikes: 1, balls: 2 },
      })
      if (step.progress.pendingRunnerPlay == null) continue
      held += 1
      expect(step.progress.pendingRunnerPlay).toMatchObject({ kind: 'arrival', arrival: { countAfter: { strikes: 1, balls: 2 } } })
    }
    expect(held).toBe(1)
    const 견제 = cpuPickoff(주자(startGame(createSeededRandom(3)), 일루), 1, createSeededRandom(3), {
      live: true,
      count: { strikes: 2, balls: 1 },
    })
    expect(견제.pendingRunnerPlay).toMatchObject({ kind: 'pickoff', pickoff: { count: { strikes: 2, balls: 1 } } })
  })
})
