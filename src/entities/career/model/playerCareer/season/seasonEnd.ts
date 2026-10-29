import { startPostseason } from '@/entities/league/model/league'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseasonWithStamina } from '@/entities/league/model/postseasonPlay'
import { nariLeagueRecordMoralesOf, nariMoraleOf } from '@/entities/career/model/nariMorale'
import { nariTeamsOf, withCpuGameRecordAces } from '@/entities/career/model/nariTeamRecord'
import { nariLeagueTeamRecordOf } from '@/entities/career/model/nariCpuEquipment'
import { BATTER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer/constants'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 대진 128 [확인]의 CPU 끼리 포스트시즌(0x13da0 → 0xc2760) — 리그 표의 +0x2c 로 서고 깎인 값을 남긴다(회복 없음).
 * 내 차례이거나 끝난 대진이면 그대로다.
 */
export function applyPostseasonCpuGames(career: PlayerCareer, random: RandomPort, aceLevels?: Readonly<Record<number, number>>): PlayerCareer {
  if (career.postseason === null) return career
  const result = runCpuPostseasonWithStamina(
    career.postseason,
    career.teamId,
    random,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
    // 0xc2760 → 0xc239c 간이 엔진의 0xb570c b5768 — 두 팀 레코드 +2 = 나리 사기 (`LeagueAbilityContext.nariMorale`).
    // 1회초 수비 팀 첫 공만 그 레코드의 앞 값 (`staleRecordMorales`, r101)
    { mode: BATTER_EDITION_MODE, nariMorale: nariMoraleOf(career), staleRecordMorales: nariLeagueRecordMoralesOf(career) },
    // 0xc2760 도 0xc239c 로 나리 레코드를 읽는다 — 새 시즌 CPU 장비 니블(0x665e8)
    (teamId) => nariLeagueTeamRecordOf(career.nariTeams, teamId),
  )
  return {
    ...career,
    postseason: result.series,
    leaguePitcherStaminas: result.pitcherStaminas,
    ...(result.staleRecordMorales === undefined ? {} : { teamRecordMorales: result.staleRecordMorales }),
    // 0xc2760 → 0xc239c 도 나리 레코드에 마선수를 넣고 남긴다 (A-05)
    ...(result.recordAces === undefined ? {} : { nariTeams: withCpuGameRecordAces(nariTeamsOf(career), result.recordAces) }),
  }
}

/**
 * 45경기가 끝나면 정규시즌을 닫는다 (0xb818c).
 * 1위면 레코드 +0x7a 를 늘리고, 포스트시즌 대진(0xb80a8)을 연다.
 * 이미 포스트시즌이 열려 있으면 아무것도 하지 않는다.
 */
export function applySeasonEnd(career: PlayerCareer): PlayerCareer {
  if (career.postseason !== null || career.gamesPlayed < GAMES_PER_SEASON) return career
  const result = finishRegularSeason(career.league, career.teamId)
  return {
    ...career,
    regularSeasonFirstCount: career.regularSeasonFirstCount + (result.isRegularSeasonFirst ? 1 : 0),
    // 대진 0xb80a8 — 정규시즌 끝 투수 레코드 차례를 그대로 들고 간다 (포스트시즌 선발·벤치 차례의 바탕)
    postseason: startPostseason(result.ranking, career.league.pitcherOrders),
  }
}
