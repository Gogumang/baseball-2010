import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * 투수편 등판 로테이션 (binary.mod 0x1c46c 경기 준비 · 0xa4f60 선발 판정 · 0xb5ca8 로테이션 전진 ·
 * 0xb8c94 맞바꿈 · 0xc1ba4 구원 교체 — P1 1절, S5 U-16 정정).
 *
 * 원본 구조는 이렇다.
 *   ① 로스터 투수 배열의 **0번이 늘 그 경기의 선발**이다 (경기용 팀 객체 0xb891c 가 `team[i] = i`).
 *   ② 하루가 끝날 때마다 리그 날짜 카운터 g(`리그+0x32` = `시즌+0xb2`) 가 1 늘고,
 *      경기 준비 때 팀마다 `0xb5ca8` 로 투수 0~3 을 **한 칸 당긴다** = 4인 로테이션.
 *   ③ 투수편(모드 3) 내 팀만은 `0xa4f60` 이 돌려주는 k 로 **0번과 k번을 통째로 맞바꾼다**.
 *      다음 날 같은 k 로 또 맞바꾸므로 원래대로 돌아온다 → 내 선발은 **g 가 짝수인 날마다** 등판한다.
 *   ④ 보직이 구원(2)이면 ③ 대신 보통 로테이션을 돌고, 경기 중 **8회(0-기준 이닝 7)** 에 교체로 올라온다.
 *
 * ⚠️ 이 로테이션은 **로스터 레코드를 실제로 섞는다**(영구). 그래서 한 팀은 하루에 한 번만 돈다.
 */

/** 로테이션이 도는 투수 수 (0xb5ca8 의 0x30 바이트 memmove 4칸) */
export const ROTATION_SIZE = 4

/** 선발은 늘 투수 배열 0번 (0xb891c) */
export const STARTING_PITCHER_SLOT = 0

/**
 * `0xb5ca8(roster)` — 투수 0~3 을 한 칸 당기고 0번을 3번 자리로 보낸다.
 * (tmp = p0; p0 = p1; p1 = p2; p2 = p3; p3 = tmp)
 * 4번 이후 투수는 건드리지 않는다.
 */
export function advanceRotation<T>(pitchers: readonly T[]): T[] {
  if (pitchers.length < ROTATION_SIZE) return [...pitchers]
  const next = [...pitchers]
  const first = next[0]
  for (let slot = 0; slot < ROTATION_SIZE - 1; slot += 1) next[slot] = next[slot + 1]
  next[ROTATION_SIZE - 1] = first
  return next
}

/** `0xb8c94(team, 0, k)` → `0xb5e98` — 0번과 k번 레코드를 통째로 맞바꾼다 */
export function swapWithStarter<T>(pitchers: readonly T[], slot: number): T[] {
  if (slot <= 0 || slot >= pitchers.length) return [...pitchers]
  const next = [...pitchers]
  const first = next[STARTING_PITCHER_SLOT]
  next[STARTING_PITCHER_SLOT] = next[slot]
  next[slot] = first
  return next
}

/** 나만의리그 투수편 모드 번호 (경기 장면 `scene+0x1104`) */
export const PITCHER_EDITION_MODE = 3
/** 나만의리그 타자편 모드 번호 */
export const BATTER_EDITION_MODE = 4
/** 시즌모드 모드 번호 */
export const SEASON_MODE = 2

/** `0xa4f60` 이 돌려주는 특별값 */
export const START_ASSIGNMENT = {
  /** -1 = 맞바꿈 없이 **보통 로테이션**을 돌린다 (구원·보직 1·투수편이 아님) */
  rotate: -1,
  /** -2 = **아무것도 하지 않는다** (시즌 첫 경기 g==0, 포스트시즌) */
  keep: -2,
} as const

export interface StartAssignmentInput {
  /** 경기 장면 모드. 투수편이 3 이다 */
  readonly mode: number
  /** 리그 날짜 카운터 g = `시즌+0xb2`(s8). 하루 끝 0xb818c 가 +1 한다 */
  readonly dayCounter: number
  /** 내 투수 보직 (0xb6dec) */
  readonly role: PitcherRole
  /** 포스트시즌 진행 중인가 (`S+0x12c`) */
  readonly isPostseason: boolean
}

/**
 * `0xa4f60(S)` — 오늘 내 팀이 0번과 맞바꿀 로스터 칸 k.
 * 반환 ≥ 1 이면 맞바꿈, `START_ASSIGNMENT.rotate`(-1) 면 보통 로테이션, `keep`(-2) 면 그대로 둔다.
 *
 * 검사 순서도 원본 그대로다: 모드 → g==0 → 보직 2 → 보직 != 0 → 포스트시즌 → 식.
 */
export function startAssignmentOf(input: StartAssignmentInput): number {
  const { mode, dayCounter, role, isPostseason } = input
  if (mode !== PITCHER_EDITION_MODE) return START_ASSIGNMENT.rotate
  if (dayCounter === 0) return START_ASSIGNMENT.keep
  if (role === PITCHER_ROLE.relief) return START_ASSIGNMENT.rotate
  if (role !== PITCHER_ROLE.starter) return START_ASSIGNMENT.rotate
  if (isPostseason) return START_ASSIGNMENT.keep
  // k = ((g-1) % 6) / 2 + 1 → g 1,2 → 1 · 3,4 → 2 · 5,6 → 3 · 7,8 → 1 …
  return Math.trunc(((dayCounter - 1) % 6) / 2) + 1
}

/**
 * 내 선발 투수가 오늘 마운드에 서는가.
 * 0xa4f60 의 표 그대로 **g 가 짝수인 날**(0, 2, 4, …) 이다 — 설명서 StrHOWTO[11] "선발투수 : 2경기마다 등판".
 * 보직이 선발(0)이 아니면 이 판정은 뜻이 없다.
 */
export function isMyStartDay(dayCounter: number): boolean {
  return dayCounter % 2 === 0
}

export interface PreGameRotationInput {
  readonly mode: number
  readonly dayCounter: number
  readonly role: PitcherRole
  readonly isPostseason: boolean
}

export interface PreGameRotationPlan {
  /** 상대 팀 로테이션을 한 칸 돌리는가 (g != 0 이면 늘 돈다) */
  readonly advanceOpponent: boolean
  /** 내 팀 로테이션을 한 칸 돌리는가 */
  readonly advanceMine: boolean
  /** 내 팀 0번과 맞바꿀 칸. 0 이면 맞바꾸지 않는다 */
  readonly swapSlot: number
  /**
   * 시즌 첫 경기(g == 0)에 `0x1b684` 로 **내 투수를 로스터 0번에 올리는가**.
   * (새 시즌 처리에서도 같은 함수를 부른다 — 보직이 구원이면 하지 않는다)
   */
  readonly moveMineToStartSlot: boolean
}

/**
 * 경기 전 준비 `0x1c46c` 의 로테이션 부분.
 * 모드 3·4(사람이 뛰는 나만의리그) 기준이고, CPU 끼리의 경기는 `cpuGameRotationAdvances` 쪽이다.
 */
export function preGameRotationPlanOf(input: PreGameRotationInput): PreGameRotationPlan {
  const { mode, dayCounter, role, isPostseason } = input
  const advanceOpponent = dayCounter !== 0
  if (mode !== PITCHER_EDITION_MODE) {
    // 모드 4(타자편): 내 팀도 그냥 한 칸 돈다
    return { advanceOpponent, advanceMine: dayCounter !== 0, swapSlot: 0, moveMineToStartSlot: false }
  }
  const assignment = startAssignmentOf({ mode, dayCounter, role, isPostseason })
  return {
    advanceOpponent,
    advanceMine: assignment === START_ASSIGNMENT.rotate,
    swapSlot: assignment >= 1 ? assignment : 0,
    // 0x1b684 는 보직이 구원(2)이 아닐 때만 내 선수를 0번으로 끌어온다
    moveMineToStartSlot: dayCounter === 0 && role !== PITCHER_ROLE.relief,
  }
}

/**
 * CPU 끼리의 정규시즌 경기(`0xc239c` 안 0xc24fc~0xc254e) — **두 팀 모두** 한 칸 돈다.
 * 모드 2(시즌)·3(투수편)·4(타자편) 에서만, 그리고 날짜 카운터가 0 이 아닐 때만이다.
 *
 * (S5 U-16 이 P1 1-4 의 "정규 CPU 경기엔 로테이션이 없다" 를 뒤집었다.)
 */
export function cpuGameRotationAdvances(mode: number, dayCounter: number): boolean {
  const isLeagueMode = mode === SEASON_MODE || mode === PITCHER_EDITION_MODE || mode === BATTER_EDITION_MODE
  return isLeagueMode && dayCounter !== 0
}

/** 구원 등판이 일어나는 이닝 인덱스 (0-기준). `state+0x6b == 7` = 8회 (0xc1ba4) */
export const RELIEF_ENTRY_INNING_INDEX = 7

export interface ReliefEntryInput {
  readonly mode: number
  /** 내 투수 보직 */
  readonly role: PitcherRole
  /** 지금 수비하는 팀이 사람 팀인가 (`state[0x31 + state[0xa]] == 0`) */
  readonly defenseIsHuman: boolean
  /** 지금 마운드에 선 투수가 내 육성 선수인가 (0xb6389) */
  readonly myPitcherOnMound: boolean
  /** 벤치에 있는 내 육성 투수의 번호. 없으면 -1 (0xb8b08 훑기 결과) */
  readonly benchSlotOfMine: number
  /** 0-기준 이닝 (`state+0x6b`) */
  readonly inningIndex: number
}

/**
 * `0xc1ba4` 앞부분 — 8회에 내 구원 투수를 올릴 것인가.
 * 상대 팀이 수비일 때는 벤치에 내 선수가 없어 `benchSlotOfMine` 이 -1 이라 저절로 걸러진다.
 *
 * 7회 콜드게임으로 경기가 끝나면 8회가 오지 않아 **등판 자체를 못 한다**
 * (그 판정은 `reliefNeverEnteredOf` — S5 U-14).
 */
export function shouldEnterAsRelief(input: ReliefEntryInput): boolean {
  if (input.mode !== PITCHER_EDITION_MODE) return false
  if (input.role !== PITCHER_ROLE.relief) return false
  if (!input.defenseIsHuman) return false
  if (input.myPitcherOnMound) return false
  if (input.benchSlotOfMine < 0) return false
  return input.inningIndex === RELIEF_ENTRY_INNING_INDEX
}

/**
 * 콜드게임 문턱 상수 `state+0x6a` = **6** (0-기준 7회). 경기 상태 초기화 0xb6814 가 넣고
 * 경기 중에는 아무도 고치지 않는다 (S5 U-14 확정).
 */
export const COLD_GAME_INNING_INDEX = 6

/** 마지막 이닝 인덱스 `state+0x69` = 8 (= 9회). 같은 0xb6814 가 넣는다 */
export const LAST_INNING_INDEX = 8

/**
 * 경기가 **7회 콜드게임**으로 끝나 구원 투수가 등판조차 못 했는가 —
 * 원본은 `(s8)state[0x6a] == (s8)state[0x6b]` 한 줄이다 (평판 0xa666e · 인기도 0xa6ec2 · 감독 글 0x12ade).
 *
 * ⚠️ **원본 빈틈 그대로**: 8회(인덱스 7)에 콜드게임이 나서 내 팀이 그 이닝에 수비를 안 했으면
 * 등판을 못 했는데도 이 조건이 서지 않는다 — 그대로 옮긴다 (S5 U-14 4절).
 */
export function reliefNeverEnteredOf(endedInningIndex: number): boolean {
  return endedInningIndex === COLD_GAME_INNING_INDEX
}

/** "오늘은 등판할 기회가 없었구나." StrUSER_EVT[38] (0x12ac4) */
export const NO_ENTRY_USER_EVENT_INDEX = 38
