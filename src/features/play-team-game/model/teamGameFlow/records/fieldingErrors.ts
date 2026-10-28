import { type DrawnFieldingError, fieldingErrorRecordsOf, fielderRecordIndexOf } from '@/features/defense-play/model/fieldingErrors'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { SEASON_RECORD_CODE } from '@/entities/season-mode/model/seasonReputation'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { entryBattersOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 수비 그림이 올린 실책(+0x2e, `features/defense-play/model/fieldingErrors`)을 리그 기록 재료에 얹는다 — 화면이 판 끝에 넘긴다.
 * 야수 +0xec 는 그림이 실은 레코드(판 입력 `fielderRecords` — `fielderRecordsFor`)다: 칸 1..8 은 그 판 수비 팀 명단에서 자리 니블이
 * 칸 + 1 인 첫 타자, 칸 0 은 마지막 교대 판의 수비 팀 지명타자(판 없이 지난 반 이닝이면 상대 팀 지명타자에게 붙는다 — 원본 그대로).
 * 열쇠는 도루와 같다 — 표 밖 선수는 원본 id, 마타자는 웹 기록표에 칸이 없다.
 */
export function recordDrawnTeamFieldingErrors(progress: TeamGameProgress, drawn: readonly DrawnFieldingError[]): TeamGameProgress {
  const gameDrawn = drawn.filter((error) => error.teamIndex === progress.options.ourTeamId || error.teamIndex === progress.options.opponentTeamId)
  const errors = fieldingErrorRecordsOf(gameDrawn, (error) => {
    const teamId = error.teamIndex
    if (teamId === null) return null
    const entry = entryBattersOf(progress, teamId)
    const index = fielderRecordIndexOf(entry, error.slot)
    const player = entry[index]
    if (player === undefined || player.aceIndex >= 0) return null
    const rosterSlot = player.rosterSlot
    if (rosterSlot === NO_ROSTER_SLOT) {
      return player.recordId === undefined ? null : { teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId: player.recordId }
    }
    return { teamId: player.tableTeamId ?? teamId, battingOrderIndex: rosterSlot }
  })
  /*
   * 펌블 갈래는 +0x2e 뒤 0xa755d(ctx, 3) — 시즌 평판 코드 3(수비실수, 43854~43862). [+0xec] != 0 일 때만이라 레코드를 찾은 야수만
   * (마선수도 레코드가 있어 센다 — 기록표 칸이 없을 뿐). 게이트 0xa755c 는 코드 ≤ 5 를 공격측이 CPU 일 때만 적으므로 우리 팀 수비 그림만 남는다
   */
  const fumbleCodes = drawn
    .filter((error) => error.isFumble === true && error.teamIndex === progress.options.ourTeamId)
    // 그림이 레코드를 실었으면 이미 [+0xec] != 0 인 것만 왔다(`drawnFieldingErrorsOf`) — 옛 입구만 명단으로 찾는다
    .filter((error) => error.record !== undefined || fielderRecordIndexOf(entryBattersOf(progress, progress.options.ourTeamId), error.slot) >= 0)
    .map(() => SEASON_RECORD_CODE.수비실수)
  // 시즌(모드 2)이 아니면 `withSeasonRecord` 가 칸을 그대로 돌려준다
  const gameRecord = fumbleCodes.length === 0 ? progress.gameRecord : withSeasonRecord(progress, '수비', fumbleCodes)
  if (errors.length === 0 && gameRecord === progress.gameRecord) return progress
  return {
    ...progress,
    ...(errors.length === 0 ? {} : { leagueErrors: [...(progress.leagueErrors ?? []), ...errors] }),
    gameRecord,
  }
}
