import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'

/**
 * 감독 강판 · 스스로 강판 (binary.mod 0x504cc 판정 · 표 0xcfa58 · 0x3f86c 플래그 초기화 ·
 * 0x498d4 `#` 키 · 0xc1b48 스스로 강판 처리 — P1 2절, S5 U-17 확정).
 *
 * 판정은 **내 투수가 던지는 동안 타석마다 한 번**(경기 장면 상태 14 진입, 유력) 돈다.
 * 구원(보직 2)은 감독 강판이 아예 없다.
 */

/**
 * 강판 확률 표 `0xcfa58` — s8 4행 × 10칸, 칸 = trunc(평판/100) 0~9, 값은 **%**.
 * 평판이 높을수록 덜 내린다.
 */
export const HOOK_PERCENT_TABLE: readonly (readonly number[])[] = [
  /* 0 체력 ≤20% */ [40, 32, 28, 24, 20, 16, 12, 8, 4, 0],
  /* 1 체력 0%   */ [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
  /* 2 한 이닝 4실점 */ [50, 40, 30, 20, 10, 5, 0, 0, 0, 0],
  /* 3 만루      */ [16, 14, 12, 10, 8, 6, 4, 2, 0, 0],
]

/**
 * 강판 사유별 StrUSER_EVT 첫 글 번호. 실제 글 = 첫 번호 + 말투 단계(0~2).
 *   85~87 체력 ≤20 · 88~90 체력 0 · 91~93 한 이닝 4실점 · 94~96 만루
 *
 * ⚠️ USER_EVT 97~99 "연속으로 안타를 4번이나…" 는 0x504cc 어디에서도 고르지 않는다 —
 * **쓰이지 않는 글**이다(유력). 만들지 않는다.
 */
export const HOOK_USER_EVENT_BASE = {
  lowStamina: 85,
  zeroStamina: 88,
  bigInning: 91,
  basesLoaded: 94,
} as const

/** 감독 말투 단계 — 평판 ≤399 → 0 · 400~699 → 1 · ≥700 → 2 (0x504cc 의 `rep<=3 / rep<=6`) */
export function managerToneOf(reputation: number): 0 | 1 | 2 {
  const step = Math.trunc(reputation / 100)
  return step <= 3 ? 0 : step <= 6 ? 1 : 2
}

/** 한 이닝 실점이 이만큼을 **넘으면** 3번 사유가 선다 (`0xb6988(...) > 3`) */
export const BIG_INNING_RUNS = 3

/**
 * 감독 강판 플래그 `S+0x68`(체력 ≤20% 1회용) · `S+0x69`(체력 0% 1회용).
 *
 * 원본은 나만의리그 선수 레코드(career)에 얹지만 **경기 장면 상태 9("준비 2") 의 0x3f870/0x3f872 가
 * 모드 3 일 때 경기마다 0 으로 되돌린다** → 경기 사이에 새지 않는다 (S5 U-17 확정).
 * 그래서 웹판에서는 **경기 객체의 필드로 두고 경기 시작 때 false** 로 두면 동작이 같다.
 */
export interface ManagerHookFlags {
  /** `S+0x69` — 체력 0% 주사위를 이미 굴렸는가 */
  readonly rolledAtZeroStamina: boolean
  /** `S+0x68` — 체력 ≤20% 주사위를 이미 굴렸는가 */
  readonly rolledAtLowStamina: boolean
}

/** 경기 시작 때의 플래그 (0x3f86c 가 만드는 상태) */
export const EMPTY_MANAGER_HOOK_FLAGS: ManagerHookFlags = {
  rolledAtZeroStamina: false,
  rolledAtLowStamina: false,
}

export interface ManagerHookInput {
  /** 경기 장면 모드 `scene+0x1104` */
  readonly mode: number
  /** 내 투수 보직 (0xb6dec) */
  readonly role: PitcherRole
  /** 내 투수 체력 % = trunc(+0x2c / 100) */
  readonly staminaPercent: number
  /** 평판 `career+0x62` (0~999) */
  readonly reputation: number
  /** 이번 이닝에 상대가 뽑은 점수 (`0xb6988(state, 이닝, 공격측)`) */
  readonly runsAllowedThisInning: number
  /** 1·2·3루 모두 주자가 있는가 (`0xa97a0` 셋 다 참) */
  readonly basesLoaded: boolean
}

export interface ManagerHookResult {
  readonly hooked: boolean
  /** 강판 글 StrUSER_EVT 번호. 강판이 아니면 null */
  readonly userEventIndex: number | null
  /** 이 판정으로 바뀐 플래그 */
  readonly flags: ManagerHookFlags
}

/**
 * `0x504cc(scene)` — 감독 강판 판정 한 번.
 *
 * 순서도 원본 그대로다.
 *   1) 체력 0% 이고 `S+0x69` 가 아직 0 → 플래그를 세우고 행 1 로 굴린다. **실패하면 2) 를 건너뛰고 3) 으로.**
 *   2) (1 을 건너뛴 경우) 체력 ≤20% 이고 `S+0x68` 이 아직 0 → 플래그를 세우고 행 0 으로 굴린다.
 *   3) 이번 이닝 4실점 이상 → 행 2 (조건이 설 때마다 다시 굴린다)
 *   4) 만루 → 행 3 (마찬가지)
 */
export function judgeManagerHook(
  input: ManagerHookInput,
  flags: ManagerHookFlags,
  random: RandomPort,
): ManagerHookResult {
  const miss: ManagerHookResult = { hooked: false, userEventIndex: null, flags }
  if (input.mode !== PITCHER_EDITION_MODE) return miss
  if (input.role === PITCHER_ROLE.relief) return miss

  const column = Math.min(Math.max(Math.trunc(input.reputation / 100), 0), HOOK_PERCENT_TABLE[0].length - 1)
  const tone = managerToneOf(input.reputation)
  const rolls = (row: number) => randomIntegerBelow(random, 0, 10_000) < HOOK_PERCENT_TABLE[row][column] * 100

  let next = flags
  if (input.staminaPercent === 0 && !flags.rolledAtZeroStamina) {
    next = { ...next, rolledAtZeroStamina: true }
    if (rolls(1)) return { hooked: true, userEventIndex: HOOK_USER_EVENT_BASE.zeroStamina + tone, flags: next }
  } else if (input.staminaPercent <= 20 && !flags.rolledAtLowStamina) {
    next = { ...next, rolledAtLowStamina: true }
    if (rolls(0)) return { hooked: true, userEventIndex: HOOK_USER_EVENT_BASE.lowStamina + tone, flags: next }
  }

  if (input.runsAllowedThisInning > BIG_INNING_RUNS && rolls(2)) {
    return { hooked: true, userEventIndex: HOOK_USER_EVENT_BASE.bigInning + tone, flags: next }
  }
  if (input.basesLoaded && rolls(3)) {
    return { hooked: true, userEventIndex: HOOK_USER_EVENT_BASE.basesLoaded + tone, flags: next }
  }
  return { hooked: false, userEventIndex: null, flags: next }
}

/**
 * 스스로 강판 (`#` 키 → StrGAME[104] "그만 던지시겠습니까?" → 0xc1b48).
 * 대답이 "예" 면 CPU 교체 AI 가 **내 선수를 빼고** 새 투수를 고르고, 남은 경기는 간이 엔진이 끝까지 돈다.
 */
export const SELF_HOOK_PROMPT_GAME_TEXT_INDEX = 104

/** 강판 뒤 경기 장면 상태 — 감독 강판은 0x23, 스스로 강판은 0x21 (두 화면의 차이는 해독 문서에 없다) */
export const HOOK_SCENE_STATE = { byManager: 0x23, bySelf: 0x21 } as const

export interface MoundState {
  /** 내 투수가 마운드에 서 있는가 — 거짓이 되면 0xc1d38 이 사람 차례를 넘긴다 */
  readonly myPitcherOnMound: boolean
  /** 간이 엔진이 남은 경기를 돌리는가 (`engine[0] = 1`) */
  readonly simpleEngineRunning: boolean
  /** 교체 AI 가 내 육성 선수를 후보에서 빼는가 (0xac428 의 "마선수 건너뜀" 인자 = 모드 3) */
  readonly excludesMyPitcherFromReplacement: boolean
}

/** 강판(감독·스스로 어느 쪽이든)이 확정된 뒤의 마운드 상태 */
export function applyHook(mode: number): MoundState {
  return {
    myPitcherOnMound: false,
    simpleEngineRunning: true,
    excludesMyPitcherFromReplacement: mode === PITCHER_EDITION_MODE,
  }
}
