import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { isBugFixed } from '@/shared/config/bugfixes'
import { coachBonusOf } from '@/features/play-team-game/model/gameAbilities/coach'
import {
  hasPositionMismatch,
  illnessPenaltyOf,
  moraleFlatPenaltyOf,
  positionMismatchPenaltyOf,
} from '@/features/play-team-game/model/gameAbilities/seasonPenalties'
import { BATTER_SLOT, PITCHER_SLOT, TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities/slots'
import { isTeamAbilityMode, teamAbilityBonusOf, teamAbilitySlotFor } from '@/features/play-team-game/model/gameAbilities/teamAbility'
import type { GameAbilityInput } from '@/features/play-team-game/model/gameAbilities/types'

/** `gameAbilityPartsOf` 의 정액을 팀 능력치(0xb592c)와 코치(0xb5a74)로 나눈 것 — 스킬 14(b5a16~b5a72)가 그 사이에 선다 */
interface GameAbilitySteps {
  readonly beforeFatigue: number
  readonly teamBonus: number
  readonly coachBonus: number
}

/** 타자 수비 칸이고 보직이 자리와 어긋나는가 (0xb5844~0xb58a4) */
function isMismatchedFieldingSlot(input: GameAbilityInput): boolean {
  if (input.isPitcher || input.slot !== BATTER_SLOT.수비 || input.assignment === undefined) return false
  return hasPositionMismatch(input.assignment)
}

/** ── 모드 2 & 내 팀 선수만 (0xb581a 가 세 보정을 함께 감싼다): 질병 → 보직 → 사기 정액, 0 아래는 0 ── */
function seasonAdjustedBaseOf(input: GameAbilityInput): number {
  const season = input.season
  if (input.mode !== TEAM_GAME_MODE.시즌 || !input.isMyTeam || season === undefined) return input.base
  let value = input.base
  if (season.illness > 0) value += illnessPenaltyOf(value)
  if (isMismatchedFieldingSlot(input)) value += positionMismatchPenaltyOf(value)
  value -= moraleFlatPenaltyOf(season.morale)
  return value < 0 ? 0 : value
}

/** ── 팀 능력치 (모드 1·2·8·9, 0xb592c) ── */
function teamBonusOf(input: GameAbilityInput): number {
  const teamAbilities = input.teamAbilities
  if (teamAbilities === undefined || !isTeamAbilityMode(input.mode)) return 0
  return teamAbilityBonusOf(teamAbilities[teamAbilitySlotFor(input.isPitcher, input.slot)] ?? 0)
}

/**
 * ── 코치 보너스 (모드 2). 팀 검사가 없다 (0xb5a74~0xb5b04) — 원본 버그 B-21.
 * 고침(`bugfixes.json` B-21, 기본 켬): 내 팀(시즌 팀 [시즌+1]) 선수에게만 — 질병·사기 갈래(0xb5804)와 같은 팀 검사. 굴림 없음
 */
function seasonCoachBonusOf(input: GameAbilityInput): number {
  const season = input.season
  if (input.mode !== TEAM_GAME_MODE.시즌 || season === undefined || season.coach < 0) return 0
  if (!input.isMyTeam && isBugFixed('B-21')) return 0
  return coachBonusOf(season.coach, input.isPitcher, input.slot)
}

/**
 * 원본 차례: 모드 가지 → (0xb58e6 체력% 피로 — 부르는 쪽이 체력%를 들고 `pitcherGameStatOf` 로 먹인다) → 팀 능력치 →
 * (0xb5a16~0xb5a72 스킬 14 — `gameAbilityOf` 가 `fightingSpirit` 으로 먹인다) → 코치
 */
export function gameAbilityStepsOf(input: GameAbilityInput): GameAbilitySteps {
  return { beforeFatigue: seasonAdjustedBaseOf(input), teamBonus: teamBonusOf(input), coachBonus: seasonCoachBonusOf(input) }
}

/** 스킬 14 의 칸 — 체력(3)은 빠진다 (b5a48 `cmp r7, #3 ; beq`) */
const FIGHTING_SPIRIT_EXCLUDED_SLOT = PITCHER_SLOT.체력

/**
 * 스킬 14 갈래 (0xb5a28~0xb5a72): 투수(0xb6279) ∧ 장착 14(0xb62b5) ∧ 칸 ≠ 3 ∧ 전역 경기 상태 +0x6b > 4 ∧ 0xb6a4d(상태) == 0xb6be9(상태, 팀)
 * 이면 `v += v / 10` (0xca7b5 — 0 쪽 버림). 장착 · 경기 상태는 `fightingSpirit` 이 든다.
 */
export function fightingSpiritValueOf(value: number, input: Pick<GameAbilityInput, 'isPitcher' | 'slot' | 'fightingSpirit'>): number {
  return isFightingSpiritSlot(input) ? withFightingSpirit(value) : value
}

/** 스킬 14 갈래가 이 칸에 서는가 — `fightingSpirit`(장착 ∧ 경기 상태) ∧ 투수 레코드 ∧ 칸 ≠ 3 */
export function isFightingSpiritSlot(input: Pick<GameAbilityInput, 'isPitcher' | 'slot' | 'fightingSpirit'>): boolean {
  return input.fightingSpirit === true && input.isPitcher && input.slot !== FIGHTING_SPIRIT_EXCLUDED_SLOT
}
