import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'

/**
 * 팀경기 레코드 시즌 줄의 출처 — 시즌 세션이 대는 리그 선수 기록표(시즌 레코드 +0x20~ 의 웹 자리)와
 * 이 경기 줄을 더할지(기록 게이트 0xa56dc 모드 2 갈래: 국가대항전·포스트시즌이면 거짓).
 * `stats` 가 없으면(일반모드 1) 레코드는 Xls 행 사본이라 표의 줄(`RosterPlayer.recordLine`)을 읽는다 — 게이트 0xd8204 의 모드 1 은
 * 늘 거짓이라 경기 중에도 안 오른다(`countsThisGame` 거짓).
 */
export interface TeamMatchupRecords {
  readonly stats?: LeaguePlayerStats
  readonly countsThisGame: boolean
}

/** 일반모드(1)의 시즌 줄 출처 — 레코드 = Xls 행 그대로(행 바이트 32~43), 게이트 거짓 */
export const XLS_ROW_MATCHUP_RECORDS: TeamMatchupRecords = { countsThisGame: false }
