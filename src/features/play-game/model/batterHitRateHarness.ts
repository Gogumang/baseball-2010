import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { opponentPitcherAbilityOf, resolveDefensePlay, startGame, startPlayerOutcome } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { recordedOutcomeOf, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * **나리 타자편 타율 하네스** (r209 · r242 시험에서 떼어 냈다 — r265 밸런스 측정이 같이 쓴다).
 *
 * 타석 판정의 실제 길(CPU 투구 0x344dc · 0x345fc · 0x4dc78 → 스윙 결과 0xab214 · 타이밍 0x34be0 → 방향 · 패턴 → 수비 판
 * → 판 끝 정산 0xa8024)을 신인 타자로 경기 끝까지 돌린다. 모든 공에 스윙한다.
 * 키 틱 F 는 판정 틱(F + 2)이 0x11 안에 드는 범위(F ≤ N − 1)이고 F ≥ N − 3 이라 깊이 관문(4e1e4, 경로 [N − 1])은 늘 열린다.
 * 파울은 판을 돌리지 않고 스트라이크만 올린다(2스트라이크 뒤에는 그대로) — 파울 뜬공 아웃(13)은 세지 않는 근사다.
 * 늘 스윙하므로 볼넷 · 사구가 없다 — 타석 = 타수다.
 */
export interface HitRateTally {
  swings: number
  whiffs: number
  /** 페어 타구(판을 돈 공) */
  fair: number
  /** 안타 + 홈런 */
  hits: number
  homeRuns: number
  strikeouts: number
  atBats: number
}

export interface HitRateOptions {
  /** 키 틱 F = N − 2 + 이 값 중 하나 (공마다 고른다). 기본 [0] = 최적 타이밍 */
  readonly offsets?: readonly number[]
  readonly games: number
  /** 나리 연차 idx (0 = 1년차) — 내 선수 보너스를 깎는다 */
  readonly careerYearIndex?: number
  /** 신인 커리어에 덮어쓸 칸 (사기 등) */
  readonly careerPatch?: Partial<PlayerCareer>
}

export function playCareerGames(options: HitRateOptions): HitRateTally {
  const offsets = options.offsets ?? [0]
  const batter = effectiveAbilityOf({ ...createCareer('측정'), ...options.careerPatch })
  const tally: HitRateTally = { swings: 0, whiffs: 0, fair: 0, hits: 0, homeRuns: 0, strikeouts: 0, atBats: 0 }
  for (let seed = 1; seed <= options.games; seed += 1) {
    const random = createSeededRandom(seed * 7919)
    let progress: GameProgress = startGame(random)
    let deck = createPatternDeck(random)
    for (let guard = 0; !progress.game.isFinished && guard < 200; guard += 1) {
      const balls = 0
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
            careerYearIndex: options.careerYearIndex ?? 0,
            situation: {
              inning: 1,
              isLosing: false,
              runnerCount: 0,
              hasSecondBaseRunner: false,
              pitcherSide: 0,
              batterSide: 0,
              balls,
              strikes,
              batterOrderIndex: 0,
              recentAtBatCodes: [],
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
      if (outcome === null || outcome.kind === '삼진') tally.strikeouts += 1
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
        if (recorded.kind === '홈런') tally.homeRuns += 1
      }
      progress = resolveDefensePlay(started, result, random, { countAfterFoul: { strikes: 1, balls: 0 } })
    }
  }
  return tally
}
