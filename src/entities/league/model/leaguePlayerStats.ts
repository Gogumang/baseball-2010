/**
 * 리그 선수 시즌 기록표 — 타석 기록 함수 (binary.mod 0xa8024).
 *
 * 원본은 사람 경기(0xae24c·0xae3e8)와 CPU 끼리 경기(0xc2a48 → 0xc1054·0xc1170·0xc15a4·0xc1818)가
 * **같은 0xa8024** 를 불러 선수 레코드마다 타수(+0x20)·안타(+0x22)·홈런(+0x28)·타점(+0x2a)을 쌓는다.
 * 그래서 45경기가 끝나면 리그 선수 전원에게 시즌 성적이 있고, 개인 타이틀 순위표 0x9d789 가
 * 그 레코드들을 훑어 1위를 뽑는다 (B-season-awards.md B-2, **확정**).
 *
 * 웹판 로스터(`shared/config/original/roster.ts`)는 이름·능력치 네 칸뿐인 **붙박이 표**라 성적을
 * 담을 칸이 없다. 그래서 성적만 따로 떼어 이 표에 담고, 선수는 **타자 전역 번호**로 가리킨다
 * (`팀 × 12 + 로스터 칸` = `BATTERS` 배열의 색인 그대로).
 *
 * **투수 줄도 같은 표에 쌓는다** (투수편이 들어와 여기에 칸을 늘렸다). 원본은 같은 선수 레코드의
 * 다른 오프셋에 투수 성적을 쌓는다 (P1-pitcher-rules.md 6절 — 아웃 +0x20 · 실점 +0x22 ·
 * 세이브 +0x24 · 탈삼진 +0x26 · 투구 수 +0x28 · 승 +0x2e · 패 +0x2f). 웹은 로스터가 타자 12명 ·
 * 투수 8명으로 따로 있어 표도 두 칸으로 나눈다.
 *
 * ⚠️ **내 육성 선수는 이 표에 넣지 않는다.** 내 성적은 `career.stats` 가 이미 세고 있어서,
 * 여기에도 넣으면 두 번 세게 된다. 순위표를 만들 때 `seasonAwards.myLeagueRecordOf`(타자) ·
 * `pitcherSeasonFlow.myPitcherLeagueRecordOf`(투수) 로 끼워 넣는다.
 *
 * **사람 경기의 투수 줄도 같은 길로 받는다.** 원본은 사람 경기도 같은 0xa8024(타석)·0xa7de8(경기 끝 승·패·세)을
 * 부르므로, 사람 경기 요약이 상대(와 로스터) 투수의 등판 줄을 `leaguePitcherAppearancesOf` 로 만들어
 * `recordLeaguePitcherAppearances` 에 넘기면 CPU 끼리 경기와 똑같이 쌓인다.
 *
 * 공개 이름 모음 — 하위 폴더 (`leaguePlayerStats/`): `types/`(타자 줄 · 투수 줄 · 표 · 사건 꼴) · `lookup`(전역 번호 · 줄 찾기) ·
 * `batters/`(타석 0xa8024 · 도루 +0x2c · 실책 +0x2e) · `pitchers/`(경기 끝 판정 0xa7de8 · 등판 · 사사구 +0x2a) · `otherSlices`(다른 조각)
 */
export { EMPTY_LEAGUE_BATTER_LINE, type LeagueBatterLine } from '@/entities/league/model/leaguePlayerStats/types/batterLine'
export { EMPTY_LEAGUE_PITCHER_LINE, type LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
export { EMPTY_LEAGUE_PLAYER_STATS, type LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'
export type {
  LeagueFieldingError,
  LeaguePitcherAppearance,
  LeaguePlateAppearance,
  LeagueStolenBase,
} from '@/entities/league/model/leaguePlayerStats/types/events'
export {
  leagueBatterIdOf,
  leagueBatterLineOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  leagueRecordBatterLineOf,
  leagueRecordPitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats/lookup'
export { recordLeaguePlateAppearances } from '@/entities/league/model/leaguePlayerStats/batters/plateAppearances'
export { recordLeagueErrors, recordLeagueStolenBases } from '@/entities/league/model/leaguePlayerStats/batters/stealsAndErrors'
export { leaguePitcherAppearancesOf } from '@/entities/league/model/leaguePlayerStats/pitchers/decisions'
export { recordLeaguePitcherAppearances } from '@/entities/league/model/leaguePlayerStats/pitchers/pitcherAppearances'
export { recordLeagueFreePasses } from '@/entities/league/model/leaguePlayerStats/pitchers/freePasses'
