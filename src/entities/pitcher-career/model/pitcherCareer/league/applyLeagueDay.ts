import { opponentOf, rotateLeaguePitchers } from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { NARI_LEAGUE_TEAM_IDS, nariLeagueRecordMoralesOf, nariMoraleOf, withNariTeamRecordMorales } from '@/entities/career/model/nariMorale'
import { nariTeamsOf, withCpuGameRecordAces } from '@/entities/career/model/nariTeamRecord'
import { nariLeagueTeamRecordOf } from '@/entities/career/model/nariCpuEquipment'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { recoveredLeagueStaminas } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { PITCHER_EDITION_MODE, cpuGameRotationAdvances } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 같은 날 나머지 네 경기 (0xc2a48) — 타자편과 같은 코드를 부른다.
 *
 * 사람 경기 준비 0x1c46c 는 g ≠ 0 이면 **상대 팀** 레코드를 0xb8c80 으로 한 칸 돌리고 내 팀은 돌리지 않는다(0xa4f60
 * 맞바꿈 — `pitcherGameFlow.ourPitcherOrderOf`). 그래서 `playLeagueDay` 에는 사람 경기 두 팀을 돌리지 말라고 하고
 * (`rotatesHumanGameTeams` 거짓) 상대만 여기서 돌린다 — 사람 경기가 본 차례(`pitcherLeagueGameSetupOf`)와 같은 칸이다.
 * 포스트시즌 경기 끝은 4f268 이 CPU 리그 경기를 건너뛰므로 하루 끝 회복만 돈다.
 */
export function applyPitcherLeagueDay(
  career: PitcherCareer,
  random: RandomPort,
  /** 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기의 마선수 배율(0xd88aa). 안 넘기면 Lv1(60%) */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * CPU 경기 때의 나리 사기 0xa3a24 (`LeagueAbilityContext.nariMorale`) — 정산 0x4ea0c 가 평가 0xa719c(4f274)를 CPU 경기(4f296)보다
   * 먼저 돌리므로 부르는 쪽이 평가 뒤 사기를 넘긴다. 안 넘기면 지금 커리어의 나리 사기
   */
  nariMorale: number = nariMoraleOf(career),
): PitcherCareer {
  if (career.postseason !== null) {
    return { ...career, leaguePitcherStaminas: recoveredLeagueStaminas(career.leaguePitcherStaminas ?? {}, PITCHER_EDITION_MODE) }
  }
  const day = Math.max(0, career.gamesPlayed - 1)
  const opponent = opponentOf(day, career.teamId)
  const league = cpuGameRotationAdvances(PITCHER_EDITION_MODE, day) ? rotateLeaguePitchers(career.league, [opponent]) : career.league
  const played = playLeagueDay(
    league,
    day,
    career.teamId,
    random,
    career.leaguePlayerStats,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
    false,
    // 간이 타석의 능력 0xb570d(…, 1, 0x5a, 1) — 모드 3 은 팀 능력치 정액 0xb592c(모드 비트 0x306 = 1·2·8·9)도 코치(모드 2)도
    // 안 탄다. 밑값 그대로다. 같은 0xb570c 의 b5768 이 두 팀 레코드 +2 에 나리 사기를 쓴다(용량 0x66e44) — 1회초 수비 팀 첫 공만 앞 값
    { mode: PITCHER_EDITION_MODE, nariMorale, staleRecordMorales: nariLeagueRecordMoralesOf(career) },
    // 0xc239c → 0xb8680(모드 3·4 → 0x1f989)이 나리 레코드를 읽는다 — 새 시즌 CPU 장비 굴림 0x665e8 이 쓴 니블이 0xb6414 보너스로 먹는다
    (teamId) => nariLeagueTeamRecordOf(career.nariTeams, teamId),
  )
  // 그날 CPU 경기를 치른 여덟 팀(내 팀 · 사람 경기 상대 말고 모두)의 레코드 +2 는 이 사기로 덮였다
  const cpuTeams = NARI_LEAGUE_TEAM_IDS.filter((teamId) => teamId !== career.teamId && teamId !== opponent)
  return {
    ...withNariTeamRecordMorales(career, cpuTeams, nariMorale),
    league: played.league,
    leaguePlayerStats: played.playerStats,
    // 하루 끝 4f304 — 열 팀 0xb617c (내 육성 선수가 아니면 +20%). 내 투수 회복은 `applyPitcherGameResult` 가 한다
    leaguePitcherStaminas: recoveredLeagueStaminas(played.pitcherStaminas, PITCHER_EDITION_MODE),
    // 0xc239c 가 0xb8680(모드 3 → 0x1f989)으로 받은 나리 레코드에 넣은 마선수는 경기 뒤에도 남는다 (A-05)
    nariTeams: withCpuGameRecordAces(nariTeamsOf(career), played.recordAces),
  }
}
