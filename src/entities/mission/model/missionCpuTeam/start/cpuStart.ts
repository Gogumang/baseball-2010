import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import type { OriginalMission } from '@/shared/config/original/missions'

/**
 * 레코드 +6 · +7 의 **아래 4비트**(다른 칸 = CPU 팀) — 시작 투수 칸(0xb8c94)과 타순(team+0x32).
 * 생성기(`shared/config/original/missions`)가 싣지 않는 칸이라 원본 표(`base/extracted/Xls*_MISSION.json` 줄 바이트 6 · 7)에서
 * 옮겨 적었다. 윗 4비트는 사람 칸 몫이다(타순 · 레코드 +1 비트 0 일 때만 쓰는 투수 칸 — 원본 표는 모두 비트 0 이 꺼져 있다).
 * 열쇠는 `missionKeyOf`.
 */
export const MISSION_CPU_START: Readonly<Record<string, { readonly pitcherSlot: number; readonly battingOrder: number }>> = {
  '타자:1': { pitcherSlot: 3, battingOrder: 0 },
  '타자:2': { pitcherSlot: 3, battingOrder: 0 },
  '타자:3': { pitcherSlot: 3, battingOrder: 2 },
  '타자:4': { pitcherSlot: 2, battingOrder: 1 },
  '타자:5': { pitcherSlot: 1, battingOrder: 0 },
  '타자:6': { pitcherSlot: 7, battingOrder: 2 },
  '타자:7': { pitcherSlot: 1, battingOrder: 0 },
  '타자:8': { pitcherSlot: 2, battingOrder: 1 },
  '타자:9': { pitcherSlot: 3, battingOrder: 1 },
  '타자:10': { pitcherSlot: 4, battingOrder: 1 },
  '타자:11': { pitcherSlot: 0, battingOrder: 0 },
  '타자:12': { pitcherSlot: 0, battingOrder: 3 },
  '타자:13': { pitcherSlot: 0, battingOrder: 0 },
  '타자:14': { pitcherSlot: 0, battingOrder: 0 },
  '타자:16': { pitcherSlot: 0, battingOrder: 3 },
  '타자:17': { pitcherSlot: 0, battingOrder: 3 },
  '타자:18': { pitcherSlot: 0, battingOrder: 3 },
  '타자:19': { pitcherSlot: 0, battingOrder: 3 },
  '타자:20': { pitcherSlot: 0, battingOrder: 3 },
  '투수:1': { pitcherSlot: 6, battingOrder: 6 },
  '투수:2': { pitcherSlot: 4, battingOrder: 8 },
  '투수:3': { pitcherSlot: 2, battingOrder: 4 },
  '투수:4': { pitcherSlot: 3, battingOrder: 0 },
  '투수:5': { pitcherSlot: 2, battingOrder: 0 },
  '투수:6': { pitcherSlot: 2, battingOrder: 0 },
  '투수:7': { pitcherSlot: 0, battingOrder: 2 },
  '투수:8': { pitcherSlot: 0, battingOrder: 0 },
  '투수:9': { pitcherSlot: 0, battingOrder: 0 },
  '투수:10': { pitcherSlot: 0, battingOrder: 2 },
  '투수:11': { pitcherSlot: 0, battingOrder: 1 },
  '투수:12': { pitcherSlot: 0, battingOrder: 0 },
  '투수:13': { pitcherSlot: 0, battingOrder: 2 },
  '투수:14': { pitcherSlot: 0, battingOrder: 2 },
  '투수:16': { pitcherSlot: 0, battingOrder: 3 },
  '투수:17': { pitcherSlot: 0, battingOrder: 3 },
  '투수:18': { pitcherSlot: 0, battingOrder: 3 },
  '투수:19': { pitcherSlot: 0, battingOrder: 3 },
  '투수:20': { pitcherSlot: 0, battingOrder: 3 },
}

/** 그 미션의 CPU 시작 칸 — 표에 없으면 투수 0 · 타순 0 */
export function cpuStartOf(mission: OriginalMission): { readonly pitcherSlot: number; readonly battingOrder: number } {
  return MISSION_CPU_START[missionKeyOf(mission)] ?? { pitcherSlot: 0, battingOrder: 0 }
}
