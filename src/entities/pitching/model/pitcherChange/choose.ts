import { FULL_STAMINA, PITCHER_ROLE, type PitcherRole } from '@/entities/pitching/model/pitcherChange/otherSlices'
import type { ReplacementCandidate } from '@/entities/pitching/model/pitcherChange/types'

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
 * 보직은 레코드 `+0xb` 하위 2비트다 — 웹 로스터 `RosterPlayer.profile & 3` = `rosterPitcherRoleOf(칸)` 이고, 진행기들
 * (`simulateHalfInning` 의 `roleAt`)이 후보마다 싣는다.
 * ⚠️ 후보에 `role` 이 하나도 안 실려 오면(보직을 안 넘기는 옛 길 · 시험) 위 순서를 세울 수 없어, 원본의 가장 흔한 갈래인
 * **"중간계투 = 스태미나가 가장 많은 후보"** 만 남긴다 (같으면 벤치 번호가 작은 쪽). **근사다.**
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
  const usable = candidates.filter((candidate) => isUsableCandidate(candidate, input.excludeOwnPlayers === true))
  if (usable.length === 0) return -1
  // 보직을 모를 때의 갈래 — 스태미나 최고, 같으면 벤치 번호가 작은 쪽
  if (!usable.some((candidate) => candidate.role !== undefined)) return mostRestedOf(usable).index

  for (const role of roleOrderOf(input.inningIndex, input.lateInningFlag === true)) {
    const pool = usable.filter((candidate) => candidate.role === role)
    if (pool.length === 0) continue
    const picked = pickFromRolePool(role, pool, input.currentStamina)
    if (picked !== undefined) return picked.index
  }
  return -1
}

/** 마선수는 늘, 모드 3 이면 내 육성 선수도 거른다 */
function isUsableCandidate(candidate: ReplacementCandidate, excludeOwnPlayers: boolean): boolean {
  return candidate.isSpecialPitcher !== true && !(excludeOwnPlayers && candidate.isOwnPlayer === true)
}

const staminaOf = (candidate: ReplacementCandidate) => candidate.stamina ?? FULL_STAMINA

/** 스태미나 최고 — 같으면 앞 칸 */
function mostRestedOf(pool: readonly ReplacementCandidate[]): ReplacementCandidate {
  return pool.reduce((best, candidate) => (staminaOf(candidate) > staminaOf(best) ? candidate : best))
}

/** 보직 순서 — inn ≤ 7 이면 [1,2,0], 마무리 플래그면 [2,1,0] (abff4). 보직 0 선발 · 1 중간계투 · 2 마무리 */
function roleOrderOf(inningIndex: number, lateInningFlag: boolean): readonly PitcherRole[] {
  if (inningIndex > 7 && lateInningFlag) return [PITCHER_ROLE.relief, MIDDLE_RELIEVER, PITCHER_ROLE.starter]
  return [MIDDLE_RELIEVER, PITCHER_ROLE.relief, PITCHER_ROLE.starter]
}

/** 그 보직 목록에서 하나 — 마무리는 조건에 맞는 첫 후보(없으면 undefined), 중간은 스태미나 최고, 선발은 마지막 */
function pickFromRolePool(role: PitcherRole, pool: readonly ReplacementCandidate[], currentStamina: number): ReplacementCandidate | undefined {
  if (role === PITCHER_ROLE.relief) return pickCloserOf(pool, currentStamina)
  if (role === MIDDLE_RELIEVER) return [...pool].sort((left, right) => staminaOf(right) - staminaOf(left))[0]
  return pool[pool.length - 1]
}

/**
 * ac0be: 능력 합 0xb5b50 큰 순 (같으면 벤치 차례 — 안정 정렬). 합을 모르면 스태미나 순 (근사) →
 * "마운드 투수 +0x2c ≤ 0 이거나 후보 +0x2c > 30" 인 첫 후보
 */
function pickCloserOf(pool: readonly ReplacementCandidate[], currentStamina: number): ReplacementCandidate | undefined {
  const hasAbilitySums = pool.every((candidate) => candidate.abilitySum !== undefined)
  const sorted = hasAbilitySums
    ? [...pool].sort((left, right) => (right.abilitySum ?? 0) - (left.abilitySum ?? 0))
    : [...pool].sort((left, right) => staminaOf(right) - staminaOf(left))
  return sorted.find((candidate) => currentStamina <= 0 || staminaOf(candidate) > CLOSER_MINIMUM_STAMINA)
}
