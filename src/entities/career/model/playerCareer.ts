/**
 * 나만의리그 **타자편**(원본 모드 4) 육성 선수 레코드 — 공개 이름 모음.
 * 투수편(`entities/pitcher-career/model/pitcherCareer`)도 같은 칸 · 같은 함수(평가 카운터 · 스킬 장착 · 국가대항전 플래그 ·
 * 새 시즌 사본)를 여기서 꺼내 쓴다. 하위 폴더 (`playerCareer/`):
 *   - `types/` · `constants` · `bounds` — 레코드 칸 · 상한 · 신인 시작값(0x11244~) · 자르기
 *   - `create/` — 등록(0x16e2c · 0x10fb4 · 0x11230)
 *   - `evaluation/` — 116 경기 뒤 평가 재료(S+0x1d8) · 경기 뒤 카운터(12bc2~12c84)
 *   - `training/` · `growth/` · `skills/` — 훈련 수(0x18a80) · 값 올리기 · 보유/장착 비트 · 스킬 보상(0x8c5bc)
 *   - `game/` · `league/` — 경기 결과 반영(0x4ea0c) · 같은 날 CPU 경기(0xc2a48) · 사람 경기 투수 준비(0x1c46c)
 *   - `season/` — 정규시즌 끝 0xb818c · 포스트시즌 0xc2760 · 다음 상대 0xb765c · 연말 132 꼬리 · 새 시즌 0x1b768
 */
export type { PlayerCareer, SeasonEndState } from '@/entities/career/model/playerCareer/types/playerCareer'
export {
  DEFAULT_TEAM_ID,
  GAMES_PER_MANAGEMENT_CYCLE,
  GAMES_PER_SEASON,
  MAXIMUM_ABILITY,
  MAXIMUM_GAME_POINT,
  MAXIMUM_MORALE,
  MAXIMUM_POPULARITY,
  MAXIMUM_REPUTATION,
  ORIGINAL_MONEY_UNIT,
  STARTING_MONEY,
  STARTING_MORALE,
  STARTING_POPULARITY,
  STARTING_REPUTATION,
  STARTING_SALARY,
} from '@/entities/career/model/playerCareer/constants'
export {
  nariLastGameOf,
  nariLastGameRecordLineOf,
  nariRecordLineOf,
  nariRecordLineTextOf,
  type NariLastGame,
  type NariRecordLine,
} from '@/entities/career/model/playerCareer/evaluation/nariLastGame'
export {
  addSeasonPopularityGain,
  countGameForSkills,
  countReputationZeroGame,
  countSkillGameCounters,
} from '@/entities/career/model/playerCareer/evaluation/skillGameCounters'
export {
  DEFAULT_ROOKIE_PROFILE,
  MAXIMUM_NAME_BYTES,
  STARTING_ABILITY,
  nameByteLengthOf,
  rookieAbilityOf,
  type RookieProfile,
} from '@/entities/career/model/playerCareer/create/rookie'
export { createCareer } from '@/entities/career/model/playerCareer/create/createCareer'
export { countTraining, trainingCountOf } from '@/entities/career/model/playerCareer/training/training'
export {
  gainAbility,
  gainGamePoint,
  gainMorale,
  gainPopularity,
  gainReputation,
  selectSpecialSwingNumber,
  spendCycleAction,
} from '@/entities/career/model/playerCareer/growth/gains'
export {
  MINUS_SKILL_IDS,
  PLUS_SKILL_SLOT_LIMITS,
  equippedPlusSkillCountOf,
  hasSkill,
  isMinusSkill,
  isSkillEquipped,
  plusSkillSlotLimitOf,
  rebuildEquippedSkillIds,
  setSkillEquipped,
} from '@/entities/career/model/playerCareer/skills/skillEquip'
export { applySkillReward } from '@/entities/career/model/playerCareer/skills/skillReward'
export { applyGameResult, gamePointRewardOf } from '@/entities/career/model/playerCareer/game/gameResult'
export { applyLeagueDay, leagueGamePitchersOf } from '@/entities/career/model/playerCareer/league/leagueDay'
export { applyPostseasonCpuGames, applySeasonEnd } from '@/entities/career/model/playerCareer/season/seasonEnd'
export { isManagementCycleOpen, isSeasonFinished, nextOpponentOf } from '@/entities/career/model/playerCareer/season/schedule'
export {
  NARI_OUTING_RESET_GAMES,
  endNationalCup,
  seasonStartCountersOf,
  withNariSceneSetupOutings,
} from '@/entities/career/model/playerCareer/season/seasonTurnover'
export { startNextSeason, yearlyStatsOf } from '@/entities/career/model/playerCareer/season/nextSeason'
