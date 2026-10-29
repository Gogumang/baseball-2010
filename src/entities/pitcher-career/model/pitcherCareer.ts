/**
 * 나만의리그 **투수편**(원본 모드 3) 육성 선수 레코드 — 공개 이름 모음.
 *
 * 레코드 칸과 타자편과의 같은 칸 · 다른 칸은 `pitcherCareer/types/pitcherCareer.ts` 머리말에 있다. 하위 폴더:
 *   - `constants` · `bounds` — 상한 · 신인 시작값(0x11244~) · 자르기
 *   - `stats/` — 시즌 줄(+0x20~+0x2f) · 완투 계열(+0x1f0) · 연도별 칸(0x1fa78)
 *   - `evaluation/` — 116 경기 뒤 평가 재료(S+0x1d8) · 진입 0x1278c 의 저장 칸 몫
 *   - `create/` — 등록(0x10fb4 · 0x11230)
 *   - `growth/` · `skills/` — 값 올리기 · 보유/장착 비트(+0x1b8 · 기록 +0x14)
 *   - `ability/` — 실효 능력치 0xb6414 → 경기용 0xb570c
 *   - `game/` — 경기 결과 반영 · 사람 경기 끝 리그 표 되적기
 *   - `league/` — 142 진입 0x1c46c 의 내 팀 몫 · 같은 날 CPU 경기 0xc2a48
 *   - `season/` — 정규시즌 끝 0xb818c · 포스트시즌 0x13da0 · 다음 상대 0xb765c · 새 시즌 0x1b768
 */
export type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'
export {
  DEFAULT_TEAM_ID,
  GAMES_PER_MANAGEMENT_CYCLE,
  GAMES_PER_SEASON,
  HIDDEN_PITCH_ROW_COUNT,
  MAXIMUM_ABILITY,
  ORIGINAL_MONEY_UNIT,
  PITCH_TRAINING_CELL_COUNT,
  STARTING_MONEY,
  STARTING_MORALE,
  STARTING_POPULARITY,
  STARTING_REPUTATION,
  STARTING_SALARY,
} from '@/entities/pitcher-career/model/pitcherCareer/constants'
export {
  EMPTY_PITCHER_SEASON_STATS,
  pitcherRecordLineOf,
  pitcherWalksOf,
  seasonEarnedRunAverageOf,
  type PitcherSeasonStats,
} from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
export { EMPTY_COMPLETE_GAME_COUNTS, countCompleteGame } from '@/entities/pitcher-career/model/pitcherCareer/stats/completeGames'
export { migratePitcherYearlyStats, pitcherYearlyStatsOf } from '@/entities/pitcher-career/model/pitcherCareer/stats/yearlyStats'
export { NO_LAST_EVALUATION, pitcherLastGameLineOf, type PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer/evaluation/lastGame'
export { enterPitcherGameEvaluation } from '@/entities/pitcher-career/model/pitcherCareer/evaluation/enterGameEvaluation'
export { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/create/createPitcherCareer'
export {
  gainPitcherAbility,
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
  spendPitcherCycleAction,
} from '@/entities/pitcher-career/model/pitcherCareer/growth/gains'
export {
  equippedPitcherSkillIdsOf,
  hasPitcherSkill,
  isPitcherSkillEquipped,
  pitcherSkillTableIdOf,
  setPitcherSkillEquipped,
} from '@/entities/pitcher-career/model/pitcherCareer/skills/pitcherSkills'
export { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer/ability/equippedAbility'
export {
  effectivePitcherAbilityOf,
  gamePitcherAbilityBeforeMoraleOf,
  pitcherAbilityLimitsOf,
  pitcherFormOfCareer,
  unclampedGamePitcherAbilityOf,
  withMoraleAbilityCut,
} from '@/entities/pitcher-career/model/pitcherCareer/ability/gameAbility'
export { applyPitcherGameResult, type PitcherGameOutcome } from '@/entities/pitcher-career/model/pitcherCareer/game/gameResult'
export { withPitcherGameLeagueRecords, withPitcherGameStaminas } from '@/entities/pitcher-career/model/pitcherCareer/game/gameLeagueRecords'
export {
  pitcherLeagueGameSetupOf,
  prepareMyPitcherMatch,
  todayMyPitcherOrderOf,
} from '@/entities/pitcher-career/model/pitcherCareer/league/matchSetup'
export { applyPitcherLeagueDay } from '@/entities/pitcher-career/model/pitcherCareer/league/applyLeagueDay'
export { applyPitcherPostseasonProgress, applyPitcherSeasonEnd } from '@/entities/pitcher-career/model/pitcherCareer/season/seasonEnd'
export {
  isPitcherManagementCycleOpen,
  isPitcherSeasonFinished,
  nextPitcherOpponentOf,
} from '@/entities/pitcher-career/model/pitcherCareer/season/schedule'
export { startNextPitcherSeason } from '@/entities/pitcher-career/model/pitcherCareer/season/nextSeason'
