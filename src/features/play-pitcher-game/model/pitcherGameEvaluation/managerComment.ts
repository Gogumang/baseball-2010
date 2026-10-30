import { isStarterTypePosition, PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_ENTRY_USER_EVENT_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherEvaluationContext } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/* ── 5-5. 감독 평가 글 0x1278c ──────────────────────────────────────────────────── */

/** 평판 구간 문턱 표 `0xcc562` */
export const MANAGER_TEXT_REPUTATION_LIMITS: readonly number[] = [150, 450, 750, 1000]
/** 등급 표 `0xcc558` */
export const MANAGER_TEXT_GRADES: readonly number[] = [-2, -1, 0, 1, 2, 3, 4, 5, 6]
/** 선발형이면 칸 3~8 이 두 배가 된다 (0x1285a) — 선발 p 눈금과 맞춘다 */
export const MANAGER_TEXT_GRADES_STARTER: readonly number[] = [-2, -1, 0, 2, 4, 6, 8, 10, 12]
/** 모드 3(투수) 의 구간 시작 번호 (0x128ac 가 스택에 직접 쓴다) */
export const MANAGER_TEXT_SECTION_STARTS: readonly number[] = [2, 11, 20, 29]

/**
 * 경기 뒤 감독 평가 글 StrUSER_EVT 번호.
 *
 * 구원이 등판조차 못 했으면 **38 "오늘은 등판할 기회가 없었구나."** 다 (0x12ac4).
 * 선발에는 38 이 나오지 않는다.
 *
 * 원본 조건은 세 가지다: 보직 ≠ 0 · `state+0x6a == state+0x6b` · **"결과 칸(+6) == 0"**.
 * 셋째 칸이 무엇인지는 P1 5-5 도 이름을 적지 않았다 — **값이 없어 검사에서 뺀다.**
 * (그 상황이면 인기도 p 도 0 이 되므로(5-3) 실제 결과는 같을 것으로 본다 — 추정.)
 */
export function managerCommentIndexOf(
  context: Pick<PitcherEvaluationContext, 'role' | 'neverEntered' | 'reputation' | 'positionCode'>,
  popularity: number,
): number {
  if (context.role !== PITCHER_ROLE.starter && context.neverEntered) {
    return NO_ENTRY_USER_EVENT_INDEX
  }
  const section = MANAGER_TEXT_REPUTATION_LIMITS.findIndex((limit) => context.reputation < limit)
  // 0x128d8~0x128f4: 평판 < 문턱인 첫 칸에서만 바꾼다 — 다 넘으면(≥ 1000) 0x12876 이 먼저 둔 구간 0(바탕 2) 그대로.
  // 평판은 쓰는 곳마다 0~999 로 잘려 실제로는 안 닿는다(타자편 97398e8 과 같다)
  const sectionIndex = section < 0 ? 0 : section
  const grades = isStarterTypePosition(context.positionCode) ? MANAGER_TEXT_GRADES_STARTER : MANAGER_TEXT_GRADES
  const slot = grades.indexOf(popularity)
  return MANAGER_TEXT_SECTION_STARTS[sectionIndex] + (slot < 0 ? 0 : slot)
}
