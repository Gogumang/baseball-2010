/**
 * 투수 스태미나 (binary.mod 0xa5e14 투구 한 개 · 0x66ef0 기본 소모 · 0xaeb08 소모 적용 ·
 * 0x66e44 용량 · 0xb60e0 경기 사이 회복 · 0x66ed0 회복량 · 0xb58e6 체력%에 따른 능력치 감소 —
 * P1 3절 전체, R7 3절).
 *
 * 값은 투수 레코드(0x30 바이트)의 **+0x2c s16, 0~10000 (= 0.00~100.00%)** 이고
 * 경기용 객체가 아니라 **시즌 내내 이어지는 레코드 값**이다. 시즌 시작 0xb6cc4 가 10000 으로 둔다.
 */

/** +0x2c 의 최댓값. 시즌 시작·십전대보탕이 이 값을 넣는다 */
export const FULL_STAMINA = 10_000

/** 체력% = trunc(+0x2c / 100) (0xaebb0). 홈런더비(state[1]==7)는 늘 100 이다 */
export function staminaPercentOf(stamina: number): number {
  return Math.trunc(stamina / 100)
}

/** 홈런더비 모드 번호 — 이 모드에서는 0xaebb0 이 늘 100 을 돌려준다 */
export const HOME_RUN_DERBY_MODE = 7

/**
 * 구질별 기본 소모 (0x66ef0, 표 0xd2624 = [9, 11, 12, 13] + 점프표 0xd2634 22칸).
 *   1 FASTBALL 9 · 2~9 기본 변화구 11 · 10~17 상위 변화구 12 · 18~21 히든 13 · 22 마구 9 · 그 밖 9
 */
export function basePitchStaminaCostOf(pitchTypeNumber: number): number {
  if (pitchTypeNumber >= 2 && pitchTypeNumber <= 9) return 11
  if (pitchTypeNumber >= 10 && pitchTypeNumber <= 17) return 12
  if (pitchTypeNumber >= 18 && pitchTypeNumber <= 21) return 13
  return 9
}

export interface PitchStaminaCostInput {
  /** 구질 번호 1~22 */
  readonly pitchTypeNumber: number
  /** 지금 타석에 선 타자가 **타자 스킬 22**("타석에 서있는 것만으로도 …") 를 가졌는가 */
  readonly batterIntimidates: boolean
  /** 투수가 **투수 스킬 18 비겁자**("투구 스태미나 소모량 x2") 를 가졌는가 */
  readonly pitcherIsCoward: boolean
  /** 투수가 **투수 스킬 10 끈기**("지치지 않는 체력", 효과 66 "소모량 −1") 를 가졌는가 */
  readonly pitcherEndures: boolean
}

/**
 * 투구 한 개의 소모 c (0xa5e14 의 0xa5f0e~0xa5f60).
 * **순서가 ×2 다음 −1** 이다 → 비겁자 + 끈기면 2c−1.
 *
 * 게이지 결과(t)는 이 식에 들어오지 않는다 — 설명서 StrHOWTO[3] 의 "게이지에 따라 소모량이 달라진다" 는
 * 코드와 다르다 (P1 3-1 확정).
 */
export function pitchStaminaCostOf(input: PitchStaminaCostInput): number {
  let cost = basePitchStaminaCostOf(input.pitchTypeNumber)
  if (input.batterIntimidates || input.pitcherIsCoward) cost *= 2
  if (input.pitcherEndures) cost -= 1
  return cost
}

/**
 * 팀 사기가 체력 실효 능력치에 주는 보정 (0x66e44 안).
 * 원본은 구간마다 다른 나눗셈을 쓰고 **전부 0 방향 자름**이다 — 식 모양 그대로 옮긴다.
 */
function moraleAdjustedStamina(staminaAbility: number, morale: number): number {
  if (morale > 90) return staminaAbility + Math.trunc(staminaAbility / 20)
  if (morale >= 71) return staminaAbility
  if (morale >= 51) return staminaAbility + Math.trunc(staminaAbility / -10)
  if (morale >= 31) return staminaAbility + Math.trunc(staminaAbility / -5)
  if (morale >= 11) return staminaAbility + Math.trunc((-30 * staminaAbility) / 100)
  return staminaAbility - Math.trunc(staminaAbility / 2)
}

/** 첫 투수(선발)에게만 붙는 용량 보너스 (0x66e44) */
export const STARTER_CAPACITY_BONUS = 200
/** 모든 투수에게 붙는 바닥 용량 (0x66e44) */
export const BASE_CAPACITY = 250

/**
 * 스태미나 용량 X (0x66e44(V, P, starter)).
 *   X = 사기보정(체력 실효 능력치) + (첫 투수 ? 200 : 0) + 250
 *
 * `staminaAbility` 는 `0xb6415(P, 3, 1)` = **장비·스킬까지 반영한 체력 실효 능력치**(칸 3)다.
 * `isFirstPitcher` 는 0xaeb08 의 `team+0x26 − team+0x33 == 1`, 곧 "아직 교체가 없다"(유력).
 * 구원으로 올라온 투수는 +200 이 없어 같은 체력이면 더 빨리 지친다.
 */
export function staminaCapacityOf(staminaAbility: number, teamMorale: number, isFirstPitcher: boolean): number {
  const adjusted = moraleAdjustedStamina(staminaAbility, teamMorale)
  return adjusted + (isFirstPitcher ? STARTER_CAPACITY_BONUS : 0) + BASE_CAPACITY
}

/**
 * 소모 적용 (0xaeb08).
 * ```
 * if s > 0:  s' = s + trunc((X − c)·10000 / X) − 10000   (음수면 0)
 * else:      s' = 100
 * ```
 * ⚠️ **원본 버그 그대로**: 스태미나가 0 인 투수가 공을 하나 더 던지면 **1% 로 되살아난다**
 * (else 가지의 100). 고치지 않는다.
 *
 * 용량 X 가 0 이하면 원본은 0 으로 나누게 되는데(투수 포인터가 없을 때뿐),
 * 웹판에는 그 상황이 없으므로 **값을 그대로 돌려준다**.
 */
export function consumeStamina(stamina: number, cost: number, capacity: number): number {
  if (capacity <= 0) return stamina
  const next =
    stamina > 0 ? stamina + Math.trunc(((capacity - cost) * FULL_STAMINA) / capacity) - FULL_STAMINA : 100
  return Math.min(FULL_STAMINA, Math.max(0, next))
}

/** 회복량 표 (0x66ed0). 값은 **%** 이고 0xb60e0 이 100 을 곱해 +0x2c 에 더한다 */
export const STAMINA_RECOVERY_PERCENT = {
  /** 모드 3 · 내 육성 선수 · 보직 선발 */
  myStarter: 40,
  /** 모드 3 · 내 육성 선수 · 보직 선발 아님 */
  myRelief: 80,
  /** 그 밖의 모든 투수(모든 CPU 투수, 다른 모드) */
  others: 20,
} as const

export interface StaminaRecoveryInput {
  /** 전역 모드 `0x1552d10`. 3(투수편) 이 아니면 늘 20% 다 */
  readonly mode: number
  /** 내 육성 선수인가 (레코드 +0xa 부호비트, 0xb6389) */
  readonly isMine: boolean
  /** 보직이 선발(0)인가 (`p[+0xb] & 3 == 0`) */
  readonly isStarterRole: boolean
}

/** 회복 % (0x66ed0(mine, starterRole)) */
export function staminaRecoveryPercentOf(input: StaminaRecoveryInput): number {
  if (input.mode !== 3 || !input.isMine) return STAMINA_RECOVERY_PERCENT.others
  return input.isStarterRole ? STAMINA_RECOVERY_PERCENT.myStarter : STAMINA_RECOVERY_PERCENT.myRelief
}

/**
 * 경기 사이 회복 (0xb60e0). 리그 하루를 마치면 0x4ea0c 가 **10팀 모두**의 투수 전원에게 돌린다
 * (모드 2 시즌·3 투수편·4 타자편). 같은 함수라 시즌모드 투수도 경기마다 20% 씩 찬다.
 */
export function recoverStaminaAfterGameDay(stamina: number, input: StaminaRecoveryInput): number {
  const gain = 100 * staminaRecoveryPercentOf(input)
  return Math.min(FULL_STAMINA, Math.max(0, stamina + gain))
}

/**
 * 체력%가 능력치에 주는 감소 (0xb58e6~0xb592a).
 *   55% 이상 감소 없음 · 35~54 −10% · 20~34 −30% · 1~19 −50% · 0 이하 −90%
 *
 * 원본은 구간마다 자른 값을 빼는 꼴인데 **나눗셈 상수까지는 문서에 없다**(P1 3-3 은 % 만 적었다).
 * 여기서는 `값 − trunc(값·%/100)` 으로 둔다 — **자리 올림이 원본과 한 끗 다를 수 있다**(유력).
 */
export function abilityAfterFatigue(value: number, staminaPercent: number): number {
  const reduction =
    staminaPercent > 54 ? 0 : staminaPercent >= 35 ? 10 : staminaPercent >= 20 ? 30 : staminaPercent >= 1 ? 50 : 90
  return value - Math.trunc((value * reduction) / 100)
}

/** 투구 화면이 쓰는 표시용 체력 단계 0~3 = min(trunc(체력%/25), 3) (0x3493c, 유력) */
export function staminaGaugeStepOf(staminaPercent: number): number {
  return Math.min(Math.trunc(staminaPercent / 25), 3)
}

/**
 * 십전대보탕 (GP 아이템 9, 500G — StrMODE[125] "스태미나가 100% 회복되었습니다").
 * 구매 가드 0x13a5a 가 **이미 최대면 막는다** (StrMODE[211]).
 */
export function canBuyStaminaTonic(stamina: number): boolean {
  return stamina !== FULL_STAMINA
}

/** 십전대보탕 사용 0xa49ec — 무조건 최대로 채운다 */
export function applyStaminaTonic(): number {
  return FULL_STAMINA
}

/** StrMODE 글 번호 — 125 "100% 회복", 211 "스태미나가 최대입니다" */
export const STAMINA_TONIC_TEXT = { recovered: 125, alreadyFull: 211 } as const
