import { BATTER_SLOT, PITCHER_SLOT } from '@/features/play-team-game/model/gameAbilities/slots'

/**
 * 코치 보너스 표 `0xd884c` s8 (0xb5a74~0xb5b04, **모드 2 만**).
 * 코치 = s8 [시즌+0x185] (−1 = 없음, 0..9). **정액** 가산이다.
 */
export const COACH_BONUS: readonly number[] = [8, 9, 10, 6, 4, 8, 5, 10, 6, 7]

/** 코치가 없음을 뜻하는 값 (s8 −1) */
export const NO_COACH = -1

type CoachTarget = (isPitcher: boolean, slot: number) => boolean

/** 점프표 0xd8858 — 코치 0~4 는 투수 칸, 5~9 는 타자 칸에만 붙는다 */
const COACH_TARGETS: readonly CoachTarget[] = [
  // 0 투수 변화
  (isPitcher, slot) => isPitcher && slot === PITCHER_SLOT.변화,
  // 1 투수 구속
  (isPitcher, slot) => isPitcher && slot === PITCHER_SLOT.구속,
  // 2 투수 제구
  (isPitcher, slot) => isPitcher && slot === PITCHER_SLOT.제구,
  // 3 투수 제구·변화
  (isPitcher, slot) => isPitcher && (slot === PITCHER_SLOT.제구 || slot === PITCHER_SLOT.변화),
  // 4 투수 전부(체력 포함)
  (isPitcher) => isPitcher,
  // 5 타자 히트
  (isPitcher, slot) => !isPitcher && slot === BATTER_SLOT.히트,
  // 6 타자 수비·주루
  (isPitcher, slot) => !isPitcher && (slot === BATTER_SLOT.수비 || slot === BATTER_SLOT.주루),
  // 7 타자 파워
  (isPitcher, slot) => !isPitcher && slot === BATTER_SLOT.파워,
  // 8 타자 히트·주루
  (isPitcher, slot) => !isPitcher && (slot === BATTER_SLOT.히트 || slot === BATTER_SLOT.주루),
  // 9 타자 히트·파워
  (isPitcher, slot) => !isPitcher && slot <= BATTER_SLOT.파워,
]

export function coachBonusOf(coach: number, isPitcher: boolean, slot: number): number {
  const affects = COACH_TARGETS[coach]
  if (affects === undefined || !affects(isPitcher, slot)) return 0
  return COACH_BONUS[coach] ?? 0
}
