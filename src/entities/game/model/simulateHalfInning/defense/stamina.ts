import { consumeStamina, pitchStaminaCostOf, staminaCapacityOf } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning/types/defense'

/**
 * 간이 엔진은 구질을 고르지 않는다 — 0xc26c8 이 0xa5e14 에 **늘 1(FASTBALL)** 을 넘긴다
 * (P1 3-1 확정). 그래서 투구 하나의 기본 소모는 늘 9 다.
 */
const QUICK_PITCH_TYPE = 1
/** 타자 스킬 22 압도 — 0xa5e14 소모 ×2 (`0xb62b4(지금 타자, 22)`) */
export const INTIMIDATE_SKILL_ID = 22

/**
 * 투구 하나마다 깎이는 스태미나 (0xa5e14 → 0xaeb08). 간이 엔진은 구질을 안 골라 늘 직구(소모 9)다.
 *
 * 용량 X = 사기보정(체력 실효 능력치) + (첫 투수 ? 200 : 0) + 250 (0x66e44) — 구원으로 올라온
 * 투수는 +200 이 없어 같은 체력이면 더 빨리 지친다.
 *
 * 반 이닝 엔진은 `pitchCount = 1` 로 **공마다** 부른다 — 0xc262c 가 공을 던지기 앞에 0xa5e14 를 부르므로(c26c8)
 * 그 공이 보는 체력%는 자기 소모까지 먹은 값이다. 여러 개를 한꺼번에 깎는 것은 `features/play-team-game` 처럼
 * 타석이 끝난 뒤 몰아 깎는 쪽(근사)이 쓰는 길이다.
 */
export function drainQuickPitcher(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  pitchCount: number,
  /**
   * 공격 팀 지금 타자의 압도 22 — 0xa5e14 a5efc~a5f12 가 `0xb62b4(0xae89c(팀[st[9]]), 22)` 로 지금 타자 레코드 +0x14 를 본다
   * (모드 갈래 없음 · 간이 엔진도 같은 함수). 참이면 ×2. 안 넘기면 거짓
   */
  batterIntimidates = false,
): number {
  let stamina = mound.stamina
  for (let pitch = 0; pitch < pitchCount; pitch += 1) {
    stamina = drainPitcherForPitch(defense, { ...mound, stamina, pitches: mound.pitches + pitch }, QUICK_PITCH_TYPE, batterIntimidates)
  }
  return stamina
}

/**
 * 용량 0x66e44 가 지금 읽는 팀 레코드 +2 — 첫 투수가 아직 공을 안 던졌으면(`pitches` 0 · 등판한 투수 없음) 앞 값
 * `staleMorale`, 아니면 `morale`(없으면 100). `HalfInningDefense.staleMorale` 참고
 */
export function drainMoraleOf(defense: HalfInningDefense, mound: HalfInningMound): number {
  if (defense.staleMorale !== undefined && mound.pitches === 0 && mound.usedSlots.length === 0) return defense.staleMorale
  return defense.morale ?? 100
}

/** 0xa5f30 `movs r1, #0x12` — 투수 스킬 18 비겁자 */
const COWARD_SKILL_BIT = 18
/** 0xa5f52 `movs r1, #0xa` — 투수 스킬 10 끈기 */
const ENDURE_SKILL_BIT = 10

/**
 * **공 하나**의 스태미나 소모 (0xa5e14 의 0xa5f0e~ → 0xaeb08) — 구질을 아는 사람 타석용.
 * c = 0x66ef0(구질), 타자 스킬 22 압도(`0xb62b4(현재 타자, 22)`, a5f12) 또는 투수 비트 18 비겁자(`0xb62b4(0xae83c(수비 팀), 18)`,
 * a5f32)면 ×2, 투수 비트 10 끈기(a5f56)면 −1 — 투수 비트는 그 레코드 +0x14 (`defense.skillBitsAt`, 안 넘기면 둘 다 거짓).
 * 붙박이 투수 120 줄에서 비트 18 은 아무도 없고 비트 10 은 열두 줄이다(XlsPITCHER_DATA 행 바이트 0x14~0x17).
 * 용량 X 는 `drainQuickPitcher` 와 같다 (사기·첫 투수 보너스, 0x66e44).
 */
export function drainPitcherForPitch(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  pitchTypeNumber: number,
  batterIntimidates: boolean,
): number {
  const capacity = staminaCapacityOf(defense.staminaAbilityAt(mound.pitcherSlot), drainMoraleOf(defense, mound), mound.usedSlots.length === 0)
  const skillBits = defense.skillBitsAt?.(mound.pitcherSlot) ?? 0
  const cost = pitchStaminaCostOf({
    pitchTypeNumber,
    batterIntimidates,
    pitcherIsCoward: ((skillBits >>> COWARD_SKILL_BIT) & 1) === 1,
    pitcherEndures: ((skillBits >>> ENDURE_SKILL_BIT) & 1) === 1,
  })
  return consumeStamina(mound.stamina, cost, capacity)
}
