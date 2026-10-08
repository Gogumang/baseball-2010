import {
  GROUND_OUT_ADVANCE_LIMIT,
  advanceOnGroundOut,
  advanceOnQuickWalk,
  advanceRunners,
  canAdvanceOnGroundOut,
} from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type {
  QuickAtBatBatter,
  QuickAtBatPitcher,
  QuickAtBatPlay,
  QuickAtBatSituation,
} from '@/entities/game/model/quickAtBat'
import { quickEngineSteal, quickStealBaseOf } from '@/entities/game/model/steal'
import type { RandomPort } from '@/shared/api/random/randomPort'

const OUTS_PER_INNING = 3
const RANDOM_LIMIT = 10_000

/**
 * **간이 엔진 타석 하나를 주자까지** — 원본 0xc262c 한 번(투구 고리) + 0xc11f0 · 0xc1818 안의 주자 처리.
 * 반 이닝 엔진(`simulateHalfInning`)과 사람 경기 안의 간이 타석(동료 타석 · 자동진행 타석)이 같은 이 길을 탄다.
 *
 * - 공마다 그 공의 루(`basesAtPitch`)를 0xab214 스킬 상황 칸에 넘긴다 — 도루로 타석 중에도 바뀐다
 * - 투구 판정 길(0xc1818) 뒤마다 **도루**를 굴린다(c1982~c1ade, `quickEngineSteal`) — 실패가 없다
 * - **볼넷**(판정 3)은 판정 자리(c1918~c194a)에서 타자를 넣고 모든 주자를 한 루씩 민 뒤(`advanceOnQuickWalk`) 도루로 떨어진다
 * - 땅볼 아웃이면 아웃 < 2 일 때 rand(0,10000) 을 **먼저** 굴리고(0xc15b8) 진루 조건을 본다
 *
 * ⚠️ **주자 신원은 근사다** — 루에 선 주자가 누구인지 들고 있지 않아 루 b 의 주자를 "지금 타자에서 거꾸로 b 번째"
 * (볼넷 뒤에는 b − 1 번째 — 1루가 지금 타자)로 본다. 도루로 2루에 간 주자는 실제로는 직전 타자라 이 셈이 한 칸 어긋난다.
 */
export interface QuickPlateAppearanceInput {
  readonly batter: QuickAtBatBatter
  readonly pitcher: QuickAtBatPitcher
  readonly situation: QuickAtBatSituation
  /** 타석 시작의 루와 아웃 */
  readonly bases: BaseState
  readonly outs: number
  /** 지금 타자에서 거꾸로 `ordersBack` 번째 타자의 주력 — 도루 판정의 앞선 주자 (0 = 지금 타자) */
  readonly runnerRunAt: (ordersBack: number) => number
  /** 공 하나를 던지기 앞 (`QuickAtBatHooks.beforePitch`) — 스태미나 소모 */
  readonly beforePitch?: () => QuickAtBatPitcher
}

export interface QuickPlateAppearance {
  readonly play: QuickAtBatPlay
  /**
   * 타석 결과를 먹인 주자 — 볼넷이면 판정 자리에서 민 루와 그 득점, 아니면 도루 뒤 루에서 `advanceRunners`(간이 엔진 갈래) +
   * 땅볼 진루. **3아웃 득점 지우기는 부르는 쪽 몫이다**(점수판에 먹이는 쪽이 셈이 다르다).
   */
  readonly advance: AdvanceResult
  /**
   * 도루 기록 +0x2c 를 받을 주자(0xc1a42~0xc1a98 — 루를 옮긴 주자마다) — 지금 타자에서 거꾸로 몇 번째인가.
   * 1루 주자가 먼저, 2루 주자가 뒤다.
   */
  readonly stolenRunners: readonly number[]
  /** 한 루씩 간 도루 주자 수 합 */
  readonly steals: number
}

export function playQuickPlateAppearance(input: QuickPlateAppearanceInput, random: RandomPort): QuickPlateAppearance {
  let bases = input.bases
  /** 볼넷(판정 3)이 판정 자리에서 민 주자의 득점 — 볼넷이 아니면 null */
  let walkRuns: number | null = null
  const stolenRunners: number[] = []
  let steals = 0
  const play = playQuickAtBat(input.batter, input.pitcher, input.situation, random, {
    basesAtPitch: () => bases,
    ...(input.beforePitch === undefined ? {} : { beforePitch: input.beforePitch }),
    onPitchJudged: (judged) => {
      // 볼넷 뒤에는 타자가 1루에 섰다 — 루 b 의 주자는 지금 타자에서 거꾸로 b − 1 번째
      let runnerShift = 0
      if (judged === '포볼') {
        const walked = advanceOnQuickWalk(bases)
        bases = walked.bases
        walkRuns = walked.runsScored
        runnerShift = 1
      }
      const base = quickStealBaseOf(bases)
      if (base === null) return
      const stolen = quickEngineSteal(
        bases,
        { hit: 0, power: 0, defense: 0, run: input.runnerRunAt(base - runnerShift) },
        random,
      )
      // 0xc1a42 — 루를 옮긴 주자마다
      if (stolen.stolen > 0) {
        for (const [onBase, runnerBase] of [[bases.first, 1], [bases.second, 2]] as const) {
          if (onBase) stolenRunners.push(runnerBase - runnerShift)
        }
      }
      bases = stolen.bases
      steals += stolen.stolen
    },
  })
  const outcome = play.outcome
  // 볼넷은 판정 자리(c1918)에서 이미 주자를 밀었다 — 여기서는 그 득점만 싣는다
  let advance: AdvanceResult = walkRuns !== null
    ? { bases, runsScored: walkRuns, outsAdded: 0 }
    : advanceRunners(bases, outcome, input.outs, { quickEngine: true })
  // 땅볼 아웃에 60% 로 주자가 한 루 나간다 (0xc15b8).
  // **원본은 아웃 ≤1 이면 주자가 없어도 난수를 먼저 뽑고**, 그 뒤에 주자·3루 조건을 본다 (E 3g).
  const isGroundOut = outcome.kind === '아웃' && outcome.detail === '땅볼아웃'
  if (isGroundOut && input.outs < OUTS_PER_INNING - 1) {
    const rolled = random.rand(0, RANDOM_LIMIT) <= GROUND_OUT_ADVANCE_LIMIT
    if (rolled && canAdvanceOnGroundOut(advance.bases, input.outs)) {
      advance = { ...advance, bases: advanceOnGroundOut(advance.bases) }
    }
  }
  return { play, advance, stolenRunners, steals }
}
