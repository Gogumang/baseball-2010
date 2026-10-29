/**
 * 칭호(닉네임) — 원본 StrNICKNAME 128개는 이름 64개(0~63) + 획득 조건 원문 64개(64~127) 의 짝이다. 판정은 0x1a1c0 (P3 4절).
 *
 * 공개 이름 모음 — 하위 폴더 (`titles/`): `names`(이름 · 번호 · 목록 0x104cc · 전부 수집 0x28e98) · `subject`(공통 판정이 보는 값 ·
 * 괴물 0x1a6b6 · 국민 0x1a704 · 6년차 0x1ac34) · `commonRules`(공통 0~31) · `batterRules`(타자편 32~47) · `sceneTitles`(국가대표
 * 0x1b92c · 다이너마이트 배트 0x1278c) · `award`(주기 · 장착 0x11f78 · 팝업 0x11fd8) · `otherSlices`(다른 조각)
 */
export {
  ALL_TITLES_REWARD_GAME_POINT,
  COMMON_TITLE_COUNT,
  conditionTextOf,
  isAllTitlesCollected,
  PITCHER_TITLE_OFFSET,
  TITLE_COUNT,
  TITLE_NAMES,
  TITLE_ROWS_PER_PAGE,
  titleDisplayNameOf,
  titleListOf,
  titleNumberOf,
} from '@/entities/career/model/titles/names'
export {
  isSixthYearCheckPoint,
  matchesMonsterTitle,
  matchesNationalTitle,
  ROMANCE_EVENT_IDS,
  type TitleSubject,
} from '@/entities/career/model/titles/subject'
export { matchedCommonTitleNumbers } from '@/entities/career/model/titles/commonRules'
export { BUNT_KING_SKILL } from '@/entities/career/model/titles/batterRules'
export { gameResultTitleOf, nationalCupStandingsTitleOf } from '@/entities/career/model/titles/sceneTitles'
export {
  awardTitles,
  currentTitleOf,
  equipTitle,
  equipTitleNoticeOf,
  evaluateNewTitles,
  NO_EQUIPPED_TITLE,
  nextTitleOf,
  unownedTitleNamesOf,
} from '@/entities/career/model/titles/award'
