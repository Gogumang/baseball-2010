import { type TeamEntryBatter, NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'

/** 리그 선수 기록표의 줄 열쇠 — 도루 · 실책 · 타석이 같은 열쇠로 선수를 찾는다 */
export interface LeagueRecordKey {
  readonly teamId: number
  readonly battingOrderIndex: number
  readonly recordId?: number
}

/**
 * 명단 칸 선수의 **리그 기록표 열쇠** — 원본 `0xa8024` 는 명단 칸(`team+0xe`)이 가리키는 선수 레코드에 쌓는다.
 * - 표 칸 선수: 그 로스터 칸. 트레이드로 옮겨 온 선수는 옛 팀 표 자리(`tableTeamId`) — 레코드 +0x20~ 가 선수를 따라간다.
 * - 표 밖 선수(기록을 실어 선 영입 명전 · 나리, 로스터 칸 `NO_ROSTER_SLOT`): 원본 id 로 넘긴다. id 가 없으면 열쇠도 없다(null).
 * 마선수 거르기는 부르는 쪽 몫이다 — 자리마다 거르는 차례가 다르다(원본 그대로).
 */
export function leagueRecordKeyOf(player: TeamEntryBatter | undefined, teamId: number, slot: number): LeagueRecordKey | null {
  const rosterSlot = player?.rosterSlot ?? slot
  if (rosterSlot !== NO_ROSTER_SLOT) return { teamId: player?.tableTeamId ?? teamId, battingOrderIndex: rosterSlot }
  const recordId = player?.recordId
  if (recordId === undefined) return null
  return { teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId }
}
