import { aceBatterProfileOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { batterProfileOf } from '@/pages/team-game/lib/teamMatchupCards'

/** 타자 레코드 +0xb — 마타자는 마선수 표 (교체 줄의 세로 줄 색 · 상세 창이 같이 본다) */
export function entryProfileOf(progress: TeamGameProgress, entry: TeamEntryBatter): number {
  if (entry.aceIndex >= 0) return aceBatterProfileOf(entry.aceIndex)
  return batterProfileOf(progress.options.ourTeamId, entry) ?? 0
}
