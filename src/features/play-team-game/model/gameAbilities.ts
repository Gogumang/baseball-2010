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
 * 0xb5a74  코치 보너스               (모드 2)
 * 0xb5b06  0..999 로 자름
 * ```
 */

/** 투수 칸 — 레코드 +0xc 부터 s16 네 칸 */
export const PITCHER_SLOT = { 제구: 0, 구속: 1, 변화: 2, 체력: 3 } as const
/** 타자 칸 */
export const BATTER_SLOT = { 히트: 0, 파워: 1, 수비: 2, 주루: 3 } as const
/** 팀 능력치 칸 — 팀 레코드 +4·+6·+8·+0xa (XlsTEAM_DATA 열 2~5) */
export const TEAM_ABILITY_SLOT = { 투구: 0, 타격: 1, 집중: 2, 근성: 3 } as const

/** 원본 게임 모드 (0x1552d10) 중 팀 경기인 것 */
export const TEAM_GAME_MODE = { 일반: 1, 시즌: 2, 대전: 8, 대전이벤트: 9 } as const

/**
 * 팀 능력치를 선수에게 먹이는 모드 — 비트마스크 **0x306 = {1, 2, 8, 9}** (0xb593a).
 * ⚠️ H-1 은 "모드 2·8·9 에서만" 이라고 적었지만 코드는 모드 1(일반)도 넣는다. **코드 쪽이 기준**이다.
 */
const TEAM_ABILITY_MODE_MASK = 0x306

export function isTeamAbilityMode(mode: number): boolean {
  if (mode < 0 || mode > 31) return false
  return ((1 << mode) & TEAM_ABILITY_MODE_MASK) !== 0
}

/** 능력치 상한 — 0xb5b06 이 0..999 로 자른다 */
export const ABILITY_LIMIT = 999

/**
 * 팀 능력치 T 가 선수 능력치에 더하는 값 (0xb5a04, 확정):
 * `T ≠ 0 이면 v += (17·T − 5100) / 100` = 0.17 × (T − 300), **0 쪽 버림**.
 * 예: 330 → +5 · 400 → +17 · 500 → +34 · 666(외인구단) → +62. T < 300 이면 줄어든다.
 */
export function teamAbilityBonusOf(teamAbility: number): number {
  if (teamAbility === 0) return 0
  return Math.trunc((17 * teamAbility - 5100) / 100)
}

/** 선수 칸 → 그 칸을 밀어 주는 팀 능력치 칸 (0xb5942~0xb59fe) */
export function teamAbilitySlotFor(isPitcher: boolean, slot: number): number {
  if (isPitcher) {
    if (slot === PITCHER_SLOT.구속 || slot === PITCHER_SLOT.변화) return TEAM_ABILITY_SLOT.투구
    if (slot === PITCHER_SLOT.제구) return TEAM_ABILITY_SLOT.집중
    return TEAM_ABILITY_SLOT.근성
  }
  if (slot <= BATTER_SLOT.파워) return TEAM_ABILITY_SLOT.타격
  if (slot === BATTER_SLOT.수비) return TEAM_ABILITY_SLOT.집중
  return TEAM_ABILITY_SLOT.근성
}

/** 팀 질병 — s8 [시즌+6] > 0 이면 `v += (−30·v)/100` (0xb5824) */
export function illnessPenaltyOf(value: number): number {
  return Math.trunc((-30 * value) / 100)
}

/**
 * 팀 사기 **정액** 감소 (0xb58ac~0xb58e4).
 * `>50 없음 · 31~50 −50 · 11~30 −100 · ≤10 −200`, 0 아래로는 0.
 * ⚠️ 나만의리그(나리)의 사기 보정은 **비율**(−10%/−20%/−50%)이라 값이 다르다 — 섞어 쓰면 안 된다.
 */
export function moraleFlatPenaltyOf(morale: number): number {
  if (morale > 50) return 0
  if (morale > 30) return 50
  if (morale > 10) return 100
  return 200
}

/** 스킬 21 "모든 포지션 수비 가능" — 있으면 보직 벌점이 면제된다 (0xb62b4(p, 0x15)) */
export const ALL_POSITION_SKILL_ID = 21

/** 타자 한 명의 보직·자리 (보직 불일치 판정 입력) */
export interface FieldingAssignment {
  /** 레코드 +0x1c & 0xf — 수비 자리 코드. 0·1·10 은 벌점 면제 */
  readonly fieldPosition: number
  /** 레코드 +0xb & 3 (0xb6704) — 0 내야 · 1 외야 · 2 이상(지명 계열, 유력) */
  readonly positionBar: number
  readonly hasAllPositionSkill?: boolean
  /** 마선수(마타자·마투수)인가 — 0xb6278 이 "투수" 쪽으로 보내 벌점을 안 받는다 */
  readonly isAce?: boolean
}

/**
 * 보직 불일치 **−20%** (0xb5844~0xb58a4) — **시즌모드 내 팀 타자의 수비 칸에만** 붙는다.
 *
 * ⚠️ 설명서는 일반·대전에도 벌점이 있다고 하지만 **코드에는 모드 2 분기뿐이다** (J-3 미해결).
 *    원본대로 시즌에만 붙인다.
 */
export function hasPositionMismatch(assignment: FieldingAssignment): boolean {
  if (assignment.isAce === true) return false
  if (assignment.hasAllPositionSkill === true) return false
  const position = assignment.fieldPosition & 0xf
  if (position <= 1 || position === 10) return false
  const bar = assignment.positionBar & 3
  if (bar === 0 && position >= 2 && position <= 6) return false
  if (bar === 1 && position >= 7 && position <= 9) return false
  return true
}

/** 보직 벌점 — `v += v/(−5)` (0xb5898). 정수 나눗셈은 0 쪽 버림이다 */
export function positionMismatchPenaltyOf(value: number): number {
  return Math.trunc(value / -5)
}

/**
 * 코치 보너스 표 `0xd884c` s8 (0xb5a74~0xb5b04, **모드 2 만**).
 * 코치 = s8 [시즌+0x185] (−1 = 없음, 0..9). **정액** 가산이다.
 */
export const COACH_BONUS: readonly number[] = [8, 9, 10, 6, 4, 8, 5, 10, 6, 7]

/** 코치가 없음을 뜻하는 값 (s8 −1) */
export const NO_COACH = -1

/** 점프표 0xd8858 — 코치 0~4 는 투수 칸, 5~9 는 타자 칸에만 붙는다 */
function coachAffects(coach: number, isPitcher: boolean, slot: number): boolean {
  switch (coach) {
    case 0: // 투수 변화
      return isPitcher && slot === PITCHER_SLOT.변화
    case 1: // 투수 구속
      return isPitcher && slot === PITCHER_SLOT.구속
    case 2: // 투수 제구
      return isPitcher && slot === PITCHER_SLOT.제구
    case 3: // 투수 제구·변화
      return isPitcher && (slot === PITCHER_SLOT.제구 || slot === PITCHER_SLOT.변화)
    case 4: // 투수 전부(체력 포함)
      return isPitcher
    case 5: // 타자 히트
      return !isPitcher && slot === BATTER_SLOT.히트
    case 6: // 타자 수비·주루
      return !isPitcher && (slot === BATTER_SLOT.수비 || slot === BATTER_SLOT.주루)
    case 7: // 타자 파워
      return !isPitcher && slot === BATTER_SLOT.파워
    case 8: // 타자 히트·주루
      return !isPitcher && (slot === BATTER_SLOT.히트 || slot === BATTER_SLOT.주루)
    case 9: // 타자 히트·파워
      return !isPitcher && slot <= BATTER_SLOT.파워
    default:
      return false
  }
}

export function coachBonusOf(coach: number, isPitcher: boolean, slot: number): number {
  if (!coachAffects(coach, isPitcher, slot)) return 0
  return COACH_BONUS[coach] ?? 0
}

/** 시즌모드가 함께 넘기는 팀 상태 (시즌 레코드·팀 레코드에서 온다) */
export interface SeasonTeamCondition {
  /** SR+5 팀 질병 종류 — 0 이 아니면 −30% */
  readonly illness: number
  /** 팀 레코드 +2 팀 사기 0~100 */
  readonly morale: number
  /**
   * SR+0x185 코치 (−1 없음, 0~9).
   * ⚠️ **유력**: 원본 코치 분기에는 팀 검사가 없어 **상대 팀 선수에게도 붙는 것으로 보인다** (J 4-2).
   *    원본 동작이므로 그대로 옮긴다 — `applyToEveryTeam` 참고.
   */
  readonly coach: number
}

export interface GameAbilityInput {
  /** 원본 게임 모드 (1 일반 · 2 시즌 · 8·9 대전) */
  readonly mode: number
  /** 선수 레코드에 적힌 밑값 (0~999) */
  readonly base: number
  readonly isPitcher: boolean
  /** 칸 0~3 */
  readonly slot: number
  /** 이 선수가 **시즌모드 내 팀** 선수인가 (0xb5804 `[시즌+1] == 팀레코드+0`) */
  readonly isMyTeam: boolean
  /** 팀 능력치 네 칸 [투구, 타격, 집중, 근성]. 없으면 팀 보정 플래그가 꺼진 것으로 본다 */
  readonly teamAbilities?: readonly number[]
  /** 시즌 팀 상태. 모드 2 가 아니면 무시한다 */
  readonly season?: SeasonTeamCondition
  /** 타자 수비 칸(보직 불일치) 판정 입력. 없으면 벌점 없음 */
  readonly assignment?: FieldingAssignment
}

/**
 * 경기용 능력치 한 칸을 계산한다.
 *
 * 나만의리그 쪽 보정(장비·스킬·부상)은 이 함수가 건드리지 않는다 — 부르는 쪽이 이미 먹인
 * 값을 `base` 로 넘긴다. 팀 경기에는 육성 선수가 (영입하지 않는 한) 없어서 지금은 밑값 그대로다.
 */
export function gameAbilityOf(input: GameAbilityInput): number {
  const { mode, isPitcher, slot } = input
  let value = input.base
  const isSeason = mode === TEAM_GAME_MODE.시즌
  const season = input.season

  // ── 모드 2 & 내 팀 선수만 (0xb581a 가 세 보정을 함께 감싼다) ──
  if (isSeason && input.isMyTeam && season !== undefined) {
    if (season.illness > 0) value += illnessPenaltyOf(value)
    if (
      !isPitcher &&
      slot === BATTER_SLOT.수비 &&
      input.assignment !== undefined &&
      hasPositionMismatch(input.assignment)
    ) {
      value += positionMismatchPenaltyOf(value)
    }
    value -= moraleFlatPenaltyOf(season.morale)
    if (value < 0) value = 0
  }

  // ── 팀 능력치 (모드 1·2·8·9) ──
  const teamAbilities = input.teamAbilities
  if (teamAbilities !== undefined && isTeamAbilityMode(mode)) {
    value += teamAbilityBonusOf(teamAbilities[teamAbilitySlotFor(isPitcher, slot)] ?? 0)
  }

  // ── 코치 보너스 (모드 2). 팀 검사가 없다 — 유력 ──
  if (isSeason && season !== undefined && season.coach >= 0) {
    value += coachBonusOf(season.coach, isPitcher, slot)
  }

  if (value < 0) return 0
  return value > ABILITY_LIMIT ? ABILITY_LIMIT : value
}

/**
 * 네 칸을 한꺼번에 — 로스터 레코드의 `ability` 순서(히트·파워·수비·주루 / 제구·구속·변화·체력) 그대로.
 */
export function gameAbilitiesOf(
  base: readonly number[],
  input: Omit<GameAbilityInput, 'base' | 'slot'>,
): [number, number, number, number] {
  const at = (slot: number) => gameAbilityOf({ ...input, base: base[slot] ?? 0, slot })
  return [at(0), at(1), at(2), at(3)]
}
