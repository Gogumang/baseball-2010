import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import type { HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { chargePitcherLine, type GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { startsToday } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 칸별 레코드 스태미나 표 (붙박이 표 칸 0~7) — 빠진 칸은 10000 */
export function staminaTableOf(given: readonly number[] | undefined): readonly number[] {
  return Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => given?.[slot] ?? FULL_STAMINA)
}

/** CPU 투수 줄 하나에 더한다 — 내 자리(표 밖, `MY_PITCHER_SLOT`)는 커리어가 따로 세므로 건너뛴다 */
export function chargeCpuPitcherLine(
  lines: readonly GamePitcherLine[],
  teamId: number,
  pitcherSlot: number,
  delta: Parameters<typeof chargePitcherLine>[3],
): readonly GamePitcherLine[] {
  if (pitcherSlot < 0 || pitcherSlot >= PITCHERS_PER_TEAM) return lines
  return chargePitcherLine(lines, teamId, pitcherSlot, delta)
}

/** 내려간 투수의 +0x2c 를 표에 남긴다 — 내 자리(표 밖)는 `stamina` 가 들므로 건너뛴다 */
export function withOutgoingStamina(table: readonly number[], outgoing: HalfInningMound): readonly number[] {
  if (outgoing.pitcherSlot < 0 || outgoing.pitcherSlot >= PITCHERS_PER_TEAM) return table
  return table.map((value, slot) => (slot === outgoing.pitcherSlot ? outgoing.stamina : value))
}

/** 내 마운드 스태미나 재료 — 공마다 깎는 셈(`drainStamina`)과 같은 칸 (소개 판 체력 막대 0x44ea0~) */
export function myMoundStaminaOf(progress: PitcherGameProgress): {
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  return {
    staminaAbility: progress.options.staminaAbility,
    teamMorale: progress.options.teamMorale,
    isFirstPitcher: startsToday(progress.options),
    stamina: progress.stamina,
  }
}
