/**
 * 시즌모드(구단 운영, 장면 0x105)의 시즌 레코드 SR — 원본 `0x1f55c(저장)` = `[저장+0xb4] + 0x11c`.
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonRecord/`): `types`(SR 칸 · 하루 점수표 SR+0x1c0 · 시즌 상태) · `layout`(상한 · 칸 수 ·
 * 빈 점수표 · 팀 능력치 XlsTEAM_DATA) · `seasonYear`(새 시즌 0x5758 · 새 해 0x6e0c · 10년차 0xa3084 · 날짜 창 A-2) ·
 * `normalize`(옛 세이브 메우기)
 */
export type { SeasonDayBoard, SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord/types'
export {
  clampTo,
  DAY_BOARD_SIZE,
  GAME_RECORD_SIZE,
  initialTeamAbilities,
  MANAGEMENT_CYCLE,
  MONEY_LIMIT,
  MORALE_LIMIT,
  NO_COACH,
  POPULARITY_LIMIT,
  REPUTATION_LIMIT,
  SEASON_GAME_COUNT,
  STADIUM_EQUIPPED_SIZE,
  STADIUM_OWNED_SIZE,
  TEAM_ABILITY_LIMIT,
} from '@/entities/season-mode/model/seasonRecord/layout'
export { isFinalYear, seasonDayOf, startNewSeason, startNextYear } from '@/entities/season-mode/model/seasonRecord/seasonYear'
export { normalizeSeasonRecord, normalizeSeasonState } from '@/entities/season-mode/model/seasonRecord/normalize'
