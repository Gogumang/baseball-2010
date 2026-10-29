import type { OriginalMission } from '@/shared/config/original/missions'
import { MISSIONS } from '@/shared/config/original/missions'

/**
 * 미션 목록 — StrHOWTO[27] "총 28개의 미션". 원본 레코드 38개 중 단계(stage) 0 인 "OO 공략" 10개는
 * 마선수 대결용 레코드라 목록에 올리지 않는다 (ACE_CHALLENGE_MISSIONS 로 따로 둔다).
 */
const isListedMission = (mission: OriginalMission) => mission.stage > 0

export const BATTER_MISSIONS: readonly OriginalMission[] = MISSIONS.filter((mission) => mission.side === '타자' && isListedMission(mission))

export const PITCHER_MISSIONS: readonly OriginalMission[] = MISSIONS.filter((mission) => mission.side === '투수' && isListedMission(mission))

export const ACE_CHALLENGE_MISSIONS: readonly OriginalMission[] = MISSIONS.filter((mission) => !isListedMission(mission))

/** 클리어 기록 키. 타자편·투수편의 미션 번호가 겹치므로 편을 함께 적는다. */
export function missionKeyOf(mission: OriginalMission): string {
  return `${mission.side}:${mission.id}`
}

/**
 * **편별 올클리어 `0xa5184(미션객체)`** (직접 떴다, 0xa5184~0xa51c6): 편 = (+0xbf == 6) ? 0(타자) : 1(투수),
 * 칸 i = 0..13 의 클리어 횟수 `(s8) 전역기록[+0x150 + 편×16 + i]` 가 모두 > 0 이면 참. 칸 i = 미션 번호 i + 1(목록 14개) —
 * 대결 칸(15~)은 안 본다. 웹 기록은 `편:번호` → 횟수, 없는 칸은 원본 −1(잠김)·0 이라 > 0 이 아니다.
 */
export function isMissionSideAllCleared(counts: Readonly<Record<string, number>>, side: OriginalMission['side']): boolean {
  const listed = side === '타자' ? BATTER_MISSIONS : PITCHER_MISSIONS
  return listed.every((mission) => (counts[missionKeyOf(mission)] ?? 0) > 0)
}

/**
 * 정산 0x4ea0c 모드 5 · 6 갈래 4ef84~4efae — 미션이 **성공**이면(실패 갈래 0x4efb0 은 건너뛴다) 대결 대기(G 건너뜀)와 상관없이
 * `0xa5184` 참일 때 `0x62368(ui, 모드 6 ? 0x25 : 0x15, 0)`. 타자 미션 37(프라임 헬멧) · 투수 미션 21(사신의 두건).
 */
export const MISSION_ALL_CLEAR_HIDDEN_ID: Readonly<Record<OriginalMission['side'], number>> = { 타자: 0x25, 투수: 0x15 }

/** 선택 목록의 미션(타자·투수 28개)을 모두 깼는가 — 수집 보상 k = 3 의 조건 (`judgeCollectionReward`) */
export function isEveryMissionCleared(clearedKeys: readonly string[]): boolean {
  return [...BATTER_MISSIONS, ...PITCHER_MISSIONS].every((mission) => clearedKeys.includes(missionKeyOf(mission)))
}
