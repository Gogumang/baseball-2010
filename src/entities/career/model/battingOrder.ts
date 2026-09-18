import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 나만의리그 타순 (누락 탐색 에이전트, binary.mod 0xa4c2c).
 *   9번에서 시작. 경로 표 0xd7e80 — 4번 경로 [9,8,7,6,5,3,4] · 1번 경로 [9,8,7,6,2,3,1]
 *   경로는 이벤트 487 의 선택(488 → 1번, 489 → 4번, 보상 18)으로 정해진다. 고르기 전 기본값은 4번 경로(+0x57 = 0)
 *   승격: 평판 ≥ 200/320/450/600/750/900 → 470~478 · 강등: 평판 < 150/260/385/525/675/825 → 479~486
 *   이벤트 보상 19 가 새 타순이다
 */
export type BattingOrderPath = '4번' | '1번'

export const START_BATTING_ORDER = 9

const PATHS: Readonly<Record<BattingOrderPath, readonly number[]>> = {
  '4번': [9, 8, 7, 6, 5, 3, 4],
  '1번': [9, 8, 7, 6, 2, 3, 1],
}
const PROMOTE_REPUTATION = [200, 320, 450, 600, 750, 900]
const DEMOTE_REPUTATION = [150, 260, 385, 525, 675, 825]

/** [경로][도착 칸 − 1] */
const PROMOTE_EVENTS: Readonly<Record<BattingOrderPath, readonly number[]>> = {
  '4번': [470, 471, 472, 476, 477, 478],
  '1번': [470, 471, 472, 473, 474, 475],
}
/** [경로][출발 칸 − 1] */
const DEMOTE_EVENTS: Readonly<Record<BattingOrderPath, readonly number[]>> = {
  '4번': [479, 480, 481, 482, 485, 486],
  '1번': [479, 480, 481, 482, 483, 484],
}

function stepOf(career: PlayerCareer): { path: BattingOrderPath | null; step: number } {
  const path = career.battingOrderPath
  const lookup = PATHS[path ?? '4번']
  const step = lookup.indexOf(career.battingOrder)
  return { path, step: step < 0 ? 0 : step }
}

/** 지금 평판으로 볼 타순 이벤트. 없으면 null */
export function battingOrderEventId(career: PlayerCareer): number | null {
  const { path, step } = stepOf(career)
  const promoteTo = step + 1
  if (promoteTo < PATHS['4번'].length && career.reputation >= PROMOTE_REPUTATION[step]) {
    return PROMOTE_EVENTS[path ?? '4번'][step]
  }
  if (step > 0 && career.reputation < DEMOTE_REPUTATION[step - 1]) {
    return DEMOTE_EVENTS[path ?? '4번'][step - 1]
  }
  return null
}

/** 보상 18 — 0 은 4번 경로, 1 은 1번 경로 */
export function battingOrderPathOf(value: number): BattingOrderPath {
  return value === 1 ? '1번' : '4번'
}

/** 이벤트 없는 장소에 들어가면 보는 "특별한 일이 없다" (0x16ccc) */
const EMPTY_PLACE_EVENT_BASE = 440

export function emptyPlaceEventId(placeFrame: number): number {
  return EMPTY_PLACE_EVENT_BASE + placeFrame - 1
}
