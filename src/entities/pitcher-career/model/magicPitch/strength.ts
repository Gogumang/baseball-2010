/**
 * 한 경기 마구 횟수 표 `0xd84ff` (u8, 색인 = 마구 번호).
 * 1 파이어 4 · 2 웨이브 5 · 3 썬더 6 · 4 샤이닝·캐넌·미라지 7.
 * 색인 5~9 도 7 로 채워져 있지만 **그 칸으로 가는 경로를 못 찾았다**(H2 2절) — 표 값 그대로 둔다.
 */
export const MAGIC_COUNT_BY_NUMBER: readonly number[] = [0, 4, 5, 6, 7, 7, 7, 7, 7, 7]

/** 마투수 레벨별 횟수 표 `0xd8509` (s8, Lv0~4) */
export const MAGIC_COUNT_BY_ACE_LEVEL: readonly number[] = [3, 4, 5, 6, 7]

/** 투수 스킬 23(= 이름 39 "혼신") "마구 횟수 +2" */
export const SPIRIT_SKILL_BONUS = 2

export interface MagicCountInput {
  /** 투수 레코드 +0x18. 0 이면 마구가 없다 */
  readonly number: number
  /** 마선수(마투수)인가 (`0xb633d`) */
  readonly isAce: boolean
  /** 마투수 레벨 0~4 (`u8 mgr[0x13a + 순번]` — S9 가 H2 를 정정했다) */
  readonly aceLevel: number
  /** 투수 스킬 23 혼신을 가졌는가 */
  readonly hasSpiritSkill: boolean
}

/**
 * 타석 교대·교체 처리 0xaebe4 안(0xaee9a~0xaf00a)에서 **남은 횟수가 음수일 때만** 채운다.
 * 곧 횟수는 **경기 전체에 한 번** 주어지고 이닝이 바뀌어도 다시 차지 않는다.
 * 되돌리는(−1) 곳은 대타·투수 교체·그 밖의 교체뿐이다.
 */
export function magicPitchCountOf(input: MagicCountInput): number {
  if (input.number === 0) return 0
  const base = input.isAce
    ? (MAGIC_COUNT_BY_ACE_LEVEL[Math.min(Math.max(input.aceLevel, 0), MAGIC_COUNT_BY_ACE_LEVEL.length - 1)] ?? 0)
    : (MAGIC_COUNT_BY_NUMBER[Math.min(Math.max(input.number, 0), MAGIC_COUNT_BY_NUMBER.length - 1)] ?? 0)
  return base + (input.hasSpiritSkill ? SPIRIT_SKILL_BONUS : 0)
}

/**
 * 마구 타격 보정 (0x34d6c 가 만드는 12바이트 구조체의 투수 쪽 네 칸, d_level.dat).
 *   out+4 = 투수 **구속** + 값 (히트 쪽에서 빼는 값) · out+6 = 투수 **제구** + 값 (파워 쪽)
 *   out+0xa = B(잘 맞음) += B·값/100 · out+0xb = C(홈런) += C·값/100
 */
export interface MagicPitchCorrection {
  /** out+4 */
  readonly velocityBonus: number
  /** out+6 */
  readonly controlBonus: number
  /** out+0xa (%) */
  readonly wellHitPercent: number
  /** out+0xb (%) */
  readonly homeRunPercent: number
}

/** 육성·일반 투수 마구 1~4 */
const CORRECTION_BY_NUMBER: readonly MagicPitchCorrection[] = [
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 180, controlBonus: 180, wellHitPercent: 12, homeRunPercent: 8 },
  { velocityBonus: 200, controlBonus: 200, wellHitPercent: 14, homeRunPercent: 9 },
  { velocityBonus: 220, controlBonus: 220, wellHitPercent: 15, homeRunPercent: 10 },
]

/** 마투수 Lv0~4 (다섯 명 값이 같다) */
const CORRECTION_BY_ACE_LEVEL: readonly MagicPitchCorrection[] = [
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 180, controlBonus: 180, wellHitPercent: 12, homeRunPercent: 8 },
  { velocityBonus: 200, controlBonus: 200, wellHitPercent: 14, homeRunPercent: 9 },
  { velocityBonus: 220, controlBonus: 220, wellHitPercent: 15, homeRunPercent: 10 },
]

/** 마구 보정이 없는 공 (일반 CPU 선수는 +0x18 이 0 이라 늘 여기다) */
export const NO_MAGIC_PITCH_CORRECTION: MagicPitchCorrection = {
  velocityBonus: 0,
  controlBonus: 0,
  wellHitPercent: 0,
  homeRunPercent: 0,
}

/**
 * ⚠️ **원본 버그(B-02)**: out+0xa/+0xb 는 **타자의** B·C 를 올린다(부호가 양수고 빼는 코드가 없다).
 * 마구의 실제 억제력은 out+4/+6(구속·제구 +150~220)뿐이다 — 의도는 감소였을 것으로 보이지만
 * 표 그대로가 실행값이므로 그대로 옮긴다 (H2 2절). 고친 길(기본)은 `entities/batting/model/swingBoost` 가 부호를 뒤집는다.
 */
export function magicPitchCorrectionOf(input: { readonly number: number; readonly isAce: boolean; readonly aceLevel: number }): MagicPitchCorrection {
  if (input.number === 0) return NO_MAGIC_PITCH_CORRECTION
  if (input.isAce) {
    return CORRECTION_BY_ACE_LEVEL[Math.min(Math.max(input.aceLevel, 0), CORRECTION_BY_ACE_LEVEL.length - 1)]
  }
  const index = Math.min(Math.max(input.number, 1), CORRECTION_BY_NUMBER.length) - 1
  return CORRECTION_BY_NUMBER[index]
}
