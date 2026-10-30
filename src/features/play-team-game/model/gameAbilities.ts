/**
 * **경기용 능력치** — 원본 `0xb570c(팀레코드, 칸, 선수, 적용플래그, …)` 의 시즌·팀 부분
 * (J-4, 전부 **확정**. 검증 V5 도 같은 값을 확인했다).
 *
 * 나만의리그(육성 선수) 부분은 `entities/career/model/condition` 쪽이 이미 들고 있다 —
 * 여기 있는 것은 **팀 경기(모드 1 일반 · 2 시즌 · 8·9 대전)** 가 쓰는 나머지다.
 *
 * 원본 함수가 값을 손대는 **순서**를 그대로 따른다 (주소 오름차순):
 * ```
 * 0xb5824  팀 질병 −30%        ┐
 * 0xb5844  보직 불일치 −20%    ├ 셋 다 **모드 2(시즌) & 내 팀 선수** 일 때만 (0xb581a 가 감쌈)
 * 0xb58ac  팀 사기 정액 감소   ┘
 * 0xb58e6  (체력% 피로 — 투구 흐름이 `fatiguedStatsOf` 로 따로 먹인다)
 * 0xb592c  팀 능력치 → 선수 능력치   (모드 1·2·8·9)
 * 0xb5a16  스킬 14 투지 v += v/10     (투수 · 장착 14 · 칸 ≠ 3 · 전역 경기 상태 — 모드 불문, `fightingSpirit`)
 * 0xb5a74  코치 보너스               (모드 2)
 * 0xb5b06  0..999 로 자름
 * ```
 *
 * 하위 폴더 (`gameAbilities/`): `slots`(칸 · 모드 · 상한) · `teamAbility`(0xb592c) · `seasonPenalties`(0xb5824 · 0xb5844 · 0xb58ac) ·
 * `coach`(0xb5a74 · 표 0xd884c) · `types` · `abilitySteps`(모드 가지 → 팀 정액 → 투지 → 코치 차례) · `gameAbility`(한 칸 · 네 칸 · 투수 피로 앞뒤)
 */
export { ABILITY_LIMIT, BATTER_SLOT, PITCHER_SLOT, TEAM_ABILITY_SLOT, TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities/slots'
export { isTeamAbilityMode, teamAbilityBonusOf, teamAbilitySlotFor } from '@/features/play-team-game/model/gameAbilities/teamAbility'
export {
  hasPositionMismatch,
  moraleFlatPenaltyOf,
  positionMismatchPenaltyOf,
  type FieldingAssignment,
} from '@/features/play-team-game/model/gameAbilities/seasonPenalties'
export { COACH_BONUS, coachBonusOf } from '@/features/play-team-game/model/gameAbilities/coach'
export type { SeasonTeamCondition } from '@/features/play-team-game/model/gameAbilities/types'
export { gameAbilitiesOf, gameAbilityOf, pitcherGameAbilityPartsOf } from '@/features/play-team-game/model/gameAbilities/gameAbility'
export { hasFightingSpiritBit } from '@/entities/pitching/model/pitcherGameStats'
