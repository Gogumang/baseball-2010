import { nextSeasonLeague, pitcherOrderOf, pitcherOrdersAfterPostseason } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { endNationalCup, seasonStartCountersOf } from '@/entities/career/model/playerCareer'
import { nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { rollNariCpuEquipment } from '@/entities/career/model/nariCpuEquipment'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  moveMyPitcherToStart,
  myPitcherPositionCodeOf,
  recordedMyPitcherOrderOf,
  withMyPitcherOrder,
} from '@/entities/pitcher-career/model/myPitcherRecord'
import { MAXIMUM_MONEY, MAXIMUM_MORALE, ORIGINAL_MONEY_UNIT } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import { EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import { pitcherYearlyStatsOf } from '@/entities/pitcher-career/model/pitcherCareer/stats/yearlyStats'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 시즌을 넘긴다 (0x1b768). 타자편 `startNextSeason` 과 같은 자리에
 * **스태미나 되돌리기**(시즌 시작 0xb6cc4 → 10000)가 하나 더 붙는다.
 */
export function startNextPitcherSeason(career: PitcherCareer, random: RandomPort, afterRelease = false): PitcherCareer {
  // +0x6b+i 사본 · +0x1c2 는 연말 132 꼬리(10d08~10d28)가 쓴다 — 방출 이어하기(`afterRelease`)는 그 꼬리를 안 지났다 (B-128)
  const next = { ...startNextPitcherSeasonRecords(career), ...seasonStartCountersOf(career, afterRelease) }
  // 1b86c — 0x665e8(g, S+0xb3(새 연차 = 지난 season), S[1]) 가 내 팀 뺀 아홉 팀 레코드의 장비 니블을 굴린다
  // (투수편 모드 3 → 0x1f940). 0x1b684(1b852)의 내 투수 옮기기 뒤다 — 내 팀은 굴리지 않으니 차례만 지킨다 (`nariCpuEquipment`)
  const records = nariTeamsOf(next)
  const rolled = rollNariCpuEquipment(records, random, career.season, career.teamId, (team) => pitcherOrderOf(next.league, team))
  return rolled === records ? next : { ...next, nariTeams: rolled }
}

function startNextPitcherSeasonRecords(career: PitcherCareer): PitcherCareer {
  // 0x1b768 → 0x1b852 `0x1b684` — 보직 2 가 아니면 내 투수를 레코드 0번으로 (레코드에 배열이 있을 때만 — 옛 저장은 142 가 세운다)
  const recorded = recordedMyPitcherOrderOf(career)
  const order = recorded === null ? null : moveMyPitcherToStart(recorded, career.role)
  return {
    // 0x1b768 의 1b774 `S+0x12c = 0` — 국가대항전 플래그를 내린다
    ...endNationalCup(career),
    // 1b7c4~1b834 — 지난 해 레코드를 연도별 칸 S[0xb3] − 1 에 복사한 뒤 시즌 칸을 비운다(아래 `stats` · `stamina`)
    yearlyStats: [...pitcherYearlyStatsOf(career), career.stats],
    ...(order === null ? {} : { nariTeams: withMyPitcherOrder(career, order), positionCode: myPitcherPositionCodeOf(order) }),
    season: career.season + 1,
    gamesPlayed: 0,
    // 칭호 25·26 은 새 시즌 첫 경기 전에 **지난해** 외출 수로 본다 (P3 9절)
    // +0x6a 는 시즌 전환에서 안 지운다(1b768) — 두 칸의 합이 원본 칸(타자편 `outingsLastSeason` 주석)
    outingsThisSeason: 0,
    outingsLastSeason: career.outingsLastSeason + career.outingsThisSeason,
    popularityAtSeasonStart: career.popularity,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    morale: MAXIMUM_MORALE,
    money: Math.min(MAXIMUM_MONEY, career.money + career.salary * ORIGINAL_MONEY_UNIT),
    stamina: FULL_STAMINA,
    stats: EMPTY_PITCHER_SEASON_STATS,
    // 승패는 비우되 **투수 레코드 차례는 잇는다** (`nextSeasonLeague` — 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않는다).
    // 레코드 +0x2c 는 첫 경기 준비(g == 0)가 열 팀 10000 으로 채운다
    league: nextSeasonLeague(
      career.postseason === null ? career.league.pitcherOrders : pitcherOrdersAfterPostseason(career.postseason, career.league.pitcherOrders),
    ),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    regularSeasonRewardTaken: false,
    // 0x1b7ba `S[0x50] = 1` — 시즌 끝 사슬을 벗어난다
    seasonEndState: null,
    // 0x1b882 `memset(S+0x1bc, 0, 4)` — 연속 기록 세 칸을 지운다
    streaks: EMPTY_PITCHER_STREAKS,
    wins: 0,
    draws: 0,
    losses: 0,
  }
}
