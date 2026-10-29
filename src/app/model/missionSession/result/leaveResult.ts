import { isBugFixed } from '@/shared/config/bugfixes'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionClearCounts } from '@/shared/api/save/missionRecordPort'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { missionRewardOf } from '@/entities/mission/model/missionReward'
import { NO_ACE_MATCH_HOLD, isAceMatchHeld } from '@/entities/mode-save/model/modeSave'
import { missionResultEarnedOf } from '@/pages/mission-play/lib/missionResultBoard'
import { BATTER_EDITION_MODE, PITCHER_EDITION_MODE } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionScope } from '@/app/model/missionSession/atoms/missionScope'

/** g[0xf6] 이 돌아갈 나리 편(3 투수편 · 4 타자편)인가 */
const isNariEditionMode = (mode: number): mode is 3 | 4 => mode === PITCHER_EDITION_MODE || mode === BATTER_EDITION_MODE

/**
 * 보통 미션 결과 판을 떠난다 — 정산(G · 횟수 · 결과 바이트)은 판이 설 때 이미 했다(`useSettlement`). 대기(g[0x11f] ·
 * g[0x176])가 없으면 미션 목록, 서 있으면 결과 판 키 0x407f0 4090c 대로 g[0xf6] ∈ {3, 4} 의 나리 장면(`onReturnToNari`).
 * **g[0xf6] 이 3 · 4 가 아니면(한 편 140 이 다른 편 대기를 남긴 채 g[0xf6] 을 0 으로 지웠을 때) 그 키가 아무 일도 안 해 판에
 * 갇힌다 — 원본 버그(B-75)** 판을 안 닫고 거짓을 돌려준다. **고침(`bugfixes.json` B-75, 기본 켬)**: 그때는 미션 목록으로 간다.
 * ⚠️ 원본에서 갇히는 것은 CLR(과 두 칸이 다 선 OK — 0x4090e) 뿐이다. 칸이 하나만 선 OK 는 '다시'(0x140006c = 3)로 전환을 걸고
 * 0x4b100 4b344 가 전역 모드 = g[0xf6](0) 으로 장면 0x106 을 세운다 — 모드 0 의 0x106 은 안 읽어 웹은 그 키도 판에 둔다
 * (`missionResultLeaveOf` 머리말, r264).
 */
export function leaveMissionResult({
  aceMatchHold,
  setScreen,
  onReturnToNari,
}: Pick<MissionScope, 'aceMatchHold' | 'setScreen' | 'onReturnToNari'>): boolean {
  const held = aceMatchHold?.read() ?? NO_ACE_MATCH_HOLD
  if (!isAceMatchHeld(held)) {
    setScreen({ kind: '미션선택' })
    return true
  }
  if (!isNariEditionMode(held.originalMode)) {
    // 고침(bugfixes.json B-75, 기본 켬): 돌아갈 나리 편이 없으면 판에 갇히지 않고 미션 목록으로 — 대기 칸은 그대로 두어
    // 그 편 나리가 결과를 읽는다. 굴림 없음
    if (!isBugFixed('B-75')) return false
    setScreen({ kind: '미션선택' })
    return true
  }
  onReturnToNari?.(held.originalMode)
  return true
}

/**
 * 결과 판 0x4a384 의 번 G [+0x17f4] — 진입 0x4ea0c(0x4ef18~0x4efba): 성공이고 g[0x11f] · g[0x176](마선수 대결)이
 * 안 섰으면 [미션+0xa0] = 0xa5368 이 적은 보상 0xa52b0(이번 클리어를 더하기 전 횟수로), 실패면 0.
 * 이 진입이 g[0x64] 에 더하므로(웹은 판이 설 때의 정산 고리) 판의 보유 G 는 이미 더한 값이다. 정산을 지났으면 그때 적은 값을
 * 돌려준다(그 뒤 횟수가 올라 다시 재면 다음 보상이 나온다).
 */
export function resultEarnedGamePointOf(settledEarned: number | null, clearCounts: MissionClearCounts) {
  return (mission: OriginalMission, status: string, isAceMatch: boolean): number =>
    settledEarned ?? missionResultEarnedOf(status === '성공', isAceMatch, missionRewardOf(mission.stage, clearCounts[missionKeyOf(mission)] ?? 0))
}
