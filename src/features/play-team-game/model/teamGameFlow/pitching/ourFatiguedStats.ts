import { type PitcherStats, fatiguedStatsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { entryPitcherGameAbilityParts } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherGameStatsOf } from '@/entities/pitching/model/pitcherGameStats'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherAbilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 우리(사람) 투수의 **체력%로 부른** 제구 · 구속 · 변화 — 등급 0x4dbac · 피로 능력치 0x34968 은 CPU 투수와 같은 `0xb570c(…, 체력%)` 라
 * 시즌 내 팀 보정 → **피로 0xb58e6** → 팀 능력치 정액 → 스킬 14 투지 → 코치 차례다(`pitcherGameStatsOf`). 예전에는 정액까지 먹인
 * 값(`ourPitcherStats`)에 피로를 먹였다 — 체력 54% 아래에서 팀 정액이 있으면 값이 달랐다(A-23 에서 원본 차례로). 명단 칸이 없으면 옛 길
 */
export function ourFatiguedStatsOf(progress: TeamGameProgress, stats: PitcherStats, stamina: number): PitcherStats {
  const entry = pitcherEntryAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  if (entry === undefined) return fatiguedStatsOf(stats, stamina)
  const parts = entryPitcherGameAbilityParts(pitcherAbilityContextOf(progress), progress.options.ourTeamId, entry)
  return { ...pitcherGameStatsOf(parts, staminaPercentOf(stamina)), stamina: stats.stamina }
}
