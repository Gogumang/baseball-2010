/**
 * 시즌 선수영입 (상태 0xe2 → 0xdf → 0xc554) — `docs/re/S6-season-cleanup.md` 4 절 **확정**,
 * 고르는 규칙은 `docs/re/R13-season-leftovers.md` 9 절, 가드는 `docs/re/P4-season-flow.md` 5 절.
 *
 * ⚠️ **영입은 교체가 아니라 끼워넣기다** (S6 4-3 확정, CORRECTIONS "R13 9절" 정정 — 원본 버그 B-22):
 * 로스터가 매번 한 칸 늘고, 고른 자리에 있던 선수는 **맨 끝(벤치 마지막)으로 밀릴 뿐 빠지지 않는다.**
 * 정원 상한도 없다. 진짜 교체 함수 `0xb5648` 이 따로 있지만 영입은 그것을 쓰지 않는다.
 * **고침(`bugfixes.json` B-22, 기본 켬)**: 고른 자리의 선수를 새 선수로 **바꾼다**(명단 길이 그대로, 밀려난 선수는 빠진다).
 * 타자는 원본처럼 밀려난 선수의 수비 위치를 잇는다. 굴림은 없다.
 *
 * 공개 이름 모음 — 하위 폴더 (`playerRecruit/`): `playerRecord`(+0xa 비트 · 투수 0xb6278 · 명전 0xb6348 · 칸 번호 0xb6604) ·
 * `seasonPlayer`(명단 선수 꼴 · 붙박이 표 팀) · `insert`(나리 선수 · 끼워넣기 0xb521c · 0xb53f0) · `recruit`(영입 칸 0xc4ea · 중복 검사 ·
 * 확정 0xc554) · `removal`(명전 삭제 0x221dc · 나리 초기화 0x223a8 · 막기)
 */
export {
  HALL_OF_FAME_FIRST_ID,
  isHallOfFameRecord,
  isPitcherRecord,
  PLAYER_KIND,
  PLAYER_OWN_BIT,
  PLAYER_SLOT_MASK,
  playerKindOf,
  slotOf,
  withSlot,
  type PlayerKind,
} from '@/entities/season-mode/model/playerRecruit/playerRecord'
export { tableTeamOf, withTableTeam, type SeasonPlayer, type SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit/seasonPlayer'
export { insertBatter, insertPitcher, nariRecruitPlayerOf, RECRUIT_PITCHER_STAMINA } from '@/entities/season-mode/model/playerRecruit/insert'
export {
  hasRecruitedCareerPlayer,
  hasRecruitedHallOfFamePlayer,
  recruitPlayer,
  recruitSourceOf,
  recruitsPitcher,
  type RecruitRefusal,
  type RecruitResult,
  type RecruitSourceKind,
} from '@/entities/season-mode/model/playerRecruit/recruit'
export {
  hasCareerPlayerInSeasonTeam,
  isHallOfFameDeleteBlocked,
  removeCareerPlayerFromRoster,
  removeHallOfFamerFromRoster,
} from '@/entities/season-mode/model/playerRecruit/removal'

/** 영입 목록의 코드 (`[this+0xa8]+0x12c`, 점프표 `0xcbe8c`) */
export const RECRUIT_LIST_CODE = {
  취소: 0,
  나리투수: 1,
  나리타자: 2,
  명예투수: 3,
  명예타자: 4,
} as const
export type RecruitListCode = (typeof RECRUIT_LIST_CODE)[keyof typeof RECRUIT_LIST_CODE]
