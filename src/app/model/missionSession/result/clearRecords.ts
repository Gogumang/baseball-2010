import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionClearCounts } from '@/shared/api/save/missionRecordPort'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { missionRewardOf } from '@/entities/mission/model/missionReward'
import { aceMatchClearCountAfterWin, aceMatchClearKeyOf } from '@/entities/mission/model/aceMatchClear'
import { NO_ACE_MATCH_HOLD, isAceMatchHeld } from '@/entities/mode-save/model/modeSave'
import { MAXIMUM_CLEARS } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionScope } from '@/app/model/missionSession/atoms/missionScope'
import { clearCountsAtom } from '@/app/model/missionSession/atoms/recordAtoms'

type Hands = Pick<MissionScope, 'atoms' | 'missionRecord' | 'aceMatchHold' | 'onGamePointReward'>

/** 새 클리어 횟수를 칸과 저장소에 적는다 */
function storeClearCounts({ atoms, missionRecord }: Hands, next: MissionClearCounts): void {
  atoms.set(clearCountsAtom, next)
  missionRecord.save(next)
}

/**
 * 미션을 깼을 때 — **클리어 횟수를 올리고 보상 G 를 준다** (0xa52b0, Q2 1a·1b).
 * 보상은 이번 클리어를 더하기 **전** 횟수로 계산하므로 다시 깰수록 줄어든다.
 * 원본은 99 회에서 센 것을 멈춘다.
 */
export function rememberCleared(
  hands: Hands,
  mission: OriginalMission,
  status: string,
): { readonly earned: number; readonly counts: MissionClearCounts } {
  const clearCounts = hands.atoms.get(clearCountsAtom)
  if (status !== '성공') return { earned: 0, counts: clearCounts }
  const key = missionKeyOf(mission)
  const previous = clearCounts[key] ?? 0
  const reward = missionRewardOf(mission.stage, previous)
  // 정산 0x4ea0c 4ef3e — g[0x11f] · g[0x176] 중 하나라도 서 있으면 G 를 건너뛴다(횟수는 0xa5368 이 플래그 없이 올린다)
  const earned = isAceMatchHeld(hands.aceMatchHold?.read() ?? NO_ACE_MATCH_HOLD) ? 0 : reward
  if (earned > 0) hands.onGamePointReward?.(earned)
  const next = { ...clearCounts, [key]: Math.min(MAXIMUM_CLEARS, previous + 1) }
  storeClearCounts(hands, next)
  return { earned, counts: next }
}

/**
 * **마선수 대결을 이겼을 때** — 0xa5368(obj, 1) 이 g[0x11f]·g[0x176] 을 안 보고 `[obj+0xbd] = team − 1 ≤ 15` 면
 * 그 편의 클리어 칸을 올린다(−1 에서 시작, 99 상한). 보상 G 는 0x4ef3e 가 건너뛴다 (`entities/mission/model/aceMatchClear`).
 */
export function rememberAceMatchCleared(hands: Hands, mission: OriginalMission): MissionClearCounts {
  const clearCounts = hands.atoms.get(clearCountsAtom)
  const key = aceMatchClearKeyOf(mission)
  if (key === null) return clearCounts
  const next = { ...clearCounts, [key]: aceMatchClearCountAfterWin(clearCounts[key]) }
  storeClearCounts(hands, next)
  return next
}
