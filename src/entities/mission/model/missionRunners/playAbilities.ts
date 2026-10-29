import { missionFielderPlatesOf, missionRunnerAcesOf } from '@/entities/mission/model/missionRunners/plates/plates'
import { missionDefenseAbilitiesOf, missionFielderSkillIdsOf } from '@/entities/mission/model/missionRunners/defense/defenseAbilities'
import { missionRunAbilitiesOnBaseOf } from '@/entities/mission/model/missionRunners/runners/runAbilities'
import type {
  MissionDefenseSituation,
  MissionPlateSituation,
  MissionPlayAbilities,
  MissionRunnerSituation,
  MissionSpecialRunners,
} from '@/entities/mission/model/missionRunners/types'

/**
 * 수비 판(타구 · 견제 · 공 도착 · 밀어내기)이 읽는 능력치 한 벌 — `missionDefenseAbilitiesOf` + `missionRunAbilitiesOnBaseOf`.
 * `plates` 를 주면 그림 전용 이름 판(`missionFielderPlatesOf`) · 마선수 주자(`missionRunnerAcesOf`)도 싣는다 — 난수와 무관하다.
 */
export function missionPlayAbilitiesOf(
  run: MissionRunnerSituation & MissionDefenseSituation,
  special: MissionSpecialRunners = {},
  plates?: MissionPlateSituation,
): MissionPlayAbilities {
  return {
    defenseAbilities: missionDefenseAbilitiesOf(run),
    fielderSkillIds: missionFielderSkillIdsOf(run),
    runAbilities: missionRunAbilitiesOnBaseOf(run, special),
    ...(plates === undefined ? {} : { fielderPlates: missionFielderPlatesOf(plates), runnerAces: missionRunnerAcesOf(plates) }),
  }
}
