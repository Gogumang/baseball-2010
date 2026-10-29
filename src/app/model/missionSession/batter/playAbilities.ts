import type { MissionRun } from '@/entities/mission/model/missionRun'
import { missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { missionPlayAbilitiesOf, type MissionPlayAbilities } from '@/entities/mission/model/missionRunners'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionPitcherPlateMirrorAtom, specialRunnersMirrorAtom } from '@/app/model/missionSession/atoms/mirrorAtoms'

/**
 * 수비 판에 먹이는 수비 아홉 칸 · 루별 주루 — 미션 타구 · 공 도착 · 견제 판이 같은 값을 쓴다 (`missionPlayAbilitiesOf`).
 * 그림 전용 이름 판(0x43cb0) · 마선수 주자(0x79d10)도 함께 싣는다 (`missionFielderPlatesOf` · `missionRunnerAcesOf`)
 */
export function playAbilitiesOf(atoms: MissionAtoms, run: MissionRun): MissionPlayAbilities {
  const missionPitcher = atoms.get(missionPitcherPlateMirrorAtom).current
  // 야수 · 주자 팔레트 — 경기[0x28 + 칸] 두 팀 중 수비측(타자 미션 CPU · 투수 미션 사람 칸) (C-1)
  const teamIds = missionTeamIdsOf(run)
  const humanDefends = run.mission.side === '투수'
  return {
    ...missionPlayAbilitiesOf(run, atoms.get(specialRunnersMirrorAtom).current(run.mission), {
      ...run,
      ...(missionPitcher === undefined ? {} : { missionPitcher }),
    }),
    defenseTeamIndex: humanDefends ? teamIds.human : teamIds.cpu,
    offenseTeamIndex: humanDefends ? teamIds.cpu : teamIds.human,
  }
}

/** 공 도착 판에 얹는 그림 전용 두 칸 (능력치 칸은 부르는 쪽이 따로 넣는다) */
export function pitchArrivalPlatesOf({ fielderPlates, fielderSkillIds, runnerAces, defenseTeamIndex, offenseTeamIndex }: MissionPlayAbilities) {
  return {
    ...(fielderPlates === undefined ? {} : { fielderPlates }),
    // 초감각(21) — 레이저 0x66a8c 가 야수 +0xec 레코드에 묻는다(그림 전용 칸은 아니지만 같은 레코드 고르기다)
    ...(fielderSkillIds === undefined ? {} : { fielderSkillIds }),
    ...(runnerAces === undefined ? {} : { runnerAces }),
    ...(defenseTeamIndex === undefined ? {} : { defenseTeamIndex }),
    ...(offenseTeamIndex === undefined ? {} : { offenseTeamIndex }),
  }
}

/** 견제 판 꼴 — 견제는 타자주자가 없어 루 1~3 만 */
export function pickoffAbilitiesOf(atoms: MissionAtoms, run: MissionRun) {
  const { runAbilities, ...rest } = playAbilitiesOf(atoms, run)
  const { 0: _batter, ...onBase } = runAbilities
  return { ...rest, runAbilities: onBase }
}
