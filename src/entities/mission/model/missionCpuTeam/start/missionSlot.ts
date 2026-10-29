import type { OriginalMission } from '@/shared/config/original/missions'

/** 사람 칸 아닌 쪽 팀 번호 — 레코드 +2 아래 4비트 */
export function cpuTeamIdOf(mission: OriginalMission): number {
  return mission.sideTeams[mission.humanSide === 0 ? 1 : 0]
}

/** 미션 객체 +0xbd — 고른 레코드 번호 (`id − 1`, 위 머리글) */
export function missionSlotOf(mission: OriginalMission): number {
  return mission.id - 1
}

/** `0x66864` 의 모드 6 갈래 — +0xbd 가 3 · 7 이면 CPU 투수 교체를 막는다 */
export const PITCHER_CHANGE_BLOCKED_SLOTS: readonly number[] = [3, 7]

/** `0x66864` 의 모드 6 갈래 — 사람 타석 0x3d954 와 간이 엔진 0xc1ba4(c1c78) 둘 다 이것으로 투수 교체를 막는다 */
export function isMissionPitcherChangeBlocked(mission: OriginalMission): boolean {
  return mission.side === '타자' && PITCHER_CHANGE_BLOCKED_SLOTS.includes(missionSlotOf(mission))
}
