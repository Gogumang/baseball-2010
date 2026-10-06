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
  /** 지금 마운드 투수가 마선수인가 (0xb633c = 레코드 `+0xa` 비트6, ac4f2) */
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
  /** 루에 나가 있는 주자 수 (ac5aa 0xa9598 = 주자 목록 길이) — 9회 이후 마무리 상황 판정에 쓴다 */
  readonly runnerCount: number
}

export interface PitcherChangeDecision {
  /**
   * 바꾸는가 (`[sp+8]`). 9회 이후 **마무리 상황이면 이것도 참이다** — ac5b4~ac5c2 가 `[sp+4]` 를 세우며
   * 곧장 ac5c0 의 `[sp+8] = 1` 로 간다 (아래 `judgePitcherChange` 디스어셈).
   */
  readonly replace: boolean
  /**
   * "마무리 상황" 표시 `[sp+4]`. 새 투수를 어떻게 고를지를 가른다 (0xac5d8~0xac61c):
   *   - 마무리 상황이 **아니고** 벤치에 마선수가 있으면(0xb8a8d) 0xac360 을 굴려, 참이면 벤치 **마지막**에서 고른다
   *   - 그 밖이면 굴리지 않고 곧장 0xabfcc(`chooseReplacementPitcher`) 로 간다
   *     (이때 0xabfcc 의 다섯째 인자 = 마무리 플래그 → `lateInningFlag`)
   * ⚠️ E-6 4절 3c 가 이 방향을 **거꾸로** 적었던 것을 CORRECTIONS 가 정정했다 ("E: 새 투수는
   * … 방향이 반대", V3-E "새 투수 고르기 방향이 반대").
   */
  readonly saveSituation: boolean
}

/** 특수 투수 문턱 (E 3c) — 이닝 실점 > 2 · 투수 실점 > 3 · 체력 ≤ 39% */
const SPECIAL = { inningRuns: 2, runs: 3, staminaPercent: 39 } as const
/** 선발·중간(역할 0·1) 공통 문턱 */
const COMMON = { inningRuns: 2, staminaPercent: 19 } as const
/** 9회 이후 마무리 상황 — `0 < 리드 ≤ 5` 이고 (리드 ≤ 3 또는 리드 ≤ 주자 수 + 2) */
const SAVE = { maximumLead: 5, comfortableLead: 3, runnerBonus: 2 } as const
/** 0-기준 이닝 7 을 **넘어야** 마무리 상황을 센다 (ac574 `cmp r6,#7 ; ble`) — 곧 9회부터 */
const SAVE_AFTER_INNING_INDEX = 7

/**
 * `0xac428` 의 교체 판정 (디스어셈 ac428~ac656 — 이 함수는 ac44e~ac5d4 까지). 이닝은 **0-기준**
 * state+0x6b 다 (CORRECTIONS 의 V3 정정 — 1-기준으로 옮기면 1~4회 / 5회 / 7회 / 6회·8회 이상).
 *
 * ```
 * ac44e  벤치(team+0x33) ≤ [sp+0x58] → 0
 * ac458  벤치 ≤ 1 이고 [sp+4](모드 3) 이고 벤치 0번이 0xb6389(내 선수) → 0   ← 부르는 쪽(simulateHalfInning)
 * ac486  state[0xd] → 0
 * ac48e  P = 0xae83c(team) · s = 0xaebb0(team)(체력%) · 보직 = 0xb6dec(P)
 *        B = 0xa61b8(rec,1,1) · A = 0xa61b8(rec,0,1) · inn = state[0x6b]
 *        리드 = 0xb69b0(state, state[0xa]) − 0xb69b0(state, state[9])
 * ac4f2  0xb633c(P) 마선수 : A>2 · B>3 · s≤39 → ac5c0(교체) , 아니면 → 0 (ac568)
 * ac50e  보직 < 0 → ac5c4 · 보직 ≥ 2 : 보직 == 2 이고 A ≠ 0 이고 리드 ≤ −2 → ac5c0 , 아니면 ac5c4
 * ac526  보직 0·1 :
 *          A>2 · s≤19            → ac53a: 교체=1 → ac574
 *          inn ≤ 3 : B>4 → ac53a , 아니면 → ac574
 *          inn == 4 : B>4 && s≤49 → ac5c0 , 아니면 ac5c4
 *          inn == 6 : B>2 && s≤29 → 교체=1 , → ac5c4
 *          그 밖(5 · ≥7) : A>1 → 교체=1 , → ac574
 * ac574  inn ≤ 7 → ac5c4
 *        d = 리드 ; d ≤ 0 · d > 5 → ac5c4
 *        d ≤ 3 → 마무리=1
 *        d ≤ 0xa9598(주자관리)+2 → 마무리=1 → ac5c0(교체=1)
 *        아니면 마무리 ? ac5c0(교체=1) : ac5c4
 * ac5c4  [sp+8](강제) → 교체=1 (부르는 쪽 `force`) ; 교체가 0 이면 → 0
 * ```
 * 곧 **9회 이후 마무리 상황이면 교체도 참**이고(ac5b6·ac5c0), A>2·체력≤19% 로 바꿀 때도 ac574 에서
 * 마무리 상황을 센다. inn == 4 · inn == 6 갈래와 마선수·보직 2 갈래는 ac574 를 안 지나 마무리 상황이 없다.
 *
 * 보직 3(`+0xb & 3 == 3`)은 ac518 에서 ac5c4 로 빠져 판정으로는 안 바꾼다 — 웹 `PitcherRole` 에 3 이 없어 여기 없다.
 * 주자 수는 0xa9598(주자 목록 길이)이고, 마무리 굴림 0xac360 은 0xa9888(루 0~3 에 선 주자 수)을 센다 —
 * 웹은 두 값을 가르지 않는다(죽은 주자가 목록에 남는 순간은 간이 엔진에 없다, I 4절).
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
    // 역할 2(마무리)는 이닝 실점이 있고 2점 이상 뒤지면 내린다 (ac51c~ac524)
    return { replace: a !== 0 && input.lead <= -2, saveSituation: false }
  }

  const inn = input.inningIndex
  let replace: boolean
  if (a > COMMON.inningRuns || s <= COMMON.staminaPercent) {
    replace = true // ac53a → ac574
  } else if (inn <= 3) {
    replace = b > 4 // ac534 → ac53a / ac574
  } else if (inn === 4) {
    return { replace: b > 4 && s <= 49, saveSituation: false } // ac540 → ac5c0 / ac5c4
  } else if (inn === 6) {
    return { replace: b > 2 && s <= 29, saveSituation: false } // ac552 → ac5c4
  } else {
    replace = a > 1 // ac56c → ac574
  }

  // ac574~ac5c2 — 9회 이후 마무리 상황이면 교체도 1
  const lead = input.lead
  const saveSituation =
    inn > SAVE_AFTER_INNING_INDEX &&
    lead > 0 &&
    lead <= SAVE.maximumLead &&
    (lead <= SAVE.comfortableLead || lead <= input.runnerCount + SAVE.runnerBonus)
  return { replace: replace || saveSituation, saveSituation }
}

/**
 * 마무리 투입 굴림 `0xac360` — 참이면 새 투수를 **벤치 마지막**에서 고른다.
 * 확률은 `d_level.dat[0x36..0x3b]` = 45·35·50·60·60·30 % (P7 E2 확정).
 *
 * ⚠️ 이 굴림은 **마무리 상황이 아니고 벤치에 마선수가 있을 때만** 돈다 (V3-E 정정 · 0xb8a8d) —
 * `replacementPitcherSlotOf` 참고.
 *
 * 디스어셈 ac360~ac408: 0xb6c20(state,1)==1 && 0xb6c20(state,0)==1 → 0 (난수 없음) ·
 * 칸 k (inn==8 → 1 · inn==7 → 2 · 리드<0 → 3 · 0xa9888(루 위 주자)>1 → 4 · 리드==1 → 5 · 그 밖 0) ·
 * `d_level[0x36+k] > rand(0,100)` (0xbfa54) 이면 참. 사이의 0x1f1d8 은 `[r0+0xac]` 읽기뿐이다.
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

/**
 * **로스터 투수 칸별 보직** — `XlsPITCHER_DATA` 레코드 `+0xb & 3` (0xb6dec → 0xb6704 가 읽는 칸).
 * 레코드 0x30 바이트가 표 한 줄 그대로이고, 15팀 × 8줄 120줄이 **모두 팀 안 차례 [0,0,0,0,1,1,1,2]** 다
 * (`base/extracted/XlsPITCHER_DATA.json` 의 줄마다 바이트 11 을 풀어 확인 — 선발 넷 · 중간 셋 · 마무리 하나).
 * 웹 로스터 JSON 에는 이 칸이 없어(생성기 몫) 여기 표로 둔다. 생성기가 `+0xb` 를 싣게 되면 그 값으로 바꾼다.
 *
 * 선발 교체 0xb5e98(0↔k, k ≤ 3)·4인 로테이션은 선발끼리만 맞바꾸므로 칸의 보직이 그대로다.
 */
export const ROSTER_PITCHER_ROLES: readonly PitcherRole[] = [0, 0, 0, 0, 1, 1, 1, 2]

/** 로스터 투수 칸(팀 안 0~7)의 보직. 그 밖의 칸(마투수 8번 · 투수편의 내 투수 등)은 모른다 */
export function rosterPitcherRoleOf(slot: number): PitcherRole | undefined {
  return ROSTER_PITCHER_ROLES[slot]
}

/** 새 투수 후보 한 명 — 벤치 칸과, 고를 때 보는 값들 */
export interface ReplacementCandidate {
  /** 로스터 칸 */
  readonly index: number
  /** 스태미나 0~10000 (`+0x2c`). 모르면 `FULL_STAMINA` */
  readonly stamina?: number
  /** 보직. **웹 로스터에는 이 값이 없다** — 넣어 주면 원본 순서를 그대로 쓴다 */
  readonly role?: PitcherRole
  /** 마선수인가 — 0xb633c = 레코드 `+0xa` **비트6**. 0xabfcc 는 늘 거르고, 0xb8a8d 는 이것을 찾는다 */
  readonly isSpecialPitcher?: boolean
  /** 내 육성 선수인가 — 0xb6388 = 레코드 `+0xa` **비트7**(부호). 모드 3 에서만 거른다 */
  readonly isOwnPlayer?: boolean
  /**
   * 능력 합 `0xb5b50(팀, P)` — 마무리 갈래(ac0be)가 이 값 큰 순으로 줄 세운다. `pitcherAbilitySumOf` 로 만든다.
   * 마무리 후보에 하나라도 없으면 그 갈래는 예전 근사(스태미나 순)로 고른다.
   */
  readonly abilitySum?: number
}

/**
 * 능력 합 `0xb5b50(팀, P)` (b5b50~b5bb4, 확정): P 가 없으면 0, 아니면
 * `0xb570c(팀, k, P, 1, [sp]=90, [sp+4]=1)` 을 k = 0·1·2·3(제구·구속·변화·**체력**) 네 칸 더한 값.
 * 체력 인자 90 이라 피로(0xb58e6)는 없고, 팀 능력치·코치 정액과 0..999 자르기는 칸마다 먹는다 —
 * 곧 **경기용 능력치 네 칸(체력 인자 90)의 합**이다.
 */
export function pitcherAbilitySumOf(gameAbilities: readonly number[]): number {
  return (gameAbilities[0] ?? 0) + (gameAbilities[1] ?? 0) + (gameAbilities[2] ?? 0) + (gameAbilities[3] ?? 0)
}

/** 후보 스태미나가 이 값을 넘으면 마무리로 올릴 만하다 (0xabfcc 의 `> 30` = 0.3%) */
const CLOSER_MINIMUM_STAMINA = 30

/**
 * 보직 1 = **중간계투** (P7 E2 확정).
 * `entities/pitcher-career/model/pitcherRole.ts` 는 이 값을 아직 `unknown` 으로 적어 두었다.
 */
const MIDDLE_RELIEVER: PitcherRole = PITCHER_ROLE.unknown

/**
 * 새 투수 고르기 `0xabfcc(경기, team, inn, 내선수거름, [sp]=마무리플래그)` (디스어셈 abfcc~ac1fe).
 *
 * ```
 * abff4  순서 = inn ≤ 7 ? [1,2,0] : 마무리플래그 ? [2,1,0] : [1,2,0]   (보직표 0xd833c = [0,1,2])
 * ac032  보직마다: 벤치 i 중 0xb6dec == 보직 · !0xb633c(마선수) · !(내선수거름 && 0xb6388) 인 칸 목록
 *        비면 → 다음 보직
 * ac0be  2 마무리 : 0xb5b50(능력 합) 큰 순 거품 정렬 → "마운드 투수 +0x2c ≤ 0 이거나 후보 +0x2c > 30" 인 첫 후보
 *                   (없으면 다음 보직). 거품 정렬은 `합(앞) < 합(뒤)` 일 때만 맞바꿔(ac112 `cmp; bge`)
 *                   같은 합이면 벤치 차례 그대로다 — 안정 정렬과 같다
 * ac17a  1 중간   : +0x2c 큰 순 거품 정렬(같으면 앞 칸 그대로) → 첫 후보
 * ac1da  0 선발   : 목록의 **마지막**
 * ac1f4  다 비면 −1
 * ```
 * **마선수는 어느 보직 목록에도 안 든다** — 마선수를 올리는 길은 0xac428 의 "벤치 마지막"(0xac360) 뿐이다.
 *
 * ⚠️ **웹 로스터(`shared/config/original/roster.ts`)에는 보직(`+0xb` 하위 2비트)이 없다.**
 * 후보에 `role` 이 하나도 안 실려 오면 위 순서를 세울 수 없어, 원본의 가장 흔한 갈래인
 * **"중간계투 = 스태미나가 가장 많은 후보"** 만 남긴다 (같으면 벤치 번호가 작은 쪽). **근사다.**
 * 보직을 채우려면 `XlsPITCHER_DATA` 의 레코드 `+0xb` 를 로스터 JSON 에 넣어야 한다.
 * 마무리 갈래의 "능력 합" 0xb5b50 은 후보의 `abilitySum` 이다 — 마무리 후보 중 하나라도 이 값이 없으면
 * 예전처럼 스태미나 순으로 본다(**근사**, 부르는 쪽이 아직 안 넘기는 길).
 */
export function chooseReplacementPitcher(
  candidates: readonly ReplacementCandidate[],
  input: {
    readonly inningIndex: number
    readonly lateInningFlag?: boolean
    /** 지금 마운드에 선 투수의 스태미나 (마무리 갈래가 본다) */
    readonly currentStamina: number
    /** 0xabfcc 넷째 인자 = 0xac428 의 `[sp+4]`(모드 3) — 참이면 내 육성 선수(0xb6388)를 거른다 */
    readonly excludeOwnPlayers?: boolean
  },
): number {
  const usable = candidates.filter(
    (candidate) =>
      candidate.isSpecialPitcher !== true &&
      !(input.excludeOwnPlayers === true && candidate.isOwnPlayer === true),
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
    const pool = usable.filter((candidate) => candidate.role === role)
    if (pool.length === 0) continue
    if (role === PITCHER_ROLE.relief) {
      // ac0be: 능력 합 0xb5b50 큰 순 (같으면 벤치 차례 — 안정 정렬). 합을 모르면 스태미나 순 (근사)
      const sums = pool.map((candidate) => candidate.abilitySum)
      const sorted = sums.every((sum) => sum !== undefined)
        ? [...pool].sort((left, right) => (right.abilitySum ?? 0) - (left.abilitySum ?? 0))
        : [...pool].sort((left, right) => staminaOf(right) - staminaOf(left))
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

export interface ReplacementPickInput {
  /** `judgePitcherChange` 가 세운 "마무리 상황" 표시 */
  readonly saveSituation: boolean
  /** **0-기준** 이닝 (state+0x6b) */
  readonly inningIndex: number
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  readonly runnerCount: number
  /** 지금 마운드에 선 투수의 스태미나 */
  readonly currentStamina: number
  /** 두 팀 다 CPU 조작이면 마무리 굴림 0xac360 이 난수 없이 거짓이다 (0xb6c20) */
  readonly bothTeamsAreCpu?: boolean
  /**
   * 0xac428 의 `[sp+4]` = (모드 == 3). 참이면 0xabfcc 가 내 육성 선수를 거르고, 고른 투수가 내 선수면
   * ac626 에서 **ac5d8 로 돌아가 다시 고른다** (0xac360 을 또 굴린다)
   */
  readonly excludeOwnPlayers?: boolean
}

/** ac626 되돌이의 안전망 (원본에는 없다 — 0xac360 이 참일 확률이 1 보다 작아 언젠가 빠진다) */
const MAXIMUM_REPLACEMENT_PICKS = 1_000

/**
 * 새 투수 고르기 `0xac5d6~0xac640` — 판정(`judgePitcherChange`)이 "바꾼다" 고 한 뒤의 자리.
 *
 * ```
 * ac5d8  0xb8a8d(team, 0) 참 **그리고** 마무리 상황 아님 → 0xac360 굴림
 *            참   → 벤치 **마지막**(벤치 수 − 1)
 *            거짓 → 벤치 ≤ 1 이면 0번, 아니면 0xabfcc
 *        그 밖 → 0xabfcc(…, inn, [sp+4], [sp] = 마무리 플래그)
 * ac622  −1 이면 0 (안 바꿈)
 * ac626  [sp+4] 이고 고른 투수가 0xb6388(내 선수)면 → ac5d8 로 돌아간다
 * ```
 * `0xb8a8d(team, 0)` (b8a8c~b8b00) = **벤치(team+0x33 명)에 마선수(0xb633c)가 하나라도 있나**. 곧 0xac360 은
 * 벤치에 마선수가 있을 때만 굴리고(그때 "벤치 마지막"은 명부 끝에 붙은 마선수 자리다), 마선수가 없는
 * 팀은 **난수 없이** 늘 0xabfcc 로 간다. 후보의 `isSpecialPitcher` 로 이것을 본다.
 *
 * ⚠️ E-defense-rules 4절 3c 가 이 방향을 **거꾸로**("마무리 상황이면 벤치 마지막") 적었던 것을
 * CORRECTIONS 2절이 정정했다 — "E: 새 투수는 … **방향이 반대**". 여기서는 정정 쪽이다.
 */
export function replacementPitcherSlotOf(
  bench: readonly ReplacementCandidate[],
  input: ReplacementPickInput,
  random: RandomPort,
): number {
  const benchHasSpecialPitcher = bench.some((candidate) => candidate.isSpecialPitcher === true)
  const chooses = () =>
    chooseReplacementPitcher(bench, {
      inningIndex: input.inningIndex,
      // 0xabfcc 의 다섯째 인자가 마무리 플래그다 (V3-E)
      lateInningFlag: input.saveSituation,
      currentStamina: input.currentStamina,
      excludeOwnPlayers: input.excludeOwnPlayers,
    })
  for (let attempt = 0; attempt < MAXIMUM_REPLACEMENT_PICKS; attempt += 1) {
    let picked: number
    if (benchHasSpecialPitcher && !input.saveSituation) {
      const closer = rollsCloser(
        {
          inningIndex: input.inningIndex,
          lead: input.lead,
          runnerCount: input.runnerCount,
          bothTeamsAreCpu: input.bothTeamsAreCpu,
        },
        random,
      )
      if (closer) picked = bench[bench.length - 1]?.index ?? -1
      else if (bench.length <= 1) picked = bench[0]?.index ?? -1
      else picked = chooses()
    } else {
      picked = chooses()
    }
    if (picked < 0) return -1
    const own = bench.find((candidate) => candidate.index === picked)?.isOwnPlayer === true
    if (input.excludeOwnPlayers === true && own) continue
    return picked
  }
  return -1
}
