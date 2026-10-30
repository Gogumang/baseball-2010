import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import type { OriginalMission } from '@/shared/config/original/missions'
import { isUnlocked, missionUnlockIdOf } from '@/shared/config/unlocks'

/**
 * 잠긴 칸인가 — 원작: "오픈 되지 않은 미션입니다. 이전 단계를 클리어해주세요" (`0xa520d(미션, 칸)` 이 0).
 * 해금 표(`unlocks.json`)가 풀면 열린 칸이다 — 클리어 기록은 그대로다
 */
export function isMissionLockedAt(
  missions: readonly OriginalMission[],
  index: number,
  clearedKeys: readonly string[],
  side: OriginalMission['side'],
): boolean {
  const previous = missions[index - 1]
  const original = () => previous === undefined || clearedKeys.includes(missionKeyOf(previous))
  const unlockId = missionUnlockIdOf(side, index)
  return !(unlockId === null ? original() : isUnlocked(unlockId, original))
}
