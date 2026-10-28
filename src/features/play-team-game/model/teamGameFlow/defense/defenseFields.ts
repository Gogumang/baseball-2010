import { defenseTeamBonusFor } from '@/features/play-team-game/model/teamGameRoster'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import {
  defenseAbilitiesFor,
  fielderPlatesFor,
  fielderRecordsFor,
  fielderSkillIdsFor,
} from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/*
 * **수비 쪽 칸 묶음** — 판 입력(타구 · 공 도착 · 견제)이 똑같이 싣는 "누가 수비하나" 칸들. 사람이 잡는 쪽에 따라 두 갈래뿐이다.
 * 공격이 CPU 면 0xae690 의 첫 항이 서서 설정과 무관하게 늘 자동 진루, 수비가 CPU 면 0xae6c8 의 첫 항이 서서 송구가 자동이다.
 */

/**
 * 우리 공격 — 수비는 상대(CPU)라 협살(AI 상태 8)이 돌고 받은 야수의 0xafa60 이 매 틱 돈다(0xae6c8 첫 항, d80918a).
 * 우리가 공격이라 여기서만 환경설정 "주루" 가 먹는다 — 혼자 자동 진루 제어기를 켠다 (0xae690 의 둘째 항)
 */
export function cpuDefenseFieldsOf(progress: TeamGameProgress) {
  const { options } = progress
  return {
    defenseAbilities: defenseAbilitiesFor(progress, options.opponentTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(options), options.opponentTeamId),
    fielderPlates: fielderPlatesFor(progress, options.opponentTeamId, progress.opponentPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, options.opponentTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: options.opponentTeamId,
    fielderRecords: fielderRecordsFor(progress, options.opponentTeamId),
    offenseTeamIndex: options.ourTeamId,
    defenseIsCpu: true,
    offenseIsCpu: false,
    runningMode: options.runningModeManual === true ? ('수동' as const) : ('자동' as const),
  }
}

/**
 * 우리 수비 — 수비가 **사람**이라 협살은 원본에서도 안 일어난다 (S8 1-4). 공격이 CPU 라 0xae690 의 첫 항이 서서 늘 자동 진루다.
 * 반대로 **송구는 여기서만 환경설정이 먹는다** — 0xae6c8 의 첫 항(`경기[0x31 + 수비측] == 1`)이 거짓이라 환경설정 "송구"(+0xf4)
 * 혼자가 받은 야수의 0xafa60 을 켠다. 안 넘기면 원본 기본값인 수동이다
 */
export function humanDefenseFieldsOf(progress: TeamGameProgress) {
  const { options } = progress
  return {
    defenseAbilities: defenseAbilitiesFor(progress, options.ourTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(options), options.ourTeamId),
    fielderPlates: fielderPlatesFor(progress, options.ourTeamId, progress.ourPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, options.ourTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: options.ourTeamId,
    fielderRecords: fielderRecordsFor(progress, options.ourTeamId),
    offenseTeamIndex: options.opponentTeamId,
    defenseIsCpu: false,
    offenseIsCpu: true,
    throwMode: options.throwModeManual === false ? ('자동' as const) : ('수동' as const),
  }
}
