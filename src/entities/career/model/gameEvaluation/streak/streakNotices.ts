import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 연속 기록 알림 — 라벨(USER_EVT[100~102]) · 코멘트(108, 110~112) · 평판 변화 */
export interface StreakNotice {
  readonly labelIndex: number
  /** 연속 경기 수 — 화면에 "3경기 연속" 처럼 앞에 붙인다 */
  readonly count: number
  readonly commentIndex: number
  readonly reputationChange: number
}

/**
 * 0x8a6fc 모드 4 갈래는 [0](2안타 이상)·[1](홈런) **둘 다** 표 0xd4dfc(스택 +0x58) = [5,10,20,30,40] 와 견준다(8a8ec · 8a9b2).
 * [3,5,10,15,20](0xd4e10, 스택 +0x44)은 투수편 표다 — 예전 웹은 2안타 칸을 그 표로 보고 있었다.
 */
const MULTI_HIT_STREAKS = [5, 10, 20, 30, 40]
const HOME_RUN_STREAKS = [5, 10, 20, 30, 40]
const HITLESS_STREAKS = [3, 4, 5]
const STREAK_REWARDS = [10, 15, 20, 25, 30]
const HITLESS_PENALTIES = [-5, -10, -20]
const GOOD_STREAK_COMMENT = 108
const HITLESS_COMMENT_BASE = 110
const MULTI_HIT_LABEL = 100
const HOME_RUN_LABEL = 101
const HITLESS_LABEL = 102

/** 좋은 연속 기록 — 기준값과 정확히 같을 때만 알림(평판 +10~+30) */
function goodStreakNotice(value: number, table: readonly number[], labelIndex: number): StreakNotice | null {
  const index = table.indexOf(value)
  if (index < 0) return null
  return { labelIndex, count: value, commentIndex: GOOD_STREAK_COMMENT, reputationChange: STREAK_REWARDS[index] }
}

/** 무안타 연속 — 3 · 4 · 5 경기째 코멘트 110~112 · 평판 −5 · −10 · −20 */
function hitlessNotice(hitless: number): StreakNotice | null {
  const index = HITLESS_STREAKS.indexOf(hitless)
  if (index < 0) return null
  return { labelIndex: HITLESS_LABEL, count: hitless, commentIndex: HITLESS_COMMENT_BASE + index, reputationChange: HITLESS_PENALTIES[index] }
}

/** 0x8a6fc 모드 4 — 2안타 이상 · 홈런 · 무안타 차례의 알림 줄 */
export function streakNoticesOf(streaks: PlayerCareer['streaks']): StreakNotice[] {
  const notices = [
    goodStreakNotice(streaks.multiHit, MULTI_HIT_STREAKS, MULTI_HIT_LABEL),
    goodStreakNotice(streaks.homeRun, HOME_RUN_STREAKS, HOME_RUN_LABEL),
    hitlessNotice(streaks.hitless),
  ]
  return notices.filter((notice) => notice !== null)
}
