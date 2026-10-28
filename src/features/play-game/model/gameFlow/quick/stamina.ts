import { type HalfInningDefense, type HalfInningMound, drainQuickPitcher, facingPitcherOf } from '@/entities/game/model/simulateHalfInning'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'

/** 타자 스킬 22 압도 — 간이 타석 0xa5e14 소모 ×2 */
const QUICK_INTIMIDATE_SKILL_ID = 22

/**
 * 간이 타석의 공 하나를 던지기 앞 — `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 경로 굴림
 * 차례라, 공 하나가 보는 체력%(0xaebb0)는 그 공의 소모까지 먹은 값이다 (반 이닝 엔진 `beforePitch` 와 같다, d9d376c).
 * 갈고리는 난수를 쓰지 않는다.
 */
export function perPitchDrainOf(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  /** 이 타석 타자 — 0xa5e14 가 `0xb62b4(지금 타자, 22)` 압도면 소모 ×2 */
  batter: Pick<QuickAtBatBatter, 'skillIds'>,
): { readonly beforePitch: () => QuickAtBatPitcher; readonly stamina: () => number } {
  let stamina = mound.stamina
  // 투구 수는 타석이 끝나야 더해지므로 이 타석에서 이미 던진 공을 얹는다 (`drainMoraleOf` 의 첫 공 판정)
  let thrown = 0
  const batterIntimidates = batter.skillIds.includes(QUICK_INTIMIDATE_SKILL_ID)
  return {
    beforePitch: () => {
      stamina = drainQuickPitcher(defense, { ...mound, stamina, pitches: mound.pitches + thrown }, 1, batterIntimidates)
      thrown += 1
      // 0xc11f0 · 0xc1818 은 체력%로 부른 제구 · 구속(피로 0xb58e6)을 세 자리에서 본다 — 반 이닝 엔진과 같은 값
      return facingPitcherOf(defense, mound.pitcherSlot, staminaPercentOf(stamina))
    },
    stamina: () => stamina,
  }
}

/** 칸 하나의 레코드 스태미나를 바꾼 표 */
export function withStaminaAt(table: readonly number[], slot: number, stamina: number): readonly number[] {
  return table.map((value, index) => (index === slot ? stamina : value))
}

/** 반 이닝 안의 교체마다 내려간 투수 값을 표에 되적는다 */
export function withOutgoingStaminas(
  table: readonly number[],
  changes: readonly { readonly outgoingPitcherSlot: number; readonly outgoingStamina: number }[],
): readonly number[] {
  return changes.reduce((current, change) => withStaminaAt(current, change.outgoingPitcherSlot, change.outgoingStamina), table)
}

/** 경기 끝 칸별 레코드 스태미나 — 표에 지금 마운드 값을 얹는다 */
export function finalStaminasOf(table: readonly number[], mound: HalfInningMound): readonly number[] {
  return withStaminaAt(table, mound.pitcherSlot, mound.stamina)
}
