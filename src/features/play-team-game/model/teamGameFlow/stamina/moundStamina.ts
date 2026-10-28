import { opponentTeamMoraleOf, ourTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { ourPitcherStats } from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
import { opponentPitcherStaminaAbility } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 지금 마운드 투수의 스태미나 재료 — 용량 X `0x66e44(사기, 투수, f)` 와 % `0xaebb0` 을 셈하는 칸들. 공마다 깎는 셈
 * (`drainStamina` · `quickPitcherDrainOf`)이 쓰는 값 그대로다 — 상태 0xe 의 소개 판 체력 막대(0x44ea0~)가 읽는다.
 * 사기는 두 쪽 다 던지는 팀의 팀 레코드 +2 다 (`ourTeamMoraleOf` · `opponentTeamMoraleOf`).
 */
export function moundStaminaOf(
  progress: TeamGameProgress,
  ours: boolean,
): {
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  return ours
    ? {
        staminaAbility: ourPitcherStats(progress).stamina,
        teamMorale: ourTeamMoraleOf(progress.options),
        isFirstPitcher: progress.ourUsedPitchers.length === 0,
        stamina: progress.stamina,
      }
    : {
        staminaAbility: opponentPitcherStaminaAbility(progress),
        teamMorale: opponentTeamMoraleOf(progress.options),
        isFirstPitcher: progress.opponentUsedPitchers.length === 0,
        stamina: progress.opponentStamina,
      }
}
