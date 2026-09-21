import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * **경기 중 CPU 투수 교체** (binary.mod 0xc1ba4 → 0xac428 판정 · 0xabfcc 새 투수 · 0xac360 마무리 굴림
 * · 0xaf09c 교체 실행 — E-defense-rules E-6 · 3c, P7-leftovers E1·E2).
 *
 * 간이 타석 루프 0xc262c 는 **타석마다** 먼저 0xc1ba4 를 부르고, 그 안에서 수비 팀 투수 교체를
 * 판정한다. 그래서 사람이 잡지 않고 넘긴 타석에서는 **양 팀 투수가 모두 바뀔 수 있다**
 * (우리 팀이 공격하는 자동 타석이면 상대 투수가, 우리 팀이 수비하는 자동 타석이면 우리 투수가).
 * 사람이 직접 던지는 타석은 이 길을 지나지 않는다 — 그때 우리 투수를 바꾸는 것은 `#` 메뉴다(R4 1b).
 *
 * ⚠️ **감독 강판(`entities/pitcher-career/managerHook`)은 여기 없다.** 0x504cc 는 모드 3
 * (나만의리그 투수편) 전용이라 팀 경기(모드 1·2·8·9)에는 원본에도 없다 (P1 2절).
 */

/** 이번 투수의 카운터 — 원본 팀 객체 `+0x27c` 묶음 (P7 E1 확정) */
export interface MoundPitcherCounters {
  /** `+0x284 = A` 이번 투수의 **이번 이닝** 실점. 이닝 교대(0xa5b00)에서 0 이 된다 */
  readonly inningRunsAllowed: number
  /** `+0x280 = B` 이번 투수의 실점. 투수 교체(0xaec64)에서만 0 이 된다 */
  readonly runsAllowed: number
  /** `+0x27c` 이번 투수의 투구 수 (0xa5e5e 에서 투구마다 +1) */
  readonly pitches: number
}

export const EMPTY_MOUND_COUNTERS: MoundPitcherCounters = {
  inningRunsAllowed: 0,
  runsAllowed: 0,
  pitches: 0,
}

export interface PitcherChangeInput extends MoundPitcherCounters {
  /** 지금 투수의 보직 — 레코드 `+0xb` 하위 2비트 (0xb6704) */
  readonly role: PitcherRole
  /** 특수 투수인가 (0xb633c) — 마선수 계열 */
  readonly isSpecialPitcher?: boolean
  /** 지금 투수의 스태미나 0~10000 (`+0x2c`) */
  readonly stamina: number
  /** 벤치에 남은 투수 수 (`team+0x33`) */
  readonly benchCount: number
  /** 바꾸려면 벤치가 이보다 많아야 한다 — 간이 경기가 넘기는 인자는 1 이다 */
  readonly minimumBench?: number
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly justChanged?: boolean
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  /** **0-기준** 이닝 (state+0x6b). 1-기준 회에서 하나 뺀 값이다 */
  readonly inningIndex: number
  /** 루에 나가 있는 주자 수 (0xa9888) — 9회 이후 마무리 상황 판정에 쓴다 */
  readonly runnerCount: number
}

export interface PitcherChangeDecision {
  readonly replace: boolean
  /**
   * "마무리 상황" 표시. 새 투수를 어떻게 고를지를 가른다 (0xac5d8~0xac61c):
   *   - 마무리 상황이 **아니면** 0xac360 을 굴려, 참이면 벤치 **마지막**에서 고른다
   *   - 마무리 상황이면 굴리지 않고 곧장 0xabfcc(`chooseReplacementPitcher`) 로 간다
   *     (이때 0xabfcc 의 다섯째 인자 = 마무리 플래그 → `lateInningFlag`)
   * ⚠️ E-6 4절 3c 가 이 방향을 **거꾸로** 적었던 것을 CORRECTIONS 가 정정했다 ("E: 새 투수는
   * … 방향이 반대", V3-E "새 투수 고르기 방향이 반대").
   *
   * ⚠️ 원본 문서(E-6, 유력)가 "A>1 이면 교체 / 9회 이후엔 여기에 더해 마무리 상황을 표시" 로만
   * 적혀 있어, 마무리 상황 자체가 교체를 부르는지는 알 수 없다 — 여기서는 **표시만** 한다.
   */
  readonly saveSituation: boolean
}

/** 특수 투수 문턱 (E 3c) — 이닝 실점 > 2 · 투수 실점 > 3 · 체력 ≤ 39% */
const SPECIAL = { inningRuns: 2, runs: 3, staminaPercent: 39 } as const
/** 선발·중간(역할 0·1) 공통 문턱 */
const COMMON = { inningRuns: 2, staminaPercent: 19 } as const
/** 9회 이후 마무리 상황 — `0 < 리드 ≤ 5` 이고 (리드 ≤ 3 또는 리드 ≤ 주자 수 + 2) */
const SAVE = { maximumLead: 5, comfortableLead: 3, runnerBonus: 2 } as const
/** 0-기준 이닝 8 = 9회 */
const SAVE_FROM_INNING_INDEX = 8

/**
 * `0xac428` 의 교체 판정. 이닝 구간은 **0-기준**이다 (CORRECTIONS 의 V3 정정 —
 * 1-기준으로 옮기면 1~4회 / 5회 / 7회 / 6회·8회 이상 이다).
 *
 * ```
 * 벤치 ≤ minimumBench → 안 바꿈 ; state[0xd] → 안 바꿈
 * 특수 투수 : A>2 or B>3 or s≤39
 * 역할 0·1  : A>2 or s≤19 → 교체
 *             inn ≤ 3 : B>4 / inn == 4 : B>4 && s≤49 / inn == 6 : B>2 && s≤29
 *             그 밖(inn 5 · inn ≥ 7) : A>1
 * 역할 2    : A≠0 and 리드 ≤ −2
 * ```
 */
export function judgePitcherChange(input: PitcherChangeInput): PitcherChangeDecision {
  const none: PitcherChangeDecision = { replace: false, saveSituation: false }
  if (input.benchCount <= (input.minimumBench ?? 1)) return none
  if (input.justChanged === true) return none

  const s = staminaPercentOf(input.stamina)
  const a = input.inningRunsAllowed
  const b = input.runsAllowed

  if (input.isSpecialPitcher === true) {
    return {
      replace: a > SPECIAL.inningRuns || b > SPECIAL.runs || s <= SPECIAL.staminaPercent,
      saveSituation: false,
    }
  }

  if (input.role === PITCHER_ROLE.relief) {
    // 역할 2(마무리)는 이닝 실점이 있고 2점 이상 뒤지면 내린다
    return { replace: a !== 0 && input.lead <= -2, saveSituation: false }
  }

  if (a > COMMON.inningRuns || s <= COMMON.staminaPercent) {
    return { replace: true, saveSituation: false }
  }

  const inn = input.inningIndex
  if (inn <= 3) return { replace: b > 4, saveSituation: false }
  if (inn === 4) return { replace: b > 4 && s <= 49, saveSituation: false }
  if (inn === 6) return { replace: b > 2 && s <= 29, saveSituation: false }

  const saveSituation =
    inn >= SAVE_FROM_INNING_INDEX &&
    input.lead > 0 &&
    input.lead <= SAVE.maximumLead &&
    (input.lead <= SAVE.comfortableLead || input.lead <= input.runnerCount + SAVE.runnerBonus)
  return { replace: a > 1, saveSituation }
}

/**
 * 마무리 투입 굴림 `0xac360` — 참이면 새 투수를 **벤치 마지막**에서 고른다.
 * 확률은 `d_level.dat[0x36..0x3b]` = 45·35·50·60·60·30 % (P7 E2 확정).
 *
 * ⚠️ 이 굴림은 **마무리 상황이 아닐 때만** 돈다 (V3-E 정정) — `PitcherChangeDecision.saveSituation` 참고.
 */
export const CLOSER_ROLL_PERCENTS: readonly number[] = [45, 35, 50, 60, 60, 30]

/** 굴림 칸 k — 9회 → 1 · 8회 → 2 · 지는 중 → 3 · 주자 2명 이상 → 4 · 1점 차 리드 → 5 · 그 밖 0 */
export function closerRollIndexOf(input: {
  readonly inningIndex: number
  readonly lead: number
  readonly runnerCount: number
}): number {
  if (input.inningIndex === 8) return 1
  if (input.inningIndex === 7) return 2
  if (input.lead < 0) return 3
  if (input.runnerCount > 1) return 4
  if (input.lead === 1) return 5
  return 0
}

export interface CloserRollInput {
  readonly inningIndex: number
  readonly lead: number
  readonly runnerCount: number
  /** 두 팀 다 CPU 조작이면 굴리지 않는다 (0xb6c20 — CPU 끼리 경기) */
  readonly bothTeamsAreCpu?: boolean
}

export function rollsCloser(input: CloserRollInput, random: RandomPort): boolean {
  if (input.bothTeamsAreCpu === true) return false
  const index = closerRollIndexOf(input)
  return randomIntegerBelow(random, 0, 100) < (CLOSER_ROLL_PERCENTS[index] ?? 0)
}

/** 새 투수 후보 한 명 — 벤치 칸과, 고를 때 보는 값들 */
export interface ReplacementCandidate {
  /** 로스터 칸 */
  readonly index: number
  /** 스태미나 0~10000 (`+0x2c`). 모르면 `FULL_STAMINA` */
  readonly stamina?: number
  /** 보직. **웹 로스터에는 이 값이 없다** — 넣어 주면 원본 순서를 그대로 쓴다 */
  readonly role?: PitcherRole
  /** 특수 투수(마선수)인가 */
  readonly isSpecialPitcher?: boolean
}

/** 후보 스태미나가 이 값을 넘으면 마무리로 올릴 만하다 (0xabfcc 의 `> 30` = 0.3%) */
const CLOSER_MINIMUM_STAMINA = 30

/**
 * 보직 1 = **중간계투** (P7 E2 확정).
 * `entities/pitcher-career/model/pitcherRole.ts` 는 이 값을 아직 `unknown` 으로 적어 두었다.
 */
const MIDDLE_RELIEVER: PitcherRole = PITCHER_ROLE.unknown

/**
 * 새 투수 고르기 `0xabfcc` (P7 E2 확정).
 *
 * ```
 * 순서 = (inn > 7 && 늦은이닝플래그) ? [마무리, 중간, 선발] : [중간, 마무리, 선발]
 * 마무리 : 능력 합이 큰 순 → "현재 투수 스태미나 ≤ 0 이거나 후보 스태미나 > 30" 인 첫 후보
 * 중간   : 스태미나가 큰 순 → 첫 후보
 * 선발   : 후보 목록의 **마지막**(벤치 번호가 가장 큰 선발)
 * ```
 *
 * ⚠️ **웹 로스터(`shared/config/original/roster.ts`)에는 보직(`+0xb` 하위 2비트)이 없다.**
 * 후보에 `role` 이 하나도 안 실려 오면 위 순서를 세울 수 없어, 원본의 가장 흔한 갈래인
 * **"중간계투 = 스태미나가 가장 많은 후보"** 만 남긴다 (같으면 벤치 번호가 작은 쪽).
 * 보직을 채우려면 `XlsPITCHER_DATA` 의 레코드 `+0xb` 를 로스터 JSON 에 넣어야 한다.
 */
export function chooseReplacementPitcher(
  candidates: readonly ReplacementCandidate[],
  input: {
    readonly inningIndex: number
    readonly lateInningFlag?: boolean
    /** 지금 마운드에 선 투수의 스태미나 (마무리 갈래가 본다) */
    readonly currentStamina: number
    /** 모드 3 이면 마선수를 건너뛴다 */
    readonly excludeSpecialPitchers?: boolean
  },
): number {
  const usable = candidates.filter(
    (candidate) =>
      input.excludeSpecialPitchers !== true || candidate.isSpecialPitcher !== true,
  )
  if (usable.length === 0) return -1
  const staminaOf = (candidate: ReplacementCandidate) => candidate.stamina ?? FULL_STAMINA

  const hasRoles = usable.some((candidate) => candidate.role !== undefined)
  if (!hasRoles) {
    // 보직을 모를 때의 갈래 — 스태미나 최고, 같으면 벤치 번호가 작은 쪽
    return usable.reduce((best, candidate) =>
      staminaOf(candidate) > staminaOf(best) ? candidate : best,
    ).index
  }

  // 보직 0 선발 · **1 중간계투** · 2 마무리 (P7 E2 — `pitcherRole.ts` 가 1 을 "뜻 미상" 으로 둔 값이다)
  const order: PitcherRole[] =
    input.inningIndex > 7 && input.lateInningFlag === true
      ? [PITCHER_ROLE.relief, MIDDLE_RELIEVER, PITCHER_ROLE.starter]
      : [MIDDLE_RELIEVER, PITCHER_ROLE.relief, PITCHER_ROLE.starter]

  for (const role of order) {
    const pool = usable.filter(
      (candidate) => candidate.role === role && candidate.isSpecialPitcher !== true,
    )
    if (pool.length === 0) continue
    if (role === PITCHER_ROLE.relief) {
      // 능력 합이 큰 순 — 웹 후보에 능력 합이 없으면 스태미나 순으로 본다 (근사)
      const sorted = [...pool].sort((left, right) => staminaOf(right) - staminaOf(left))
      const picked = sorted.find(
        (candidate) => input.currentStamina <= 0 || staminaOf(candidate) > CLOSER_MINIMUM_STAMINA,
      )
      if (picked !== undefined) return picked.index
      continue
    }
    if (role === MIDDLE_RELIEVER) {
      return [...pool].sort((left, right) => staminaOf(right) - staminaOf(left))[0].index
    }
    return pool[pool.length - 1].index
  }
  return -1
}
