import type { LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { type QuickLineup, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 한쪽 타선 — 우리 · 상대 명단과 팀 번호 */
function battingTeamOf(progress: PitcherGameProgress, ours: boolean): { readonly lineup: QuickLineup; readonly teamId: number } {
  if (ours) return { lineup: progress.ourLineup, teamId: progress.options.ourTeamId }
  return { lineup: progress.opponentLineup, teamId: progress.options.opponentTeamId }
}

/**
 * 도루한 주자(타순 칸)들을 리그 기록 재료로 얹는다 — 0xa56dc 모드 3 갈래는 마선수(0xb633d)만 거른다(마타자 칸 빼기).
 * 주자의 선수는 그 타순 칸에 지금 선 명단 선수다.
 */
export function withLeagueSteals(progress: PitcherGameProgress, ours: boolean, runners: readonly number[]): PitcherGameProgress {
  const { lineup, teamId } = battingTeamOf(progress, ours)
  const steals: LeagueStolenBase[] = []
  for (const runner of runners) {
    const rosterSlot = rosterSlotAt(lineup, runner)
    if (rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
    steals.push({ teamId, battingOrderIndex: rosterSlot })
  }
  return steals.length === 0 ? progress : { ...progress, leagueStolenBases: [...(progress.leagueStolenBases ?? []), ...steals] }
}

/**
 * 타석 하나를 리그 타석 줄 재료로 얹는다 — 0xa8024 의 sp+0x34 게이트(0xa56dc 모드 3 갈래)는 마선수만 거른다(마타자 칸 빼기).
 * 타자는 그 타순 칸에 지금 선 명단 선수, 타점은 이 플레이의 득점이다. 펼쳐 넣을 칸만 돌려준다
 */
export function withLeaguePlateAppearance(
  progress: PitcherGameProgress,
  ours: boolean,
  orderSlot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): Pick<PitcherGameProgress, 'leaguePlateAppearances'> {
  const { lineup, teamId } = battingTeamOf(progress, ours)
  const rosterSlot = rosterSlotAt(lineup, orderSlot)
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) return { leaguePlateAppearances: progress.leaguePlateAppearances }
  return {
    leaguePlateAppearances: [...(progress.leaguePlateAppearances ?? []), { teamId, battingOrderIndex: rosterSlot, outcome, runsBattedIn }],
  }
}
