import type { AtBatOutcome } from '@/entities/career/model/gameEvaluation/otherSlices'

export interface AtBatContext {
  readonly outcome: AtBatOutcome
  readonly runsBattedIn: number
  /** 이 플레이 하나로 늘어난 아웃 수 — 2 이상이면 병살 */
  readonly outsInPlay: number
  readonly isWalkOff: boolean
}

/** 홈런의 인기도 점수 — 칸은 루타가 아니라 **득점 수**다: 솔로 3 · 투런 4 · 스리런 5 · 만루 6 */
const HOME_RUN_POINTS_BY_RUNS = [3, 4, 5, 6]
/** 끝내기 홈런 */
const WALK_OFF_HOME_RUN = 5
/** 홈런이 아닌 끝내기 — 원본은 "끝내기 **그리고** 득점 > 0" 일 때만 이 가지로 간다 */
const WALK_OFF_HIT = 4
/** 득점 점수 — 득점 1 → +1 · 2~3 → +2, 그 밖 0 (칸 = 득점 수) */
const RUN_POINTS_BY_RUNS = [0, 1, 2, 2]
export const DOUBLE_PLAY_OUTS = 2

/** 홈런 타석 — 끝내기면 +5, 아니면 득점 수 칸 */
function homeRunPoints(runsBattedIn: number, isWalkOff: boolean): number {
  if (isWalkOff) return WALK_OFF_HOME_RUN
  return HOME_RUN_POINTS_BY_RUNS[Math.min(runsBattedIn, HOME_RUN_POINTS_BY_RUNS.length) - 1] ?? 0
}

/**
 * 사용자 타석 하나의 인기도 점수 (0xa59c0, R7 1a 확정).
 *
 * ```
 * 홈런 > 0:
 *    끝내기 → +5
 *    아니면 득점 1 → +3 · 2 → +4 · 3 → +5 · 4 → +6      ; 표 칸은 루타가 아니라 득점 수다
 * 홈런 아님:
 *    끝내기 && 득점 > 0 → +4, 끝
 *    득점 1 → +1 · 득점 2~3 → +2                        ; 안타가 아니어도 (밀어내기·희생플라이·땅볼 타점)
 *    안타면 루타 1 → +1 · 2 → +2 · 3 → +3               ; 위 득점 점수에 **더한다**
 *    안타 아니면 아웃 > 1 → −1
 * ```
 * 앞서 웹은 ① 홈런·안타를 한 표로 묶고 ② 칸을 루타로 보고 ③ 득점 가산을 통째로 빼먹었다.
 * 주석에 "뜻을 모르겠다" 고 적혀 있던 `r6` 은 실은 **루타 점수**였다.
 */
export function atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay, isWalkOff }: AtBatContext): number {
  if (outcome.kind === '홈런') return homeRunPoints(runsBattedIn, isWalkOff)
  if (isWalkOff && runsBattedIn > 0) return WALK_OFF_HIT
  // 득점 점수 — 안타가 아니어도 붙는다
  const points = RUN_POINTS_BY_RUNS[runsBattedIn] ?? 0
  if (outcome.kind === '안타') return points + outcome.bases
  return outsInPlay >= DOUBLE_PLAY_OUTS ? points - 1 : points
}
