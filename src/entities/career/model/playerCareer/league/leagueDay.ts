import { opponentOf } from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { NARI_LEAGUE_TEAM_IDS, nariLeagueRecordMoralesOf, nariMoraleOf, withNariTeamRecordMorales } from '@/entities/career/model/nariMorale'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { nariTeamsOf, withCpuGameRecordAces } from '@/entities/career/model/nariTeamRecord'
import { nariLeagueTeamRecordOf } from '@/entities/career/model/nariCpuEquipment'
import { humanGamePitcherOrderOf, humanGamePitcherStaminasOf, recoveredLeagueStaminas } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { BATTER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 같은 날 나머지 네 경기를 치러 리그 전적에 넣는다.
 * 원본도 사람 경기 정산(0x4ea0c) 안에서 0xc2a48 을 따로 부른다 — 기록 갱신과 별개의 단계다.
 * `applyGameResult` 뒤에 부르는 것을 전제로 `gamesPlayed − 1` 을 일차로 쓴다.
 */
export function applyLeagueDay(
  career: PlayerCareer,
  myTeamId: number,
  random: RandomPort,
  /** 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기의 마선수 배율(0xd88aa). 안 넘기면 Lv1(60%) */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * CPU 경기 때의 나리 사기 0xa3a24 (`LeagueAbilityContext.nariMorale`) — 정산 0x4ea0c 는 평가 0xa719c(4f274, 사기를 바꾼다)를 CPU 경기
   * 0xc2a48(4f296)보다 먼저 돌리므로 부르는 쪽이 **평가 뒤** 사기를 넘긴다. 안 넘기면 지금 커리어의 나리 사기
   */
  nariMorale: number = nariMoraleOf(career),
): PlayerCareer {
  // 포스트시즌 경기 끝은 4f268 이 CPU 리그 경기(0xc2a48)를 건너뛰고 곧장 하루 끝으로 간다 — 회복만 돈다
  if (career.postseason !== null) {
    return { ...career, leaguePitcherStaminas: recoveredLeagueStaminas(career.leaguePitcherStaminas ?? {}, BATTER_EDITION_MODE) }
  }
  const day = Math.max(0, career.gamesPlayed - 1)
  // 원본 0xc2a48 은 승패만이 아니라 **선수별 타석 기록(0xa8024)도** 남긴다 — 둘 다 받아 넣는다.
  // CPU 경기 투수는 리그 표의 +0x2c 로 서고(경기 사이에 이어진 값), 사람 경기 두 팀 차례는 여기서 한 칸 돈다
  const played = playLeagueDay(
    career.league,
    day,
    myTeamId,
    random,
    career.leaguePlayerStats,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
    true,
    // 간이 타석의 능력 0xb570d(…, 1, 0x5a, 1) — 모드 4 는 팀 능력치 정액 0xb592c(모드 비트 0x306 = 1·2·8·9)도 코치(모드 2)도
    // 안 탄다. 밑값 그대로다. 같은 0xb570c 의 b5768 이 두 팀 레코드 +2 에 나리 사기를 쓴다(용량 0x66e44) — 1회초 수비 팀 첫 공만 앞 값
    { mode: BATTER_EDITION_MODE, nariMorale, staleRecordMorales: nariLeagueRecordMoralesOf(career) },
    // 0xc239c → 0xb8680(모드 3·4 → 0x1f989)이 나리 레코드를 읽는다 — 새 시즌 CPU 장비 굴림 0x665e8 이 쓴 니블이 0xb6414 보너스로 먹는다
    (teamId) => nariLeagueTeamRecordOf(career.nariTeams, teamId),
  )
  // 그날 CPU 경기를 치른 여덟 팀(내 팀 · 사람 경기 상대 말고 모두)의 레코드 +2 는 이 사기로 덮였다
  const cpuTeams = NARI_LEAGUE_TEAM_IDS.filter((teamId) => teamId !== myTeamId && teamId !== opponentOf(day, myTeamId))
  return {
    ...withNariTeamRecordMorales(career, cpuTeams, nariMorale),
    league: played.league,
    leaguePlayerStats: played.playerStats,
    // 하루 끝 4f2e8 — 열 팀 0xb617c (+20%)
    leaguePitcherStaminas: recoveredLeagueStaminas(played.pitcherStaminas, BATTER_EDITION_MODE),
    // 0xc239c 가 0xb8680(모드 4 → 0x1f989)으로 받은 나리 레코드에 넣은 마선수는 경기 뒤에도 남는다 (A-05)
    nariTeams: withCpuGameRecordAces(nariTeamsOf(career), played.recordAces),
  }
}

/**
 * 사람 경기 준비 `0x1c46c` 가 세운 두 팀 투수 — 레코드 차례(0번 선발 · 벤치 차례)와 칸별 `+0x2c`.
 * `startGame` 마지막 인자(`GamePitcherSetup`)로 넘긴다. g 는 `leagueDayCounterOf`.
 */
export function leagueGamePitchersOf(
  career: PlayerCareer,
  opponentTeamId: number,
): {
  readonly ourOrder: readonly number[]
  readonly opponentOrder: readonly number[]
  readonly ourStaminas?: readonly number[]
  readonly opponentStaminas?: readonly number[]
} {
  const day = leagueDayCounterOf(career)
  const ourStaminas = humanGamePitcherStaminasOf(career, day, career.teamId)
  const opponentStaminas = humanGamePitcherStaminasOf(career, day, opponentTeamId)
  return {
    ourOrder: humanGamePitcherOrderOf(career, BATTER_EDITION_MODE, day, career.teamId),
    opponentOrder: humanGamePitcherOrderOf(career, BATTER_EDITION_MODE, day, opponentTeamId),
    ...(ourStaminas === undefined ? {} : { ourStaminas }),
    ...(opponentStaminas === undefined ? {} : { opponentStaminas }),
  }
}
