import type { NariRecordFielder } from '@/entities/career/model/nariTeamRecord'
import { ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { OUR_ACE_PITCHER_SLOT, type PitcherGameOptions, type PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { WalkTeamAces } from '@/widgets/field-walk/lib/walkerAces'

/** 투수편 두 팀의 레코드 타자 배열 차례 (`nariRecordFieldersOf` — 부르는 쪽이 커리어 레코드 · 대회 칸에서 읽는다) */
export interface PitcherFieldLineups {
  readonly ours: readonly NariRecordFielder[]
  readonly opponent: readonly NariRecordFielder[]
}

/**
 * 투수편(모드 3) 한 팀의 운동장 마선수 재료 — 지금 투수(0xae83c): 내 팀은 내가 마운드면 나(마선수 아님), 아니면 교체 칸이
 * 마투수 칸(142 가 레코드 8번에 넣은 것)일 때 그 번호. 상대는 마운드가 마투수 칸이면 그 번호.
 */
export function pitcherFieldAcesOf(
  progress: Pick<PitcherGameProgress, 'onMound' | 'ourMound' | 'opponentMound'>,
  options: Pick<PitcherGameOptions, 'aces'>,
  lineups: PitcherFieldLineups | undefined,
  isOurs: boolean,
): WalkTeamAces | null {
  if (lineups === undefined) return null
  if (isOurs) {
    const onAceSlot = !progress.onMound && progress.ourMound.pitcherSlot === OUR_ACE_PITCHER_SLOT
    return fieldAcesOf(options.aces?.ours.pitcher ?? -1, onAceSlot, lineups.ours)
  }
  const onAceSlot = progress.opponentMound.pitcherSlot === ACE_PITCHER_SLOT
  return fieldAcesOf(options.aces?.opponent.pitcher ?? -1, onAceSlot, lineups.opponent)
}

/** 마운드가 마투수 칸이고 마투수가 실렸으면 그 번호 */
function fieldAcesOf(acePitcher: number, onAceSlot: boolean, records: readonly NariRecordFielder[]): WalkTeamAces {
  return { pitcherAce: onAceSlot && acePitcher >= 0 ? acePitcher : null, records }
}
