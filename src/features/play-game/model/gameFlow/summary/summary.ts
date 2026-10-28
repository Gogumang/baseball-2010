import type { GameSummary } from '@/entities/game/model/gameSummary'
import { resultOf } from '@/entities/game/model/gameState'
import { gameEndRecordIdsOf, completeGameRecordIdsOf } from '@/entities/game/model/gameRecords'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { chargePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { finalStaminasOf } from '@/features/play-game/model/gameFlow/quick/stamina'
import { endLineScoreOf, pitchersOfRecordOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { MY_LEAGUE_BATTER_MODE } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

export function summaryOf(progress: GameProgress): GameSummary {
  return {
    result: resultOf(progress.game),
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    stats: progress.myStats,
    popularityPoints: progress.popularityPoints,
    recordIds: [
      ...progress.recordIds,
      ...gameEndRecordIdsOf(progress.game.ourScore - progress.game.opponentScore),
      ...completeGameRecordIdsOf({
        // 나만의리그 타자편 = 원본 모드 4 → 0xa7de8 이 완투 계열을 아예 주지 않는다 (R8 6절)
        mode: MY_LEAGUE_BATTER_MODE,
        won: progress.game.ourScore > progress.game.opponentScore,
        // 타자편에는 사용자가 투구 코스를 찍는 순간이 없다 → state+0x8c 는 늘 0
        pitchCourseConfirmed: false,
        inningsPlayed: progress.game.inning,
        outsRecorded: progress.pitching.outsRecorded,
        hitsAllowed: progress.pitching.hitsAllowed,
        // 모드 4 라 0xa7de8 이 완투 계열 앞에서 걸러 이 값을 읽지 않는다(R8 6절) — 간이 엔진 볼넷 수로 state[0x88] 을 대신해도 결과가 같다
        baserunnerAllowed: progress.pitching.walksAllowed > 0,
        runsAllowed: progress.game.opponentScore,
      }),
    ],
    doublePlays: progress.doublePlays,
    scoringPositionOuts: progress.scoringPositionOuts,
    reputationCounts: progress.reputationCounts,
    ourTeamId: progress.ourTeamId,
    opponentTeamId: progress.opponentTeamId,
    // 마타자(명단 밖 저장 레코드)는 리그 선수 기록표에 없다 — CPU 끼리 경기(`leagueDay`)와 같이 뺀다
    leaguePlateAppearances: progress.leaguePlateAppearances.filter((appearance) => appearance.battingOrderIndex !== ACE_BATTER_ROSTER_SLOT),
    // 도루 +0x2c 도 같다 — 마선수는 0xa56dc 가 거르고(c1a42), 웹 기록표에는 마타자 칸이 없다
    leagueStolenBases: (progress.leagueStolenBases ?? []).filter((steal) => steal.battingOrderIndex !== ACE_BATTER_ROSTER_SLOT),
    // 실책 +0x2e — 그림 0x43278 이 야수 +0xec 레코드에 올린 것. 마타자 레코드는 웹 기록표에 칸이 없다
    leagueErrors: (progress.leagueErrors ?? []).filter((error) => error.battingOrderIndex !== ACE_BATTER_ROSTER_SLOT),
    pitchersOfRecord: pitchersOfRecordOf(progress),
    // 경기 끝 판의 이닝별 점수판 0x41c18 — 득점 0xb6a9c 가 쌓은 칸
    lineScore: endLineScoreOf(progress.game),
    // 리그 투수 기록 재료 — 투수 줄(상대 마운드의 투구 수를 얹어)과 경기 끝 판정 0xa7de8
    leaguePitchers: {
      lines: chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, progress.opponentMound.pitcherSlot, {
        pitches: progress.opponentMound.pitches,
      }),
      decision: gameEndDecisionOf(progress.decisions),
      sideTeams: progress.game.playerSide === 0 ? [progress.ourTeamId, progress.opponentTeamId] : [progress.opponentTeamId, progress.ourTeamId],
    },
    // 양 팀 레코드 +0x2c — 경기에서 깎인 값이 리그 표로 이어진다 (하루 끝 0xb617c 회복은 부르는 쪽)
    // 로스터 칸(0~7)만 리그 표로 잇는다 — 8번(마투수)은 다음 142 의 0xb88c8 이 저장 레코드(+0x2c 포함)로 다시 덮는다
    pitcherStaminas: {
      ours: finalStaminasOf(progress.ourPitcherStaminas, progress.ourMound).slice(0, PITCHERS_PER_TEAM),
      opponent: finalStaminasOf(progress.opponentPitcherStaminas, progress.opponentMound).slice(0, PITCHERS_PER_TEAM),
    },
  }
}
