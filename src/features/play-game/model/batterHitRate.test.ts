import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { opponentPitcherAbilityOf, resolveDefensePlay, startGame, startPlayerOutcome } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { recordedOutcomeOf, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import { createCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * **나리 타자편 안타율 회귀 시험** (r209 — "타자편 하는데 왤케 안타가 잘 안되지?").
 *
 * 타석 판정의 실제 길(CPU 투구 0x344dc · 0x345fc · 0x4dc78 → 스윙 결과 0xab214 · 타이밍 0x34be0 → 방향 · 패턴 → 수비 판
 * → 판 끝 정산 0xa8024)을 신인 타자로 경기 끝까지 돌려 헛스윙률 · 맞힌 페어 타구 안타율 · 타율을 잰다. 모든 공에 스윙한다.
 * 키 틱 F 는 판정 틱(F + 2)이 0x11 안에 드는 범위(F ≤ N − 1)이고 F ≥ N − 3 이라 깊이 관문(4e1e4, 경로 [N − 1])은 늘 열린다.
 * 파울은 판을 돌리지 않고 스트라이크만 올린다(2스트라이크 뒤에는 그대로) — 파울 뜬공 아웃(13)은 세지 않는 근사다.
 *
 * 기준값(2026-10-25 측정, 10-16 r140 · r150 · r170 · r184 · r187 · r205 · main 모두 같은 범위): 최적(F = N − 2) 헛스윙 약 30% ·
 * 타율 약 .25, ±1 틱이면 헛스윙 약 45%. 이 범위를 크게 벗어나면 판정 · 투구 · 수비 판 어딘가가 바뀐 것이다.
 */
interface Tally {
  swings: number
  whiffs: number
  fair: number
  hits: number
  atBats: number
}

function playCareerGames(offsets: readonly number[], games: number): Tally {
  const batter = effectiveAbilityOf(createCareer('측정'))
  const tally: Tally = { swings: 0, whiffs: 0, fair: 0, hits: 0, atBats: 0 }
  for (let seed = 1; seed <= games; seed += 1) {
    const random = createSeededRandom(seed * 7919)
    let progress: GameProgress = startGame(random)
    let deck = createPatternDeck(random)
    for (let guard = 0; !progress.game.isFinished && guard < 200; guard += 1) {
      let balls = 0
      let strikes = 0
      let outcome: AtBatOutcome | null = null
      let pattern: BattedBallPattern | undefined
      for (let n = 0; n < 30 && outcome === null; n += 1) {
        const pitcher = opponentPitcherAbilityOf(progress)
        const args = {
          pitcher,
          situation: { strikes, balls, outs: progress.game.outs, runnerCount: 0, hasSecondBaseRunner: false, batterSide: 0, side: 0 },
          difficulty: 'hard' as const,
          batterIntimidates: false,
        }
        let typeNumber = 0
        for (let tick = 0; tick < CPU_PITCH_TYPE_TICKS; tick += 1) typeNumber = cpuPitchTypeTickOf(args, random)
        const aim = cpuPitchAimOf(args, random)
        if (aim.kind !== '목표') continue
        const pitch = releaseCpuPitch(args, typeNumber, aim.target, random).pitch
        const frame = pitch.frameCount - 2 + offsets[random.rand(0, offsets.length)]
        tally.swings += 1
        const resolved = resolvePitch(
          pitch,
          { frame, shift: 0, buntKind: 0 },
          {
            batter,
            pitcher,
            mode: '나만의리그',
            batterSkillIds: [],
            isBatterOwnPlayer: true,
            careerYearIndex: 0,
            situation: {
              inning: 1, isLosing: false, runnerCount: 0, hasSecondBaseRunner: false, pitcherSide: 0, batterSide: 0,
              balls, strikes, batterOrderIndex: 0, recentAtBatCodes: [],
            },
          },
          deck,
          random,
        )
        deck = resolved.deck
        const resolution = resolved.detail.resolution
        if (resolution.kind === '타구') {
          outcome = resolution.outcome
          pattern = resolved.detail.pattern
        } else if (resolution.kind === '파울') {
          if (strikes < 2) strikes += 1
        } else {
          tally.whiffs += 1
          strikes += 1
          if (strikes >= 3) outcome = { kind: '삼진' }
        }
      }
      tally.atBats += 1
      const started = startPlayerOutcome(progress, outcome ?? { kind: '삼진' }, random, pattern === undefined ? {} : { pattern })
      const pending = started.pendingDefensePlay
      if (pending === null) {
        progress = started
        continue
      }
      const result = runDefensePlay(pending)
      if (pattern !== undefined) {
        tally.fair += 1
        const recorded = recordedOutcomeOf(pending, result)
        if (recorded.kind === '안타' || recorded.kind === '홈런') tally.hits += 1
      }
      progress = resolveDefensePlay(started, result, random)
    }
  }
  return tally
}

describe('나리 타자편 안타율 — 판정 길 회귀 (r209)', () => {
  it('최적 타이밍(F = N − 2) 신인 타자는 헛스윙 약 30% · 맞힌 공 안타율 약 .27 · 타율 약 .25', () => {
    const tally = playCareerGames([0], 200)
    expect(tally.atBats).toBeGreaterThan(700)
    const whiffRate = tally.whiffs / tally.swings
    expect(whiffRate).toBeGreaterThan(0.24)
    expect(whiffRate).toBeLessThan(0.37)
    expect(tally.hits / tally.fair).toBeGreaterThan(0.2)
    expect(tally.hits / tally.fair).toBeLessThan(0.35)
    expect(tally.hits / tally.atBats).toBeGreaterThan(0.19)
  })

  it('한 틱 빠르거나 늦으면 헛스윙이 는다 — 타이밍 0x34be0 폭 24 · 나눔 N − 1', () => {
    const exact = playCareerGames([0], 120)
    const early = playCareerGames([-1], 120)
    const late = playCareerGames([1], 120)
    const rate = (tally: Tally) => tally.whiffs / tally.swings
    expect(rate(early)).toBeGreaterThan(rate(exact) + 0.05)
    expect(rate(late)).toBeGreaterThan(rate(exact) + 0.05)
  })
})
