/**
 * 필살수비(점프·슬라이딩 캐치) 와 레이저 송구 — binary.mod 0x66b30 · 0x66be4 · 0x66a8c · 0xb2648 · 0x4e858 · 0x400bc.
 *
 * 흐름 (I-controls.md 2c·2d, P2-fielding-ai.md 3절):
 *   1. 타구가 떠난 순간(메시지 0x11) 필살수비를 **두 번** 굴린다 — A 점프(플레이+0x1f5), A 가 실패했을 때만 B 슬라이딩(+0x1f6).
 *      이 플래그는 포구 판정의 **높이 창을 넓히는 것뿐**이다(점프 1701~4000 · 슬라이딩 501~1500·거리 2000~3000).
 *   2. 공을 잡고 나면 레이저 송구를 굴리고, 통과하면 사람 수비는 야수 몸이 **반짝인다**(경기+0x19ad).
 *      CPU 수비는 반짝임 없이 곧바로 레이저(경기+0x19ae).
 *   3. 반짝이는 19틱 안에 **새로 누른**(누르고 있기 불가) 키가 들어오면 레이저 확정.
 *      같은 틱에 그 키는 송구 목표(0x588)로도 가므로 **키 한 번 = 목표 선택 + 레이저 확정**이다.
 */

import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 능력치 → 등급 0~7 (0xbbe98).
 * 원본은 수비·주루·투구 어디서나 이 한 함수를 쓴다.
 * (아직 `entities/fielding` 이 없어 여기 둔다 — 그쪽이 생기면 합치는 게 맞다.)
 */
const GRADE_THRESHOLDS: readonly number[] = [125, 250, 375, 525, 675, 825, 925]

export function abilityGradeOf(ability: number): number {
  const found = GRADE_THRESHOLDS.findIndex((threshold) => ability <= threshold)
  return found === -1 ? 7 : found
}

/** 표 0xd25b0 — 필살수비 확률(등급별, ×10 하면 1000 분율) */
export const SPECIAL_DEFENSE_TABLE: readonly number[] = [1, 2, 3, 3, 4, 4, 5, 6]
/** 표 0xd2590 — 레이저 송구 확률(등급별, ×10 하면 1000 분율) */
export const LASER_THROW_TABLE: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 10]
/** 스킬 21 = 초감각 ("모든 포지션 수비 가능 · 필살 수비 발동 +3%") — 필살수비·레이저 둘 다 +3 */
export const SIXTH_SENSE_SKILL_ID = 21
export const SIXTH_SENSE_BONUS = 3
/** 표값 → 난수 기준 (rand(0,1000) 과 견준다) */
export const CHANCE_SCALE = 10
export const CHANCE_LIMIT = 1000
/** 전역 모드 4 = 나만의리그 타자편 — 필살수비만 기준을 절반으로 자른다 (레이저는 반감 없다) */
export const BATTER_CAREER_MODE = 4

export type SpecialDefenseCatch = '점프캐치' | '슬라이딩캐치'

export interface SpecialDefenseInput {
  /** 0xb570c(경기용 수비 능력치) 결과 */
  readonly defenseAbility: number
  readonly skillIds: readonly number[]
  /** 전역 모드 0x1552d10 */
  readonly gameMode: number
}

/** 필살수비 한 번 굴림의 기준값 (0~1000). rand(0,1000) 이 이보다 작으면 발동 */
export function specialDefenseChanceOf(input: SpecialDefenseInput): number {
  const grade = abilityGradeOf(input.defenseAbility)
  const base = SPECIAL_DEFENSE_TABLE[grade] + (input.skillIds.includes(SIXTH_SENSE_SKILL_ID) ? SIXTH_SENSE_BONUS : 0)
  const threshold = base * CHANCE_SCALE
  return input.gameMode === BATTER_CAREER_MODE ? Math.trunc(threshold / 2) : threshold
}

/**
 * 필살수비 굴림 — A(점프) 를 먼저, 실패했을 때만 B(슬라이딩) 를 굴린다 (0x50930 → 0x50930 실패 시 0x508c0).
 * 두 굴림의 확률표가 같아서 합계는 약 두 배가 된다 — 원본 그대로.
 */
export function rollSpecialDefense(input: SpecialDefenseInput, random: RandomPort): SpecialDefenseCatch | null {
  const threshold = specialDefenseChanceOf(input)
  if (randomIntegerBelow(random, 0, CHANCE_LIMIT) < threshold) return '점프캐치'
  if (randomIntegerBelow(random, 0, CHANCE_LIMIT) < threshold) return '슬라이딩캐치'
  return null
}

export interface SpecialDefenseGate {
  /** 전역 모드 — 7(홈런더비)이면 굴리지 않는다 */
  readonly gameMode: number
  /** 0x36140(this) == 0 — 파울·담장 밖 판정이 아닌 타구 (뜻은 유력) */
  readonly isFairBattedBall: boolean
  /** 경기+0x13 == 0 · 경기+0x19 == 0 · 경기+0x1e == 0 (셋 다 0 이어야 한다, 뜻 미해결) */
  readonly isPlayableState: boolean
  /** this+0xfe8 — 이번 타구에서 이미 필살수비가 걸렸다 */
  readonly hasSpecialDefenseThisBall: boolean
  /** 공 쫓는 야수의 칸(0xb0c90). 0(투수)·1(포수) 는 굴리지 않는다 */
  readonly chaserSlot: number
}

export const HOME_RUN_DERBY_MODE = 7

/** 필살수비 굴림 자체가 도는지 (0x50faa 가지의 조건들) */
export function canRollSpecialDefense(gate: SpecialDefenseGate): boolean {
  if (gate.gameMode === HOME_RUN_DERBY_MODE) return false
  if (!gate.isFairBattedBall) return false
  if (!gate.isPlayableState) return false
  if (gate.hasSpecialDefenseThisBall) return false
  return gate.chaserSlot !== 0 && gate.chaserSlot !== 1
}

export interface LaserThrowInput {
  readonly defenseAbility: number
  readonly skillIds: readonly number[]
}

/** 레이저 송구 기준값 (0~1000). 모드 4 반감이 **없다** — 필살수비와 다른 점 */
export function laserThrowChanceOf(input: LaserThrowInput): number {
  const grade = abilityGradeOf(input.defenseAbility)
  const base = LASER_THROW_TABLE[grade] + (input.skillIds.includes(SIXTH_SENSE_SKILL_ID) ? SIXTH_SENSE_BONUS : 0)
  return base * CHANCE_SCALE
}

/** 0x66a8c — rand(0,1000) < 기준 */
export function rollLaserThrow(input: LaserThrowInput, random: RandomPort): boolean {
  return randomIntegerBelow(random, 0, CHANCE_LIMIT) < laserThrowChanceOf(input)
}

/**
 * "반짝이는 순간" 창 — 0xb2648.
 * 카운터는 `플레이+0x174 − 공[0x68] == 10` 인 순간 0 에서 시작하고(공을 잡은 뒤 10틱째로 보임 — **유력**),
 * 틱마다 +1 하며 `(값 − 1) ≤ 18` 인 동안 열려 있다 → **19틱**.
 * 시작 기준점이 유력이라, 여기서는 "공 잡은 틱"을 0 으로 두고 10~28틱을 창으로 잡았다.
 */
export const LASER_WINDOW_START_TICK = 10
export const LASER_WINDOW_TICKS = 19
export const LASER_WINDOW_LAST_TICK = LASER_WINDOW_START_TICK + LASER_WINDOW_TICKS - 1

export interface LaserWindowInput {
  /** 공을 잡은 틱을 0 으로 센 경과 틱 */
  readonly ticksSinceCatch: number
  /** 플레이+0x160 ≠ −1 — 사람이 이미 송구 목표를 골랐다 */
  readonly hasChosenThrowTarget: boolean
  /** 플레이+0x12c — 야수가 공을 쥐고 있다 */
  readonly isBallHeld: boolean
  /** 야수 vt 0xc4 — 공 가진 야수가 던질 준비가 됐다 */
  readonly isThrowerReady: boolean
}

/**
 * 창이 열려 있는가. 원본은 "사람이 이미 목표를 골랐고 + 공을 쥐었고 + 야수가 준비됐으면" 창을 닫는다
 * (레이저를 쓸 기회가 이미 지나간 것으로 본다).
 */
export function isLaserWindowOpen(input: LaserWindowInput): boolean {
  if (input.hasChosenThrowTarget && input.isBallHeld && input.isThrowerReady) return false
  return (
    input.ticksSinceCatch >= LASER_WINDOW_START_TICK && input.ticksSinceCatch <= LASER_WINDOW_LAST_TICK
  )
}

export interface LaserInputJudgement {
  /** 반짝임을 계속할지 (창이 닫히면 0x4e858 이 경기+0x19ad 를 지운다) */
  readonly isShining: boolean
  /** 경기+0x19ae — 레이저 확정 */
  readonly isLaserConfirmed: boolean
}

export interface LaserKeyInput {
  /** 경기+0x19ad — 지금 반짝이는 중 */
  readonly isShining: boolean
  readonly isWindowOpen: boolean
  /** 이번 틱 키 (`KeyboardEvent.key`). 안 눌렸으면 null */
  readonly key: string | null
  /**
   * 키 반복인가. 원본은 `this+0x6c & 0xf == 0`(반복 계수 0 = 새로 누른 키)만 받아,
   * **누르고 있기로는 레이저가 안 난다**. 웹에서는 `KeyboardEvent.repeat` 가 그 자리다
   * (이 저장소의 `useStageControls.ts` 도 `event.repeat` 를 그렇게 버린다).
   */
  readonly isRepeat: boolean
}

/** 반짝임 창 입력 판정 — 0x4e858, 매 틱 */
export function judgeLaserInput(input: LaserKeyInput): LaserInputJudgement {
  if (!input.isWindowOpen) return { isShining: false, isLaserConfirmed: false }
  if (!input.isShining) return { isShining: false, isLaserConfirmed: false }
  const pressed = input.key !== null && input.key !== '' && !input.isRepeat
  return { isShining: true, isLaserConfirmed: pressed }
}

export interface LaserFireInput {
  /** 경기+0x19ae */
  readonly isLaserConfirmed: boolean
  /** 플레이+0x160 ≠ −1 */
  readonly hasChosenThrowTarget: boolean
  /** 플레이+0x12c */
  readonly isBallHeld: boolean
  /** 야수 준비됨 */
  readonly isThrowerReady: boolean
}

/** 실제 레이저 송구가 나가는지 — 0x400bc. 참이면 플레이+0x1f4 = 1 */
export function canFireLaser(input: LaserFireInput): boolean {
  return input.isLaserConfirmed && input.hasChosenThrowTarget && input.isBallHeld && input.isThrowerReady
}

/** 레이저 송구의 효과 (2b 절): 던지는 야수 달리기 속도 130%, 거리 상한 120%, 악송구 기준 +100(=+1%p) */
export const LASER_SPEED_PERCENT = 130
export const LASER_RANGE_PERCENT = 120
export const LASER_WILD_THROW_BONUS = 100
