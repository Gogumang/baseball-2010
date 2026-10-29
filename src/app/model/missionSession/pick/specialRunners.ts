import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionSpecialRunners } from '@/entities/mission/model/missionRunners'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type MissionPlayScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { missionPitcherPlateMirrorAtom, specialRunnersMirrorAtom } from '@/app/model/missionSession/atoms/mirrorAtoms'
import { missionOpponentAbility } from '@/app/model/missionSession/opponent/missionOpponent'

/**
 * 루에 선 미션 타자 · 마타자의 경기용 주력 (`missionRunners`) — 미션 타자는 고른 선수의 주력, 마타자는 투수 미션 상대의
 * 레벨 배율 먹은 주력. 모르는 칸은 넣지 않는다(진행기 기본값)
 */
export function specialRunnersOf(
  mission: OriginalMission,
  aceLevels: Readonly<Record<number, number>> | undefined,
  missionBatterRunAbility: number | undefined,
): MissionSpecialRunners {
  const aceBatterRun = mission.side === '투수' ? missionOpponentAbility(mission, aceLevels)?.run : undefined
  return {
    ...(missionBatterRunAbility === undefined ? {} : { missionBatterRun: missionBatterRunAbility }),
    ...(aceBatterRun === undefined ? {} : { aceBatterRun }),
  }
}

/** 판을 먹이는 콜백들이 늘 지금 값을 보게 이 그림의 주자 주력 · 미션 투수 이름 판을 상자에 적는다 */
export function usePickMirrors(scope: MissionPlayScope): void {
  const { atoms, aceLevels, pick } = scope
  const missionBatterRunAbility = pick.missionBatterRunAbility
  useMirrorRef(useMissionValue(atoms, specialRunnersMirrorAtom), (mission: OriginalMission) =>
    specialRunnersOf(mission, aceLevels, missionBatterRunAbility),
  )
  useMirrorRef(useMissionValue(atoms, missionPitcherPlateMirrorAtom), pick.pitcher.plate)
}
