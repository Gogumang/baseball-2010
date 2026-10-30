import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { opponentPitcherAbilityOf, resolveDefensePlay, startGame, startPlayerOutcome } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { recordedOutcomeOf, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck, type PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { RandomPort } from '@/shared/api/random/randomPort'

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

/** 한 타석 안에서 굴리는 칸 — 상대 투수 · 신인 타자 · 키 틱 · 연차 */
interface HarnessSwing {
  readonly batter: ReturnType<typeof effectiveAbilityOf>
  readonly offsets: readonly number[]
  readonly careerYearIndex: number
  readonly random: RandomPort
  readonly tally: HitRateTally
}

interface SwingResult {
  readonly strikes: number
  readonly outcome: AtBatOutcome | null
  readonly pattern?: BattedBallPattern
}

/** CPU 투구 0x344dc · 0x345fc · 0x4dc78 — 목표가 아닌 공(빠진 공)이면 null */
function throwHarnessPitch(progress: GameProgress, strikes: number, balls: number, random: RandomPort) {
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
  if (aim.kind !== '목표') return null
  return { pitcher, pitch: releaseCpuPitch(args, typeNumber, aim.target, random).pitch }
}

/** 판정 하나를 셈에 먹인다 — 파울은 2스트라이크 뒤에는 그대로, 헛스윙 셋이면 삼진 */
function swingResultOf(resolution: PitchResolution, pattern: BattedBallPattern | undefined, strikes: number, tally: HitRateTally): SwingResult {
  if (resolution.kind === '타구') return { strikes, outcome: resolution.outcome, pattern }
  if (resolution.kind === '파울') return { strikes: strikes < 2 ? strikes + 1 : strikes, outcome: null }
  tally.whiffs += 1
  return { strikes: strikes + 1, outcome: strikes + 1 >= 3 ? { kind: '삼진' } : null }
}

/** 타석 하나 — 모든 공에 스윙한다(볼넷 · 사구 없음). 30 공 안에 안 끝나면 결과 없음 */
function swingThroughAtBat(progress: GameProgress, deck: PatternDeck, swing: HarnessSwing): SwingResult & { readonly deck: PatternDeck } {
  const balls = 0
  let current: SwingResult = { strikes: 0, outcome: null }
  let currentDeck = deck
  for (let n = 0; n < 30 && current.outcome === null; n += 1) {
    const thrown = throwHarnessPitch(progress, current.strikes, balls, swing.random)
    if (thrown === null) continue
    const frame = thrown.pitch.frameCount - 2 + swing.offsets[swing.random.rand(0, swing.offsets.length)]
    swing.tally.swings += 1
    const resolved = resolvePitch(
      thrown.pitch,
      { frame, shift: 0, buntKind: 0 },
      harnessContextOf(swing, thrown.pitcher, current.strikes, balls),
      currentDeck,
      swing.random,
    )
    currentDeck = resolved.deck
    current = swingResultOf(resolved.detail.resolution, resolved.detail.pattern, current.strikes, swing.tally)
  }
  return { ...current, deck: currentDeck }
}

/** 스윙 판정 0xab214 의 맥락 — 신인 타자 · 1회 · 주자 없음 */
function harnessContextOf(swing: HarnessSwing, pitcher: ReturnType<typeof opponentPitcherAbilityOf>, strikes: number, balls: number) {
  return {
    batter: swing.batter,
    pitcher,
    mode: '나만의리그' as const,
    batterSkillIds: [],
    isBatterOwnPlayer: true,
    careerYearIndex: swing.careerYearIndex,
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
  }
}

/** 타석 결과를 경기에 먹인다 — 페어 타구는 수비 판을 돌려 판 끝 정산 0xa8024 로 */
function settleHarnessAtBat(progress: GameProgress, swung: SwingResult, random: RandomPort, tally: HitRateTally): GameProgress {
  tally.atBats += 1
  if (swung.outcome === null || swung.outcome.kind === '삼진') tally.strikeouts += 1
  const pattern = swung.pattern
  const started = startPlayerOutcome(progress, swung.outcome ?? { kind: '삼진' }, random, pattern === undefined ? {} : { pattern })
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  const result = runDefensePlay(pending)
  if (pattern !== undefined) tallyFairBall(tally, recordedOutcomeOf(pending, result))
  return resolveDefensePlay(started, result, random, { countAfterFoul: { strikes: 1, balls: 0 } })
}

function tallyFairBall(tally: HitRateTally, recorded: AtBatOutcome): void {
  tally.fair += 1
  if (recorded.kind === '안타' || recorded.kind === '홈런') tally.hits += 1
  if (recorded.kind === '홈런') tally.homeRuns += 1
}

export function playCareerGames(options: HitRateOptions): HitRateTally {
  const offsets = options.offsets ?? [0]
  const batter = effectiveAbilityOf({ ...createCareer('측정'), ...options.careerPatch })
  const tally: HitRateTally = { swings: 0, whiffs: 0, fair: 0, hits: 0, homeRuns: 0, strikeouts: 0, atBats: 0 }
  for (let seed = 1; seed <= options.games; seed += 1) {
    const random = createSeededRandom(seed * 7919)
    // 실제 경기처럼 신인 주력을 넘긴다(leagueMatchSetup) — 안 넘기면 타자주자가 명단 칸 선수 주력으로 달린다
    let progress: GameProgress = startGame(
      random,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      batter.run,
    )
    let deck = createPatternDeck(random)
    const swing: HarnessSwing = { batter, offsets, careerYearIndex: options.careerYearIndex ?? 0, random, tally }
    for (let guard = 0; !progress.game.isFinished && guard < 200; guard += 1) {
      const swung = swingThroughAtBat(progress, deck, swing)
      deck = swung.deck
      progress = settleHarnessAtBat(progress, swung, random, tally)
    }
  }
  return tally
}
