import { nextSeasonLeague, pitcherOrderOf, pitcherOrdersAfterPostseason } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import { nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { rollNariCpuEquipment } from '@/entities/career/model/nariCpuEquipment'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAXIMUM_MONEY, MAXIMUM_MORALE, ORIGINAL_MONEY_UNIT } from '@/entities/career/model/playerCareer/constants'
import { endNationalCup, seasonStartCountersOf } from '@/entities/career/model/playerCareer/season/seasonTurnover'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 새 시즌 처리 `0x1b768`. `afterRelease` 는 방출 엔딩 141 의 5000 G 이어하기(1be26)로 온 길 — 그 해 132 꼬리를 안 지났다
 * (`seasonStartCountersOf`). `random` 은 1b86c 의 CPU 장비 굴림 `0x665e8` 몫 — 이 처리 안의 난수는 그것뿐이다
 * (`nariCpuEquipment` 머리말). 새 연차 S+0xb3 = 지난 `season`(첫 시즌 S+0xb3 = 0 = `season` − 1).
 *
 * 시즌을 넘긴다 (0x1b768 · 안쪽 `0xa39a8`, S13 2절 전수 확정).
 * 시즌 성적은 초기화되고 통산 성적은 남는다.
 *
 * ⚠️ **원본 버그(B-27)** — `0xa39bc`·`0xa39c6` 이 **둘 다 `S+0x1e0`** 을 16바이트 지운다.
 * 경기 뒤 누적 카운터는 `+0x1e0`·`+0x1f0` **두 벌**이고 `0xa690c` 가 같은 값을 양쪽에 더하는데,
 * 둘째 줄이 `r6`(= `S + 0x1e0`)을 그대로 다시 써서 **`+0x1f0` 벌은 영영 안 지워진다**
 * → 스킬 획득 조건 10 · 11 · 16 이 읽는 `gameSkillCounters`(+0x1f0)가 해를 넘겨 계속 쌓인다.
 * 원본 그대로면 웹은 그 칸을 지우지 않는다. **고친 길(기본)은 새 시즌에 +0x1f0 도 지운다**(`startNextSeasonRecords`) — 굴림 없음.
 * 투수편 +0x1f0(`completeGameCounts` — 칭호 60 · 63)은 같은 함수가 남기지만 B-27 은 타자편 스킬 조건만 다룬다(그대로 둔다).
 */
export function startNextSeason(career: PlayerCareer, random: RandomPort, afterRelease = false): PlayerCareer {
  const next = { ...startNextSeasonRecords(career), ...seasonStartCountersOf(career, afterRelease) }
  // 1b86c — 0x665e8(g, S+0xb3, S[1]) 가 내 팀 뺀 아홉 팀 레코드의 장비 니블을 굴린다 (타자편 모드 4 → 0x1f8f8)
  const records = nariTeamsOf(career)
  const rolled = rollNariCpuEquipment(records, random, career.season, career.teamId, (team) => pitcherOrderOf(next.league, team))
  return rolled === records ? next : { ...next, nariTeams: rolled }
}

function startNextSeasonRecords(career: PlayerCareer): PlayerCareer {
  return {
    ...endNationalCup(career),
    // 1b7c4~1b834 — 지난 해 레코드를 연도별 칸 S[0xb3] − 1 에 복사한 뒤 시즌 칸을 비운다(아래 `stats`)
    yearlyStats: [...yearlyStatsOf(career), career.stats],
    season: career.season + 1,
    gamesPlayed: 0,
    // +0x6a 는 시즌 전환에서 안 지운다(1b768) — 두 칸의 합이 원본 칸이라 지난해 몫을 옮겨 두면 합이 그대로다.
    // (지난해 g == 2 셋업이 그 앞 몫을 이미 지웠다 — `withNariSceneSetupOutings`)
    outingsThisSeason: 0,
    outingsLastSeason: career.outingsLastSeason + career.outingsThisSeason,
    // 인기도 스냅샷 (+0x78 ← 지금 인기도, 0xa39e0) — 올해의 목표 "인기도 상승" 의 기준점
    popularityAtSeasonStart: career.popularity,
    // 올해의 목표 플래그 두 개를 되돌린다 — +0x1b7(0xa39d0) 창을 봤다 · +0x1bc(0x1b882) 연초 이벤트
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    // +0x6b+i 사본 · +0x1c2 인기도 합은 연말 132 의 꼬리가 쓴다 — `startNextSeason` 이 `seasonStartCountersOf` 로 얹는다
    // 새 시즌 전환 0x1b768: 사기 100, 소지금 += 연봉
    morale: MAXIMUM_MORALE,
    money: Math.min(MAXIMUM_MONEY, career.money + career.salary * ORIGINAL_MONEY_UNIT),
    stats: EMPTY_SEASON_STATS,
    // 리그를 새로 깐다 — `0xa39ae` 가 리그 객체(S+0x80)를 초기화하고, 뒤이어 `0x204e0(저장, 편, 0)`
    // 이 **리그 전 선수의 시즌 성적**을 0 으로 되돌린다(팀 레코드·능력치·사기는 그대로 둔다).
    // 웹판은 로스터가 붙박이 표라 성적만 따로 `leaguePlayerStats` 에 담는다 — 그 표가 0x204e0 이
    // 지우는 칸에 해당하므로 여기서 함께 비운다.
    // 승패는 비우되 **투수 레코드 차례는 잇는다** — 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않아 지난 시즌·포스트시즌에
    // 섞인 차례가 그대로 남는다 (`nextSeasonLeague`). 레코드 +0x2c 는 첫 경기 준비(g == 0)가 열 팀 10000 으로 채운다
    league: nextSeasonLeague(
      career.postseason === null ? career.league.pitcherOrders : pitcherOrdersAfterPostseason(career.postseason, career.league.pitcherOrders),
    ),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    // 0x1b7c0 `S[0x77] = 0` — 정규시즌 우승 보상 받음 플래그 해제 (S13)
    regularSeasonRewardTaken: false,
    // 0x1b7ba `S[0x50] = 1` — 시즌 끝 사슬을 벗어난다
    seasonEndState: null,
    // 0x1b882 `memset(S+0x1bc, 0, 4)` — 나리 S 의 +0x1bc 는 연속 기록 세 칸이다(0xa4ce0 · 0x8a6fc)
    streaks: { multiHit: 0, homeRun: 0, hitless: 0 },
    // 0xa39c6 — 원본은 +0x1e0 을 한 번 더 지워 +0x1f0(경기 뒤 누적 카운터)이 남는다(B-27). 고친 길은 이 벌도 지운다
    ...(isBugFixed('B-27') ? { gameSkillCounters: undefined } : {}),
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/** 연도별 기록 칸 (0x1fa8c) — 옛 저장은 빈 목록 */
export function yearlyStatsOf(career: Pick<PlayerCareer, 'yearlyStats'>): readonly SeasonStats[] {
  return career.yearlyStats ?? []
}
