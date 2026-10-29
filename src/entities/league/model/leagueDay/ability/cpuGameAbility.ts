import { TEAMS } from '@/shared/config/original/teams'
import { isBugFixed } from '@/shared/config/bugfixes'
import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'

/** 팀 능력치를 먹이는 모드 비트 0x306 = {1, 2, 8, 9} (0xb593a) */
const TEAM_ABILITY_MODE_MASK = 0x306
/** 코치 표 `0xd884c` — 투수 칸에 붙는 것은 0~4 번 (0xb5a74 점프표) */
const COACH_BONUS: readonly number[] = [8, 9, 10, 6, 4, 8, 5, 10, 6, 7]
/** 코치 번호 → 붙는 투수 칸 (제구 0 · 구속 1 · 변화 2 · 체력 3) */
const COACH_PITCHER_SLOTS: Readonly<Record<number, readonly number[]>> = {
  0: [2],
  1: [1],
  2: [0],
  3: [0, 2],
  4: [0, 1, 2, 3],
}
/** 투수 칸 → 팀 능력치 칸 — 구속·변화 → 투구(0), 제구 → 집중(2), 체력 → 근성(3) (0xb592c) */
const TEAM_ABILITY_SLOT_OF_PITCHER = [2, 0, 0, 3] as const
const XLS_TEAM_ABILITY_OFFSET = 2
/** 스킬 14 갈래에서 빠지는 칸 — 체력 3 (b5a48 `cmp r7, #3`) */
const FIGHTING_SPIRIT_EXCLUDED_SLOT = 3
/** 타자 칸 → 팀 능력치 칸 — 히트·파워 → 타격(1), 수비 → 집중(2), 주루 → 근성(3) (0xb592c) */
const TEAM_ABILITY_SLOT_OF_BATTER = [1, 1, 2, 3] as const
/** 코치 번호 → 붙는 타자 칸 (히트 0 · 파워 1 · 수비 2 · 주루 3) — 점프표 0xd8858 의 5~9 */
const COACH_BATTER_SLOTS: Readonly<Record<number, readonly number[]>> = {
  5: [0],
  6: [2, 3],
  7: [1],
  8: [0, 3],
  9: [0, 1],
}
/** 코치 0xb5a74 가 붙는 모드 — 시즌모드(2)만 */
const COACH_MODE = 2
/** 경기용 능력치 맨 끝 자르기 0xb5b06 */
const MAXIMUM_GAME_ABILITY = 999

/**
 * CPU 투수 한 칸의 경기용 능력치 — `0xb570c(팀, k, P, 1, 90, 1)` 차례: 0xb6414 실효값(`base` — 부르는 쪽이 장비 니블 ·
 * 장착 스킬을 먹여 넘긴다, `recordAbilityOf`) → 피로 0xb58e6
 * (체력 인자 90 이면 없음) → 팀 능력치 정액 0xb592c → 코치 0xb5a74 → 0..999 자르기 0xb5b06.
 * 팀 정액·코치 식은 `features/play-team-game/model/gameAbilities`(J-4 확정)와 같다 — entities 가 features 를 못 불러 옮겨 적었다.
 */
export function cpuPitcherGameAbilityOf(
  base: number,
  slot: number,
  teamId: number,
  context: LeagueAbilityContext | undefined,
  /**
   * 스킬 14(투지) 갈래가 이 투수에게 서는가 — 장착 비트 14 ∧ 전역 경기 상태(`isLiveGameFightingSpiritSituation`). 팀 정액 뒤 · 코치 앞에
   * 칸 ≠ 3 이면 `v += v/10` (b5a16~b5a72). 안 넘기면 거짓
   */
  fightingSpirit = false,
): number {
  let value = base + teamAbilityBonusOf(teamId, context, TEAM_ABILITY_SLOT_OF_PITCHER[slot] ?? 0)
  if (fightingSpirit && slot !== FIGHTING_SPIRIT_EXCLUDED_SLOT) value = withFightingSpirit(value)
  value += coachBonusOf(teamId, context, slot, COACH_PITCHER_SLOTS)
  return clampGameAbility(value)
}

/**
 * CPU 타자 한 칸의 경기용 능력치 — `cpuPitcherGameAbilityOf` 와 같은 `0xb570c(팀, k, B, 1, 90, 1)` 차례의 타자 쪽.
 * 간이 타석의 스윙 0xab214 가 타자 능력을 이 인자로 읽는다(`0xb570d(…, 1, 0x5a, 1)`, quickAtBat 머리말).
 */
export function cpuBatterGameAbilityOf(base: number, slot: number, teamId: number, context: LeagueAbilityContext | undefined): number {
  const value = base + teamAbilityBonusOf(teamId, context, TEAM_ABILITY_SLOT_OF_BATTER[slot] ?? 3)
  return clampGameAbility(value + coachBonusOf(teamId, context, slot, COACH_BATTER_SLOTS))
}

/** 간이 타석 타자를 경기용 능력치(체력 인자 90)로 — 히트·파워·주루 (`cpuBatterGameAbilityOf`) */
export function gameQuickBatterOf(batter: QuickAtBatBatter, teamId: number, context: LeagueAbilityContext | undefined): QuickAtBatBatter {
  return {
    ...batter,
    hit: cpuBatterGameAbilityOf(batter.hit, 0, teamId, context),
    power: cpuBatterGameAbilityOf(batter.power, 1, teamId, context),
    run: cpuBatterGameAbilityOf(batter.run, 3, teamId, context),
  }
}

/** 팀 능력치 정액 0xb592c — 모드 비트 0x306 일 때만 `(17·팀능력 − 5100) / 100` (팀 능력 0 이면 없음) */
function teamAbilityBonusOf(teamId: number, context: LeagueAbilityContext | undefined, teamAbilitySlot: number): number {
  if (!usesTeamAbility(context?.mode ?? -1)) return 0
  const teamAbility = teamAbilitiesOf(teamId, context)?.[teamAbilitySlot] ?? 0
  if (teamAbility === 0) return 0
  return Math.trunc((17 * teamAbility - 5100) / 100)
}

/** 팀 능력치 네 칸 [투구, 타격, 집중, 근성] — 시즌 기록, 없으면 XlsTEAM_DATA 그대로 */
function teamAbilitiesOf(teamId: number, context: LeagueAbilityContext | undefined): readonly number[] | undefined {
  return context?.teamAbilities?.[teamId] ?? TEAMS[teamId]?.values.slice(XLS_TEAM_ABILITY_OFFSET)
}

/** 0xb593a — 모드 0~9 가운데 비트 0x306 = {1, 2, 8, 9} */
function usesTeamAbility(mode: number): boolean {
  return mode >= 0 && mode <= 9 && ((1 << mode) & TEAM_ABILITY_MODE_MASK) !== 0
}

/** 코치 정액 0xb5a74 — 붙는 코치가 이 칸을 볼 때만 */
function coachBonusOf(
  teamId: number,
  context: LeagueAbilityContext | undefined,
  slot: number,
  coachSlots: Readonly<Record<number, readonly number[]>>,
): number {
  const coach = activeCoachOf(teamId, context)
  if (coach === undefined) return 0
  if (!(coachSlots[coach]?.includes(slot) ?? false)) return 0
  return COACH_BONUS[coach] ?? 0
}

/** 이 팀 선수에게 붙는 코치 번호 — 모드 2 · 코치가 있고 · 이 팀에 붙을 때(B-21)만 */
function activeCoachOf(teamId: number, context: LeagueAbilityContext | undefined): number | undefined {
  const coach = context?.coach ?? -1
  if (context?.mode !== COACH_MODE || coach < 0) return undefined
  return coachAppliesTo(teamId, context) ? coach : undefined
}

/** 코치 정액이 이 팀 선수에게 붙는가 — 원본(B-21)은 팀을 안 본다, 고친 길은 `coachTeamId` 팀만 */
function coachAppliesTo(teamId: number, context: LeagueAbilityContext | undefined): boolean {
  return !isBugFixed('B-21') || context?.coachTeamId === teamId
}

function clampGameAbility(value: number): number {
  return Math.min(MAXIMUM_GAME_ABILITY, Math.max(0, value))
}
