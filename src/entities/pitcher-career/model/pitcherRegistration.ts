import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { MAXIMUM_PITCHER_ABILITY, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * 나만의리그 **투수편 선수 등록** (상태 0x65 팀 고르기 → 0x66 등록 → 0x67 확인 — C-4 확정,
 * 등록 구질은 J 3-1 확정).
 *
 * 고르는 줄은 타자편과 **같은 다섯**이고 뜻만 다르다 (C-4 표):
 * ```
 * 0 이름
 * 1 타입      [+0x7c]  투수는 **3가지**          → rec[+0xb] bit5~7
 * 2 보직      [+0x78]  선발 / 구원               → rec[+0xb] bit0~1 (**1 을 고르면 2 가 저장된다**)
 * 3 손        [+0x80]  우완 / 좌완               → rec[+0xb] bit4
 * 4 피부      [+0x84]  황인 / 백인 / 흑인        → rec[+0xb] bit2~3
 * ```
 * 여기에 투수만 있는 단계가 하나 더 있다 — **기본 변화구 2개 고르기**(StrMODE[13], 0x11172~0x111ea).
 *
 * rec[+0xa] 는 등록 셋업이 **0x80** 을 쓴다 (bit7 = 내 육성 선수, bit6 = 고정 포지션 있음 — 투수는 0).
 */

/** 등록 화면 타입 칸 수 — 타자 2 · 투수 **3** (C-4 표) */
export const PITCHER_TYPE_COUNT = 3

/**
 * 타입 이름. **원본 글(StrMODE)을 해독 문서에서 못 찾았다** — 번호로 둔다.
 * 채울 값은 StrMODE 의 투수 타입 줄에서 와야 한다 (타자 쪽 "타격형/장타형" 과 같은 자리).
 */
export const PITCHER_TYPE_LABELS: readonly string[] = ['타입 1', '타입 2', '타입 3']

/** 보직 칸 — 목록 값 0·1 이고 **1 을 고르면 레코드에 2 가 저장된다** (0x1707c) */
export const PITCHER_ROLE_LABELS: readonly string[] = ['선발', '구원']
export const PITCHER_HAND_LABELS: readonly string[] = ['우완', '좌완']
export const PITCHER_SKIN_LABELS: readonly string[] = ['황인', '백인', '흑인']

/** 목록 값(0·1) → 레코드 보직 (0 선발 · 2 구원) */
export function pitcherRoleOfChoice(choice: number): PitcherRole {
  return choice === 0 ? PITCHER_ROLE.starter : PITCHER_ROLE.relief
}

/** 레코드 보직 → 목록 값 */
export function pitcherRoleChoiceOf(role: PitcherRole): number {
  return role === PITCHER_ROLE.starter ? 0 : 1
}

/**
 * 투수 폼 `0xb6e24` = 레코드 `+0xb` 윗니블 = **2 × 타입 + 손** (0x16f9a 의 "윗니블 = 2×A + B").
 * 육성 투수의 폼이 0~5 라는 `magicPitch.ts` 의 범위와 맞는다 (타입 3 × 손 2 = 6가지).
 * 마구 번호 4(샤이닝·캐넌·미라지)의 이름·궤적이 **폼/2 = 타입**으로 갈린다 (H2 1-2).
 */
export function pitcherFormOf(typeIndex: number, handIndex: number): number {
  return typeIndex * 2 + handIndex
}

/** 레코드 `+0xa` — 등록 셋업이 쓰는 값 (C-4). bit7 = 내 육성 선수 */
export const PITCHER_RECORD_BYTE_0X0A = 0x80

/** 레코드 `+0xb` 를 등록 선택으로 조립한다 (bit0~1 보직 · bit2~3 피부 · bit4 손 · bit5~7 타입) */
export function pitcherRecordByte0x0bOf(profile: PitcherRookieProfile): number {
  return (
    (profile.role & 3) |
    ((profile.skinIndex & 3) << 2) |
    ((profile.handIndex & 1) << 4) |
    ((profile.typeIndex & 7) << 5)
  )
}

/**
 * 시작 능력치 (0x16e2c, C-4 확정):
 * ```
 * out[i] = 표 0xcc3f2[min(보직,1)*4 + i] × 10   ; 선발 [10,10,10,20] · 구원 [12,12,12,10]
 * 타입 0 → out[1] += 30 · 타입 1 → out[0] += 30 · 그 밖 → out[2] += 30
 * 각 값 999 상한
 * ```
 * 칸 순서는 제구·구속·변화·체력이다 — 곧 선발은 체력이 200 으로 시작하고, 구원은 체력이 100 이다.
 */
const ROOKIE_TABLE: readonly number[] = [10, 10, 10, 20, 12, 12, 12, 10]
const ROOKIE_SCALE = 10
/** 타입 보너스가 붙는 칸 — 타입 0 구속 · 타입 1 제구 · 그 밖 변화 */
export const PITCHER_TYPE_BONUS_ABILITY: readonly (keyof PitcherAbility)[] = ['velocity', 'control', 'breaking']
const ROOKIE_TYPE_BONUS = 30

export function rookiePitcherAbilityOf(role: PitcherRole, typeIndex: number): PitcherAbility {
  const row = Math.min(role, 1) * PITCHER_ABILITY_ORDER.length
  const ability: PitcherAbility = {
    control: ROOKIE_TABLE[row] * ROOKIE_SCALE,
    velocity: ROOKIE_TABLE[row + 1] * ROOKIE_SCALE,
    breaking: ROOKIE_TABLE[row + 2] * ROOKIE_SCALE,
    stamina: ROOKIE_TABLE[row + 3] * ROOKIE_SCALE,
  }
  const bonusKey = PITCHER_TYPE_BONUS_ABILITY[typeIndex] ?? PITCHER_TYPE_BONUS_ABILITY[2]
  return {
    ...ability,
    [bonusKey]: Math.min(MAXIMUM_PITCHER_ABILITY, ability[bonusKey] + ROOKIE_TYPE_BONUS),
  }
}

/**
 * 고를 수 있는 기본 변화구 8종 — 표 `0xcc520` u32 **[2, 3, 5, 4, 7, 6, 8, 9]** (J 3-1).
 * 칸 번호 k 가 곧 구질 훈련 표의 칸(행·2 + 열%2)이다 — 등록이 `커리어+0x208+k·4+1 = 1` 을 쓴다.
 */
export const ROOKIE_BREAKING_PITCH_TYPES: readonly number[] = [2, 3, 5, 4, 7, 6, 8, 9]

/** 고르는 개수 — StrMODE[13] "기본 변화구 2개" (0x12410·0x296f0) */
export const ROOKIE_BREAKING_PITCH_COUNT = 2

/** 등록은 FASTBALL(1) 을 무조건 준다 (`0xb6dfd(p, 1)`) */
export const FASTBALL_TYPE_NUMBER = 1

/** 고른 칸들로 보유 구질 비트마스크 `+0x1c` 를 만든다 (비트 t−1 = 구질 t) */
export function rookiePitchMaskOf(slots: readonly number[]): number {
  let mask = 1 << (FASTBALL_TYPE_NUMBER - 1)
  for (const slot of slots) {
    const typeNumber = ROOKIE_BREAKING_PITCH_TYPES[slot]
    if (typeNumber !== undefined) mask |= 1 << (typeNumber - 1)
  }
  return mask
}

export interface PitcherRookieProfile {
  /** 레코드 보직 (0 선발 · 2 구원) */
  readonly role: PitcherRole
  /** 등록 타입 0~2 */
  readonly typeIndex: number
  /** 0 우완 · 1 좌완 */
  readonly handIndex: number
  /** 0 황인 · 1 백인 · 2 흑인 */
  readonly skinIndex: number
  /** 고른 기본 변화구 칸 (0~7, 두 개) */
  readonly breakingPitchSlots: readonly number[]
  /** 팀 고르기(0x65)에서 고른 팀 0~14. 안 넘기면 기본 팀이다 */
  readonly teamId?: number
}

export const DEFAULT_PITCHER_ROOKIE_PROFILE: PitcherRookieProfile = {
  role: PITCHER_ROLE.starter,
  typeIndex: 0,
  handIndex: 0,
  skinIndex: 0,
  breakingPitchSlots: [0, 1],
}

/** 등록을 마칠 수 있는가 — 변화구를 정확히 두 개 골라야 한다 (StrMODE[13]) */
export function canRegisterPitcher(profile: PitcherRookieProfile): boolean {
  return new Set(profile.breakingPitchSlots).size === ROOKIE_BREAKING_PITCH_COUNT
}

/** 변화구 칸을 켜고 끈다 — 두 개를 넘겨 고르면 **가장 먼저 고른 것이 빠진다**(웹 편의, 원본 근거 없음) */
export function toggleBreakingPitchSlot(
  slots: readonly number[],
  slot: number,
): readonly number[] {
  if (slots.includes(slot)) return slots.filter((chosen) => chosen !== slot)
  const next = [...slots, slot]
  return next.length > ROOKIE_BREAKING_PITCH_COUNT ? next.slice(next.length - ROOKIE_BREAKING_PITCH_COUNT) : next
}
