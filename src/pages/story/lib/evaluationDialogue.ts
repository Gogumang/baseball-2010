import type { EventPortrait } from '@/shared/config/original/eventTypes'

/**
 * **116 평가 내장 이벤트 0x8a6fc 의 say 두 줄** — 인물 · 표정 (직접 떴다).
 *
 * ```
 * 0x8a6fc  명령 1(+0x14, 0x28 바이트 0xac7e5 — say): 인물 수 +4 = 1 · 캐릭터 +5 = 2(감독) · 자리 +6 = 0(오른쪽)
 *          표정 +8 = 인자 [sp+0xe4] (8 이면 인기도 변화로: < 0 → 3 · ≤ 1 → 0 · 그 밖 1 — 표에 8 이 없어 안 쓰인다)
 *          말하는 이 +0x20 은 안 적는다(0) → 머리말 없음 · 글 +0x1e = 감독 글 번호
 *          명령 3(+0x1c, 연속 기록 알림이 있을 때 — 0x8ac1a): say · +4 = 1 · +5 = 2 · 표정 +8 = 나쁜 칸이 있으면 3 아니면 1 ·
 *          글 +0x1e = 10000 (전역 버퍼 0x1552af4 — 알림 줄) · 말하는 이 0
 * 116 진입 0x1278c  표정 인자 = 표[구간 × 9 + 칸]  — 모드 4 표 0xcc600 · 모드 3 표 0xcc570 (각 4 × 9 워드, 0x128bc~0x128ce 복사)
 *          구간: 평판 S+0x62 < [150, 450, 750, 1000](0xcc562) 인 첫 칸 — 다 넘으면 0 (감독 글 바탕도 구간 0 값이다)
 *          칸: 인기도 변화 S+0x4a 가 [−2 … 6](0xcc558, 모드 3 은 포지션 ≤ 3 이면 칸 3~8 두 배)의 몇째인지 — 없으면 표정 0
 *          모드 3 감독 글 38(등판 없음, 0x12af8)이면 표정 0
 * ```
 * 인물 그림은 이벤트 초상화와 같다 — 캐릭터 2 기본번호 0xd0ae6[2] = 16 + 표정 (`NARI_YEAR_START_EVENT` 와 같은 감독).
 */

const MANAGER_PORTRAIT_BASE = 16
/** 0xcc562 — 평판 구간 */
const REPUTATION_LIMITS = [150, 450, 750, 1000] as const
/** 0xcc558 — 인기도 변화 칸 */
const POPULARITY_GRADES = [-2, -1, 0, 1, 2, 3, 4, 5, 6] as const
/** 0xcc600 — 모드 4(타자편) 표정 */
const BATTER_EXPRESSIONS: readonly number[] = [
  3, 3, 3, 6, 0, 0, 1, 1, 4,
  6, 3, 3, 0, 0, 0, 1, 1, 4,
  3, 6, 0, 0, 0, 0, 1, 1, 1,
  6, 0, 0, 0, 0, 1, 1, 1, 1,
]
/** 0xcc570 — 모드 3(투수편) 표정 */
const PITCHER_EXPRESSIONS: readonly number[] = [
  3, 3, 0, 0, 0, 0, 1, 1, 4,
  3, 3, 6, 0, 0, 0, 1, 4, 1,
  3, 6, 0, 0, 0, 0, 1, 1, 1,
  6, 0, 0, 0, 0, 1, 1, 1, 1,
]
/** 모드 3 감독 글 바탕(구간별) — 0x128ac~0x128ba */
const PITCHER_COMMENT_BASES = [2, 11, 20, 29] as const
/** 모드 3 "등판할 기회가 없었구나" — 표정 0 (0x12afe) */
const PITCHER_NO_APPEARANCE_COMMENT = 38
/** 연속 기록 알림 say 의 표정 — 나쁜 칸이 있으면 3 · 아니면 1 (0x8ac32~0x8ac3e) */
const STREAK_EXPRESSION = { bad: 3, good: 1 } as const

/** 0x128d8~0x128f4 — 평판 구간 (다 넘으면 0) */
export function evaluationReputationTierOf(reputation: number): number {
  const tier = REPUTATION_LIMITS.findIndex((limit) => reputation < limit)
  return tier < 0 ? 0 : tier
}

/** 타자편 감독 say 의 표정 — 표 0xcc600[구간 × 9 + 칸] (칸이 없으면 0) */
export function batterEvaluationExpressionOf(reputation: number, popularityChange: number): number {
  const grade = POPULARITY_GRADES.indexOf(popularityChange as (typeof POPULARITY_GRADES)[number])
  if (grade < 0) return 0
  return BATTER_EXPRESSIONS[evaluationReputationTierOf(reputation) * POPULARITY_GRADES.length + grade] ?? 0
}

/**
 * 투수편 감독 say 의 표정 — 표 0xcc570[구간 × 9 + 칸]. 칸은 116 이 고른 감독 글 번호에서 거꾸로 읽는다
 * (글 = 구간 바탕 + 칸 — 포지션 두 배 칸 표를 다시 짓지 않으려고). 글 38 · 범위 밖이면 0.
 */
export function pitcherEvaluationExpressionOf(reputation: number, managerCommentIndex: number): number {
  if (managerCommentIndex === PITCHER_NO_APPEARANCE_COMMENT) return 0
  const tier = evaluationReputationTierOf(reputation)
  const grade = managerCommentIndex - PITCHER_COMMENT_BASES[tier]
  if (grade < 0 || grade >= POPULARITY_GRADES.length) return 0
  return PITCHER_EXPRESSIONS[tier * POPULARITY_GRADES.length + grade] ?? 0
}

/** 연속 기록 알림 say 의 표정 */
export function streakSayExpressionOf(hasBad: boolean): number {
  return hasBad ? STREAK_EXPRESSION.bad : STREAK_EXPRESSION.good
}

/** 캐릭터 2(감독) · 오른쪽 · 표정 */
export function evaluationManagerPortraitsOf(expression: number): readonly EventPortrait[] {
  return [{ file: 'event_char_0', animation: MANAGER_PORTRAIT_BASE + expression, side: 'right' }]
}
