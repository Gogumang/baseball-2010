import type { SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { judgeTitles, NO_TEAM } from '@/entities/awards/model/seasonAwards'
import { type PostseasonSeries, postseasonGameOf } from '@/entities/league/model/league'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { type LeaderKind, leaderOf } from '@/entities/awards/model/leaderboard'
import {
  SEASON_MVP_LEADER_KINDS,
  SEASON_AWARD_INTRO_EVENT_ID,
  seasonTitleResultEventId,
  seasonMvpResultEventId,
} from '@/widgets/season/lib/seasonAwardEvents'
import { SYSTEM_TITLE_WINDOW, titleWindowTextOf, SYSTEM_MVP_WINDOW, mvpWindowTextOf } from '@/pages/story/lib/awardWindows'
import { isPitcherLeaderKind, seasonLeagueRecordsOf } from '@/app/model/seasonSession/awards/leagueRecords'
import type { SeasonLeagueRecordSource } from '@/app/model/seasonSession/records/entryCells'
import { cpuRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/** 시상 판정의 재료 — 순위표 0x9d789 가 훑는 지금 레코드 (`seasonLeagueRecordsOf`) */
function seasonAwardSourceOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined): SeasonLeagueRecordSource {
  return {
    league: save.league,
    myTeamId: save.state.record.teamId,
    roster: save.roster,
    cpuRosterOf: (team: number) => cpuRosterOf(save, team),
    playerStats: save.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    ...(recordOf === undefined ? {} : { recordOf }),
  }
}

/** 0x8dad4(evt, 0xc 타자 · 0xd 투수) — 시즌은 **1위 팀 == 내 팀** 이면 그 칸이 내 것(evt+0x36c+i) */
function seasonTitlesOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined, isPitcher: boolean) {
  const records = seasonLeagueRecordsOf(seasonAwardSourceOf(save, recordOf), isPitcher).map((record) => ({
    ...record,
    isMine: record.teamId === save.state.record.teamId,
  }))
  return judgeTitles(records, isPitcher ? '시즌투수' : '타자')
}

/**
 * 포스트시즌 중 `SR+0xb2`(= L+0x32, 웹 `record.games`) — 그 시리즈에서 치른 경기 수다. 대진 0xb80a8 이 0(b811c), 시리즈가
 * 끝나는 승 0xb7724 가 −1(b777a), 하루 끝 0xb818c 가 +1(b819a) → 새 시리즈 첫날과 한국시리즈가 끝난 뒤는 0.
 * 진입 분기 0xcb(≠ 0 이면 0xef) · 0xe9(0 ? 0xee : 0xef) · 6850 첫날 스태미나 · 메시지줄(0 이면 45)이 이 값을 본다.
 */
export function postseasonDayOf(series: PostseasonSeries): number {
  return series.round === '종료' ? 0 : postseasonGameOf(series)
}

/**
 * 0x8dd60 8dd9a~8ddf0 — 표 0xd4f34(일곱 칸)에서 `rand(0, 7)` 로 종류를 고르고 순위표 0x9d789(…, 종류, 2, 1)를 세워
 * 칸 수 0x9da19 가 0 이면(그 종류 1위가 없으면) **다시 굴린다**(8ddc8 고리). 빈 순위표마다 rand 한 번이 더 든다.
 * ⚠️ 근사(남김 — 원본 무한 고리 · 닿지 않는 길): 원본은 일곱 종류가 모두 비면 끝없이 돈다 — 웹은 그때만 첫 굴림 하나로 멈춘다(정규시즌을 치른 리그에선 닿지 않는다).
 */
export function rollSeasonMvpKind(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined, random: RandomPort): LeaderKind | null {
  const source = seasonAwardSourceOf(save, recordOf)
  const hasLeader = (kind: LeaderKind) => leaderOf(seasonLeagueRecordsOf(source, isPitcherLeaderKind(kind)), kind) !== null
  const anyLeader = SEASON_MVP_LEADER_KINDS.some(hasLeader)
  for (;;) {
    const kind = SEASON_MVP_LEADER_KINDS[random.rand(0, SEASON_MVP_LEADER_KINDS.length)] ?? null
    if (kind === null || !anyLeader || hasLeader(kind)) return kind
  }
}

/** 0x8dd60 — 고른 종류의 1위가 MVP 칸(evt+0x370 팀 · +0x374 이름), 그 팀이 내 팀이면 +0x388 */
function seasonMvpOf(save: SeasonSave, recordOf: SeasonEntryRecordSource | undefined, kind: LeaderKind | null) {
  const leader = kind === null ? null : leaderOf(seasonLeagueRecordsOf(seasonAwardSourceOf(save, recordOf), isPitcherLeaderKind(kind)), kind)
  return {
    winner: leader === null ? { teamId: NO_TEAM, name: '' } : { teamId: leader.record.teamId, name: leader.record.name },
    isMine: leader !== null && leader.record.teamId === save.state.record.teamId,
  }
}

/**
 * 시상 이벤트가 끝난 뒤 결과 이벤트 — 0x8b04c(시즌 갈래): 타자(evt+0x308 == 0xc)는 칸 0~2, 투수는 칸 0~3 중 내 칸이 있으면
 * 373 · 375, 없으면 372 · 374. 0x8b370(시즌 갈래): evt+0x388 이면 379, 아니면 378. 그 밖 이벤트면 null.
 */
export function seasonAwardFollowUpOf(
  eventId: number,
  save: SeasonSave,
  recordOf: SeasonEntryRecordSource | undefined,
  mvpKind: LeaderKind | null,
): number | null {
  if (eventId === SEASON_AWARD_INTRO_EVENT_ID.타자 || eventId === SEASON_AWARD_INTRO_EVENT_ID.투수) {
    const isPitcher = eventId === SEASON_AWARD_INTRO_EVENT_ID.투수
    const hasMine = seasonTitlesOf(save, recordOf, isPitcher).some((slot) => slot.isMine)
    return seasonTitleResultEventId(isPitcher ? '투수' : '타자', hasMine)
  }
  if (eventId === SEASON_AWARD_INTRO_EVENT_ID.MVP) return seasonMvpResultEventId(seasonMvpOf(save, recordOf, mvpKind).isMine)
  return null
}

/**
 * 시상 발표 창 글 — 370 · 371 의 system 3 은 0x8b3bc(문구 표 0xd4e30 — 시즌 투수는 넷째 칸 82 세이브왕까지),
 * 376 의 system 4 는 0x8b23c. 시즌(0x7b999 참)은 MVP 창에 축하 줄 StrUSER_EVT[84] 를 안 붙인다.
 */
export function seasonAwardWindowTextOf(
  eventId: number,
  sub: number,
  save: SeasonSave,
  recordOf: SeasonEntryRecordSource | undefined,
  mvpKind: LeaderKind | null,
): string | null {
  if (sub === SYSTEM_TITLE_WINDOW && (eventId === SEASON_AWARD_INTRO_EVENT_ID.타자 || eventId === SEASON_AWARD_INTRO_EVENT_ID.투수)) {
    const titles = seasonTitlesOf(save, recordOf, eventId === SEASON_AWARD_INTRO_EVENT_ID.투수)
    return titleWindowTextOf({ titles, wonCount: 0, isMostValuablePlayer: false, mostValuablePlayer: { teamId: NO_TEAM, name: '' } })
  }
  if (sub === SYSTEM_MVP_WINDOW && eventId === SEASON_AWARD_INTRO_EVENT_ID.MVP) {
    const { winner } = seasonMvpOf(save, recordOf, mvpKind)
    return mvpWindowTextOf({ titles: [], wonCount: 0, isMostValuablePlayer: false, mostValuablePlayer: winner })
  }
  return null
}
