import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { abilityAfterFatigue, withFightingSpirit } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningDefense } from '@/entities/game/model/simulateHalfInning/types/defense'

/**
 * 마운드 투수가 이 공에 보이는 능력 — 체력%(0xaebb0)와 그 체력%로 부른 제구·구속(`tired`, 0xb58e6).
 * 0xc11f0·0xc1818 이 0xb570c 를 체력%로 부르는 세 자리(구위 등급 · 스트라이크존 · 0xab214 투수 쪽)가 `tired` 를 본다.
 */
export function facingPitcherOf(
  defense: HalfInningDefense,
  pitcherSlot: number,
  staminaPercent: number,
  /** 이 반 이닝에 지금까지 들어온 점수 — 스킬 14 의 경기 상태(`fightingSpiritAt`)가 본다. 수비를 지금 판으로 지었으면 0 */
  runsThisHalf = 0,
): QuickAtBatPitcher {
  const fightingSpirit = defense.fightingSpiritAt?.(runsThisHalf) === true
  const fresh = defense.pitcherAt(pitcherSlot, fightingSpirit)
  const tired =
    defense.tiredPitcherAt?.(pitcherSlot, staminaPercent, fightingSpirit) ??
    tiredWithoutBonusOf(fightingSpirit ? defense.pitcherAt(pitcherSlot, false) : fresh, staminaPercent, fightingSpirit)
  return { ...fresh, stamina: staminaPercent, tired }
}

/** 투수 스킬 번호 30 = 장착 비트 14 투지 (`skillIdsOfBits` — 투수 번호 = 비트 + 16) */
const FIGHTING_SPIRIT_PITCHER_SKILL_ID = 30

/**
 * 정액(팀 능력치 · 코치)이 없는 모드(3 · 4 · 5)의 간이 투수에 **스킬 14 갈래**를 얹는다 — 0xb570c b5a16~b5a72 는 칸 ≠ 3 이라
 * 제구 · 구속 둘 다 `v += v/10` (`withFightingSpirit`). 장착은 `skillIds` 의 30(비트 14)으로 본다. 정액이 있는 모드는 부르는 쪽이
 * 팀 정액 뒤 · 코치 앞에 직접 넣는다(`leagueDay` 의 `cpuPitcherGameAbilityOf`)
 */
export function withQuickFightingSpirit(pitcher: QuickAtBatPitcher, fightingSpirit: boolean | undefined): QuickAtBatPitcher {
  if (fightingSpirit !== true || !pitcher.skillIds.includes(FIGHTING_SPIRIT_PITCHER_SKILL_ID)) return pitcher
  return { ...pitcher, control: withFightingSpirit(pitcher.control), velocity: withFightingSpirit(pitcher.velocity) }
}

/** `tiredPitcherAt` 이 없는 길 — 정액 없는 밑값(`pitcherAt(칸, 거짓)`)에 피로 0xb58e6 → 스킬 14 차례로 */
function tiredWithoutBonusOf(
  raw: QuickAtBatPitcher,
  staminaPercent: number,
  fightingSpirit: boolean,
): { readonly control: number; readonly velocity: number } {
  const fatigued = {
    ...raw,
    control: abilityAfterFatigue(raw.control, staminaPercent),
    velocity: abilityAfterFatigue(raw.velocity, staminaPercent),
  }
  const raised = withQuickFightingSpirit(fatigued, fightingSpirit)
  return { control: raised.control, velocity: raised.velocity }
}
