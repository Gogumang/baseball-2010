/**
 * 개인 타이틀(370~374)·시즌 MVP(375~377)·연봉협상 등급 k
 * (binary.mod 0x8dad4 · 0x8dd60 · 0xa4d78 — B-season-awards.md B-2·B-3·B-5, 모두 **확정**).
 *
 * 순위표 재료인 **CPU 선수 개인 시즌 성적**은 이제 `career.leaguePlayerStats` 에 쌓인다
 * (`entities/league/model/leaguePlayerStats.ts` — 사람 경기와 CPU 끼리 경기가 원본처럼 같은 표를 쓴다).
 * 시즌 초에는 표가 비어 1위가 없으니 수상도 MVP 도 없고, 45경기를 치르고 나면 살아난다.
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonAwards/`): `titles/`(타이틀 종류 표 0xd4f18 · 0xd4f24 · 개인 타이틀 0x8dad4) ·
 * `mvp/`(목표 달성 단계 2 0xa3de8 · 시상 0x8dd60 · MVP 비트 남기기) · `events`(370~377) · `mvpBits`(career+0x1ca 0xa4d2c · 0xa4d50) ·
 * `salary`(연봉협상 등급 k 0xa4d78) · `records/`(순위표 재료 0x9d789) · `otherSlices`(다른 조각)
 */
export type { AwardRole } from '@/entities/awards/model/seasonAwards/titles/titleSpecs'
export { judgeTitles, NO_TEAM, type TitleSlot } from '@/entities/awards/model/seasonAwards/titles/judgeTitles'
export { achievedGoalCountForMvp } from '@/entities/awards/model/seasonAwards/mvp/mvpGoals'
export { judgeAwards, judgeSeasonAwards, type SeasonAwards } from '@/entities/awards/model/seasonAwards/mvp/judgeAwards'
export {
  MVP_EVENT_ID,
  MVP_INTRO_EVENT_ID,
  MVP_MISSED_EVENT_ID,
  mvpResultEventId,
  TITLE_INTRO_EVENT_ID,
  titleResultEventId,
  titleRewardMoneyUnitsOf,
} from '@/entities/awards/model/seasonAwards/events'
export { careerMvpCount, hasBackToBackMvp, hasMvpInSeason, recordMvpSeason } from '@/entities/awards/model/seasonAwards/mvpBits'
export { recordSeasonMvp } from '@/entities/awards/model/seasonAwards/mvp/recordSeasonMvp'
export { MAXIMUM_SALARY_RANK, MVP_SALARY_BONUS, salaryNegotiationRankOf, salaryRankOf } from '@/entities/awards/model/seasonAwards/salary'
export {
  careerLeagueRecordsOf,
  leaguePitcherRecordsOf,
  leagueRecordsOf,
  myLeagueRecordOf,
} from '@/entities/awards/model/seasonAwards/records/leagueRecords'
