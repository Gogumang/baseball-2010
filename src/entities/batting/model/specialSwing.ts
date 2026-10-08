import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 필살타법 성공 판정 (경기 `0x34c74` → 타구 처리 `0x517e6` — H2 2-2 확정).
 *
 * ```
 * p% = 마타자(S+0x24 순번 ≥ 0) 면 30, 아니면 표 0xcfdbe[번호−1] = 15·20·25·25·30
 * 성공 = p·10 > rand(0, 1000)
 * ```
 * 성공하면 그 타구에 **"송구공" 비트**가 붙어 야수가 쥐지 않고 지나친다
 * (`0x51800` → `features/defense-play` 의 `isUncatchable`, S13 6절).
 *
 * ⚠️ 필살은 **그 공 한 번의 스윙에만** 걸린다 — 새 투구 준비 `0x34334` 가 `S+0x10` 을 0 으로
 * 되돌린다(0x34444). 부르는 쪽이 투구마다 다시 눌러야 한다.
 */

/**
 * 표 `0xcfdbe` — 필살타법 **번호**(선수 +0x18) 1~5 의 성공 확률 %. 색인은 `번호 − 1` (0x34cb0).
 * 저장 번호는 1~4 뿐이라(0x1816c) 다섯째 30 은 쓰이지 않는다 — 장타형 메테오도 번호 4 → 25%.
 */
export const SPECIAL_SWING_PERCENTS: readonly number[] = [15, 20, 25, 25, 30]
/** 마타자는 번호와 무관하게 30% 다 (0x34c74) */
export const ACE_BATTER_SPECIAL_SWING_PERCENT = 30
/** `p·10 > rand(0, 1000)` — 원본이 천분율로 굴린다 */
const RANDOM_LIMIT = 1000

/**
 * 그 타자의 성공 확률 % — **레벨(+0x201)이 아니라 고른 번호(+0x18)** 로 고른다.
 * 번호 0(안 고름)이면 0 이다 (원본은 그때 '0' 키부터 무시한다 — 0x51e14).
 */
export function specialSwingPercentOf(swingNumber: number, isAceBatter = false): number {
  if (isAceBatter) return ACE_BATTER_SPECIAL_SWING_PERCENT
  if (swingNumber <= 0) return 0
  return SPECIAL_SWING_PERCENTS[Math.min(swingNumber, SPECIAL_SWING_PERCENTS.length) - 1] ?? 0
}

/** 필살 스윙이 성공했는가 — 성공하면 그 타구를 아무도 못 잡는다 */
export function rollSpecialSwing(swingNumber: number, random: RandomPort, isAceBatter = false): boolean {
  const percent = specialSwingPercentOf(swingNumber, isAceBatter)
  if (percent <= 0) return false
  return percent * 10 > random.rand(0, RANDOM_LIMIT)
}

/**
 * 표 `0xd84f0` (u8) — 육성·일반 타자의 **한 경기 필살 횟수**, 색인 = 고른 번호(+0x18).
 * 0 파워 없음 · 1 파워 2 · 2 플레임 3 · 3 토네이도 4 · 4 미라지·메테오 5 (색인 5~ 는 안 쓰임 — H2 1-2).
 */
export const SPECIAL_SWING_COUNT_BY_NUMBER: readonly number[] = [0, 2, 3, 4, 5, 5]
/** 표 `0xd84fa` (s8) — 마타자 레벨(`mgr[0x13f + 순번]`) 0~4 별 횟수 */
export const SPECIAL_SWING_COUNT_BY_ACE_LEVEL: readonly number[] = [2, 2, 3, 4, 5]
/** 타자 스킬 23 무자비 — "필살타법 횟수 +1" (StrCOMMON 78) */
export const RUTHLESS_SKILL_ID = 23
const RUTHLESS_SKILL_BONUS = 1

/**
 * 한 경기 필살 횟수 — 타석 교대·교체 처리 `0xaebe4` 가 **남은 칸이 음수일 때만** 채운다 (H2 1-2):
 * ```
 * B+0x18 == 0           → 0
 * 마타자(0xb633d)        → s8 0xd84fa[레벨]
 * 아니면                 → u8 0xd84f0[B+0x18]
 * 스킬 23 (0xb62b4(B, 0x17)) 이면 +1
 * ```
 * 칸은 팀의 **타순별**(팀+0x29+타순)이라 경기 전체에 한 번 주어지고 이닝이 바뀌어도 다시 차지 않는다.
 * 대타 등 교체 때만 −1(빈 칸)로 되돌려 새 선수가 자기 횟수를 받는다.
 */
export function specialSwingCountOf(input: {
  /** 선수 +0x18. 마타자는 5~9 */
  readonly swingNumber: number
  readonly isAceBatter: boolean
  /** 마타자 레벨 0~4 */
  readonly aceLevel?: number
  /** 스킬 23 장착 (0xb62b4 = 장착 비트) */
  readonly hasRuthlessSkill?: boolean
}): number {
  if (input.swingNumber === 0) return 0
  const base = input.isAceBatter
    ? (SPECIAL_SWING_COUNT_BY_ACE_LEVEL[Math.min(Math.max(input.aceLevel ?? 0, 0), SPECIAL_SWING_COUNT_BY_ACE_LEVEL.length - 1)] ?? 0)
    : (SPECIAL_SWING_COUNT_BY_NUMBER[Math.min(Math.max(input.swingNumber, 0), SPECIAL_SWING_COUNT_BY_NUMBER.length - 1)] ?? 0)
  return base + (input.hasRuthlessSkill === true ? RUTHLESS_SKILL_BONUS : 0)
}

/**
 * '0' 키를 받는가 — 메시지 0x6a6 처리 `0x51e14`: `0xaea30(팀) == 0` 이면 무시.
 * 0xaea30 = `타자+0x18 == 0 ? 0 : s8 팀[+0x29 + 타순]` 이라 **0 만** 막는다(−1 "안 채움" 은 통과).
 * `remaining` 을 모르면(undefined) 횟수 제한 없이 번호만 본다.
 */
export function canSpecialSwing(swingNumber: number, isAceBatter: boolean, remaining?: number): boolean {
  // 마선수 레코드 +0x18 은 늘 5~9 라 마타자는 번호 가드에 안 걸린다 (H2 4-1)
  if (swingNumber === 0 && !isAceBatter) return false
  return remaining !== 0
}

/**
 * 실제 스윙이 나가는 틱 `0x4e136`: `S+0x10 ≠ 0 && 0xaea30(팀) > 0` 이면 `0xae9e8(팀, 남은 − 1)`.
 * 결과와 무관하다 — 헛스윙이어도 줄어든다. 음수(안 채움)·0 은 그대로 둔다.
 */
export function remainingAfterSpecialSwing(remaining: number): number {
  return remaining > 0 ? remaining - 1 : remaining
}
