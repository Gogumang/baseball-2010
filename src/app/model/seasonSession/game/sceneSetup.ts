import { type League, rankingOf } from '@/entities/league/model/league'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { seasonOpponentOf } from '@/entities/season-mode/model/seasonStateMachine'
import { applyGameIncome } from '@/entities/season-mode/model/seasonAttendance'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { placedMatchInfoStadium, rollStadiumNumber } from '@/features/play-team-game/model/sceneStadium'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { SEASON_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/**
 * 내 팀·상대 팀의 지금 순위 (0부터) — 관중 수 계산의 입력 (0xb7aa1(L, 팀, 0)). 상대는 경기 객체에 선 팀이고
 * (0xa34b8 이 0xb6bdc(st, 0/1) 중 SR[1] 이 아닌 쪽을 고른다) 넘기지 않으면 일정표의 오늘 상대다.
 */
export function seasonRanksOf(league: League, record: SeasonRecord, opponentTeamId = seasonOpponentOf(record)) {
  const ranking = rankingOf(league)
  const rankOf = (team: number) => Math.max(0, ranking.indexOf(team))
  return { myRank: rankOf(record.teamId), opponentRank: rankOf(opponentTeamId) }
}

/**
 * **경기 장면 셋업의 관중·수입** — 0x3f584 → 0x39fdc(장면, 2) 의 모드 2 갈래(0x3a3c0)가 국가대항전(L+0xac = SR+0x12c)도
 * 포스트시즌(L+0x34 = SR+0xb4)도 아니면 `0xa34b8(SR)` 을 부른다(0x3a3e4). 새 경기·이어하기 둘 다 장면을 세우므로
 * **이어할 때마다 한 번 더 돌아 수입이 겹친다**(원본 버그 그대로). 난수 없음. 순위는 경기 **앞** 리그로 본다.
 * 해당이 없으면 받은 저장을 그대로 돌려준다.
 */
export function withSceneSetupIncome(current: SeasonSave, opponentTeamId: number): SeasonSave {
  const { record } = current.state
  if (record.nationalCup || record.inPostseason) return current
  return {
    ...current,
    state: {
      ...current.state,
      record: applyGameIncome(record, seasonRanksOf(current.league, record, opponentTeamId)),
    },
  }
}

/**
 * 시즌 0xdd 진입 0x6548(67dc~6834)의 무대 — 경기정보 바탕(`MatchInfoStadiumBackdrop`)의 재료.
 * 구장 = 0x78664(무대, 홈 팀)(> 9 면 rand(0, 10)) · 줄 = 0x78688 의 표 0xd377c · 하늘 줄 = 0x783b0 모드 2(SR+0xb2 mod 6).
 */
export function seasonMatchInfoStageOf(options: TeamGameOptions, random: RandomPort): MatchInfoStadiumState {
  const side0TeamId = options.playerSide === PLAYER_SIDE_LAST_BAT ? options.opponentTeamId : options.ourTeamId
  const side1TeamId = options.playerSide === PLAYER_SIDE_LAST_BAT ? options.ourTeamId : options.opponentTeamId
  const placed = placedMatchInfoStadium(rollStadiumNumber(random, side1TeamId))
  return {
    stadium: placed.stadium,
    fieldPalette: placed.paletteRow < 0 ? null : placed.paletteRow,
    skyRow: stadiumSkyRowOf({ mode: SEASON_MODE, dayCounter: options.dayCounter ?? 0 }) ?? 0,
    side0TeamId,
    side1TeamId,
    gameMode: SEASON_MODE,
  }
}
