import { PITCHER_ROLE, staminaPercentOf } from '@/entities/pitching/model/pitcherChange/otherSlices'
import type { PitcherChangeDecision, PitcherChangeInput } from '@/entities/pitching/model/pitcherChange/types'

/** 특수 투수 문턱 (E 3c) — 이닝 실점 > 2 · 투수 실점 > 3 · 체력 ≤ 39% */
const SPECIAL = { inningRuns: 2, runs: 3, staminaPercent: 39 } as const
/** 선발·중간(역할 0·1) 공통 문턱 */
const COMMON = { inningRuns: 2, staminaPercent: 19 } as const
/** 9회 이후 마무리 상황 — `0 < 리드 ≤ 5` 이고 (리드 ≤ 3 또는 리드 ≤ 주자 수 + 2) */
const SAVE = { maximumLead: 5, comfortableLead: 3, runnerBonus: 2 } as const
/** 0-기준 이닝 7 을 **넘어야** 마무리 상황을 센다 (ac574 `cmp r6,#7 ; ble`) — 곧 9회부터 */
const SAVE_AFTER_INNING_INDEX = 7

/** inn ≤ 3 — B > 4 (ac534) */
const EARLY = { lastInningIndex: 3, runs: 4 } as const
/** inn == 4 — B > 4 && s ≤ 49 (ac540) · inn == 6 — B > 2 && s ≤ 29 (ac552) */
const FIFTH_INNING = { inningIndex: 4, runs: 4, staminaPercent: 49 } as const
const SEVENTH_INNING = { inningIndex: 6, runs: 2, staminaPercent: 29 } as const
/** 그 밖(5 · ≥7) — A > 1 (ac56c) */
const LATE_INNING_RUNS = 1
/** 마무리(역할 2)는 이닝 실점이 있고 이만큼 이상 뒤지면 내린다 (ac51c~ac524) */
const RELIEF_PULL_DEFICIT = -2

const NO_CHANGE: PitcherChangeDecision = { replace: false, saveSituation: false }

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
  if (input.benchCount <= (input.minimumBench ?? 1)) return NO_CHANGE
  if (input.justChanged === true) return NO_CHANGE

  const s = staminaPercentOf(input.stamina)
  if (input.isSpecialPitcher === true) return { replace: isSpecialPitcherSpent(input, s), saveSituation: false }
  // 역할 2(마무리)는 이닝 실점이 있고 2점 이상 뒤지면 내린다 (ac51c~ac524)
  if (input.role === PITCHER_ROLE.relief) return { replace: input.inningRunsAllowed !== 0 && input.lead <= RELIEF_PULL_DEFICIT, saveSituation: false }
  return regularPitcherDecisionOf(input, s)
}

/** ac4f2 마선수 — A > 2 · B > 3 · s ≤ 39 */
function isSpecialPitcherSpent(input: PitcherChangeInput, s: number): boolean {
  return input.inningRunsAllowed > SPECIAL.inningRuns || input.runsAllowed > SPECIAL.runs || s <= SPECIAL.staminaPercent
}

/** inn == 4 · inn == 6 — ac540 · ac552: ac574 를 안 지나 마무리 상황이 없다. 그 밖 이닝이면 null */
function midInningDecisionOf(inn: number, b: number, s: number): PitcherChangeDecision | null {
  if (inn === FIFTH_INNING.inningIndex) return { replace: b > FIFTH_INNING.runs && s <= FIFTH_INNING.staminaPercent, saveSituation: false }
  if (inn === SEVENTH_INNING.inningIndex) return { replace: b > SEVENTH_INNING.runs && s <= SEVENTH_INNING.staminaPercent, saveSituation: false }
  return null
}

/** 보직 0·1 (ac526~ac5c2) — A > 2 · s ≤ 19 면 곧장 교체(ac53a), 아니면 이닝별 문턱. 9회 이후 마무리 상황이면 교체도 1 */
function regularPitcherDecisionOf(input: PitcherChangeInput, s: number): PitcherChangeDecision {
  const inn = input.inningIndex
  const isTired = input.inningRunsAllowed > COMMON.inningRuns || s <= COMMON.staminaPercent
  const midInning = isTired ? null : midInningDecisionOf(inn, input.runsAllowed, s)
  if (midInning !== null) return midInning
  const replace = isTired || (inn <= EARLY.lastInningIndex ? input.runsAllowed > EARLY.runs : input.inningRunsAllowed > LATE_INNING_RUNS)
  const saveSituation = isSaveSituation(input)
  return { replace: replace || saveSituation, saveSituation }
}

/** ac574~ac5c2 — 9회 이후 `0 < 리드 ≤ 5` 이고 (리드 ≤ 3 또는 리드 ≤ 주자 수 + 2) */
function isSaveSituation(input: PitcherChangeInput): boolean {
  const lead = input.lead
  if (input.inningIndex <= SAVE_AFTER_INNING_INDEX || lead <= 0 || lead > SAVE.maximumLead) return false
  return lead <= SAVE.comfortableLead || lead <= input.runnerCount + SAVE.runnerBonus
}
