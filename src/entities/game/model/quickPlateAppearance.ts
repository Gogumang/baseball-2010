import {
  GROUND_OUT_ADVANCE_LIMIT,
  advanceOnGroundOut,
  advanceOnQuickWalk,
  advanceRunners,
  canAdvanceOnGroundOut,
} from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'
import { shiftRunners } from '@/entities/game/model/baseRunners'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
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
 * 주자 신원은 원본 주자 목록(sim+0x80)대로 든다(`baseRunners.ts`) — 타자는 나갈 때 `0xa93ac` 로 0번 칸에 들고, 진루는 모두
 * 목록 전원을 같은 수만큼 미는 `0xc0fb4` 라 루별 신원을 함께 민다. 도루 판정의 주력은 **가장 앞선 주자**(목록 n−1, c19a0)의 것이다.
 */
export interface QuickPlateAppearanceInput {
  readonly batter: QuickAtBatBatter
  readonly pitcher: QuickAtBatPitcher
  readonly situation: QuickAtBatSituation
  /** 타석 시작의 루와 아웃 */
  readonly bases: BaseState
  readonly outs: number
  /** 타석 시작의 주자 신원 (공격 팀 타순 칸 — `bases` 와 맞아야 한다) */
  readonly runners: BaseRunners
  /** 이 타석 타자의 신원 (타순 칸) */
  readonly batterId: number
  /** 그 신원 주자의 주력 `0xb570d(ctx, 3, 주자, 1, 0x5a, 1)` — 도루 판정의 앞선 주자(c19a0~c19c0) */
  readonly runnerRunOf: (runner: number) => number
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
  /** 타석 뒤의 주자 신원 — `advance.bases` 와 맞는다 */
  readonly runners: BaseRunners
  /**
   * 도루 기록 +0x2c 를 받을 주자(0xc1a42~0xc1a98 — 루를 옮긴 주자마다)의 신원. 목록 차례(0번 = 가장 뒤 주자)대로다.
   */
  readonly stolenRunners: readonly number[]
  /** 한 루씩 간 도루 주자 수 합 */
  readonly steals: number
  /**
   * 이 타석에서 **공격 팀 레코드 +2 를 0xb570c 가 덮었는가** (나리 b5768) — 스윙 경로(0xc11f0 → 0xab214 ab4c0~ab4d8)를 한 번이라도
   * 탔거나, 투구 판정 경로(0xc1818)에서 볼넷을 민 뒤 주자가 하나라도 있어(c1982 `0xa9599 > 0`) 앞선 주자 주력 c19d6~c19ec 을 읽었다.
   * 판정 경로에서 주자가 없으면(c1990 → c1ae2) 공격 팀은 안 닿는다 (r104 직접 뜸)
   */
  readonly touchesOffenseRecord: boolean
}

export function playQuickPlateAppearance(input: QuickPlateAppearanceInput, random: RandomPort): QuickPlateAppearance {
  let bases = input.bases
  let runners = input.runners
  /** 볼넷(판정 3)이 판정 자리에서 민 주자의 득점 — 볼넷이 아니면 null */
  let walkRuns: number | null = null
  const stolenRunners: number[] = []
  let steals = 0
  let touchesOffenseRecord = false
  const play = playQuickAtBat(input.batter, input.pitcher, input.situation, random, {
    basesAtPitch: () => bases,
    onSwingPath: () => {
      touchesOffenseRecord = true
    },
    ...(input.beforePitch === undefined ? {} : { beforePitch: input.beforePitch }),
    onPitchJudged: (judged) => {
      if (judged === '포볼') {
        // c1918 — 타자를 0번 칸에 끼우고(0xa93ac) 전원 +1(0xc0fb4)
        const walked = advanceOnQuickWalk(bases)
        bases = walked.bases
        walkRuns = walked.runsScored
        runners = shiftRunners(runners, 1, input.batterId).runners
      }
      // c1982~c19ec — 주자 목록이 비지 않았으면 앞선 주자 주력을 0xb570c(공격 팀 레코드, 3, …)로 읽는다 (도루 굴림 앞, 3루가 차도)
      if (bases.first || bases.second || bases.third) touchesOffenseRecord = true
      const base = quickStealBaseOf(bases)
      if (base === null) return
      // 가장 앞선 주자 = 앞선 루의 주자 (목록 n−1)
      const lead = base === 2 ? runners.second : runners.first
      const stolen = quickEngineSteal(
        bases,
        { hit: 0, power: 0, defense: 0, run: lead === null ? 0 : input.runnerRunOf(lead) },
        random,
      )
      // 0xc1a42 — 루를 옮긴 주자마다 (목록 0번 = 가장 뒤 주자부터)
      if (stolen.stolen > 0) {
        for (const runner of [runners.first, runners.second]) {
          if (runner !== null) stolenRunners.push(runner)
        }
        runners = shiftRunners(runners, 1).runners
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
  if (walkRuns === null) {
    // 안타 0xc0fb4(n) · 홈런 0xc1054(전원 득점) — 타자는 0xa93ac 로 0번 칸에 든다. 아웃 · 삼진은 주자를 안 움직인다
    if (outcome.kind === '안타') runners = shiftRunners(runners, outcome.bases, input.batterId).runners
    else if (outcome.kind === '홈런') runners = shiftRunners(runners, 4, input.batterId).runners
  }
  // 땅볼 아웃에 60% 로 주자가 한 루 나간다 (0xc15b8).
  // **원본은 아웃 ≤1 이면 주자가 없어도 난수를 먼저 뽑고**, 그 뒤에 주자·3루 조건을 본다 (E 3g).
  const isGroundOut = outcome.kind === '아웃' && outcome.detail === '땅볼아웃'
  if (isGroundOut && input.outs < OUTS_PER_INNING - 1) {
    const rolled = random.rand(0, RANDOM_LIMIT) <= GROUND_OUT_ADVANCE_LIMIT
    if (rolled && canAdvanceOnGroundOut(advance.bases, input.outs)) {
      advance = { ...advance, bases: advanceOnGroundOut(advance.bases) }
      runners = shiftRunners(runners, 1).runners
    }
  }
  return { play, advance, runners, stolenRunners, steals, touchesOffenseRecord }
}
