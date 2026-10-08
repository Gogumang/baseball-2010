import { MAGIC_PITCH, pitchListOf } from '@/entities/pitching/model/pitchIntelligence'
import { pitchPathOf, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import { aimStartOf } from '@/features/play-pitcher-game/model/pitchAim'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { applyControlError } from '@/entities/pitching/model/pitchTarget'
import { pitchSpeedStageOf } from '@/entities/pitching/model/pitchSpeedStage'
import { controlTierOf } from '@/entities/pitching/model/controlTier'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  GAUGE_LAST_CELL,
  MAGIC_PITCH_GRADE,
  gaugeGradeOf,
  usesGauge,
} from '@/entities/pitcher-career/model/pitchGauge'
import {
  MAGIC_PITCH_TYPE_NUMBER,
  MAGIC_PITCH_SLOT,
  magicPitchNameOf,
} from '@/entities/pitcher-career/model/magicPitch'
import {
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
  consumeStamina,
  abilityAfterFatigue,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { MAXIMUM_PITCHER_ABILITY } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * 투수편에서 **사람이 던지는 한 개의 공** (P1 3절 스태미나 · 4절 게이지, 궤적은 원본 표 그대로).
 *
 * 원본 순서(0x50da8 구질 → 0x50e9c 코스 확정 → 0x50e08 게이지 OK → 0x4dc78 투구)를 따른다.
 *   1. 구질 칸 6개 중 하나 (칸 5 = 마구, 남은 횟수가 0 이면 못 고른다 — 0x50db8)
 *   2. 조준점 (0x10 — 방향키로 흐르는 점, `pitchAim`)
 *   3. 게이지 등급 t (0~5). 게이지를 끄면 제구·체력 확률표 0xd896c 로 뽑는다 (0x4dbac)
 *   4. t 로 능력치 배율(70~110%)과 제구 흩어짐 표 0xcfd60 을 먹인 뒤 궤적 레코드를 고른다
 *
 * ⚠️ 궤적 물리 루프(0xb3b38·0xb401c)는 이 저장소에서 해독하지 않는 주제다. 여기서는 원본
 * `pitch.zt1` 레코드를 읽는 기존 `entities/pitching/model/pitchCurve` 를 그대로 부른다.
 */

/** 구질 칸 수 (0xb6d2c 의 표 0xd8920, 칸 6개) */
export const PITCH_SLOT_COUNT = 6

export interface PitcherRepertoire {
  /** 투수 레코드 +0x1c 비트마스크 */
  readonly pitchMask: number
  /** 투수 폼 0xb6e24 (육성 0~5) */
  readonly form: number
  /** 투수 레코드 +0x18 마구 번호 (0 이면 마구 없음) */
  readonly magicNumber: number
  /** 마선수(마투수)인가 — 폼 6~10 쪽 레코드를 쓴다 */
  readonly isAce?: boolean
}

/** 구질 칸 한 자리 — 번호 0 이면 빈 칸이라 고를 수 없다 */
export interface PitchSlot {
  readonly slot: number
  /** 원본 구질 번호 1~21, 마구는 22. 0 이면 빈 칸 */
  readonly typeNumber: number
  readonly name: string
  readonly isMagic: boolean
}

/**
 * 구질 칸 6개 (`0xb6d2c`). 칸 5 는 `+0x18 != 0` 일 때만 마구로 채운다 (0xb6d6a).
 * 이름은 일반 구질이면 `pitchTypes` 표, 마구면 번호·폼으로 고른 StrCOMMON 이름이다.
 */
export function pitchSlotsOf(repertoire: PitcherRepertoire): readonly PitchSlot[] {
  const list = pitchListOf(repertoire.pitchMask, repertoire.magicNumber !== 0)
  return list.map((typeNumber, slot) => {
    if (typeNumber === MAGIC_PITCH) {
      return {
        slot,
        typeNumber: MAGIC_PITCH_TYPE_NUMBER,
        name: magicPitchNameOf(repertoire.magicNumber, repertoire.form) ?? '마구',
        isMagic: true,
      }
    }
    return {
      slot,
      typeNumber,
      name: typeNumber === 0 ? '' : (PITCH_TYPES[typeNumber - 1]?.name ?? ''),
      isMagic: false,
    }
  })
}

/** 그 칸을 지금 고를 수 있는가 — 마구 칸은 남은 횟수가 0 이면 막힌다 (0x50db8) */
export function canSelectSlot(slot: PitchSlot, magicRemaining: number): boolean {
  if (slot.typeNumber === 0) return false
  if (slot.slot === MAGIC_PITCH_SLOT && slot.isMagic) return magicRemaining > 0
  return true
}

/** 투수 능력치 (레코드 +0xc 부터 s16 네 칸, 0~999) */
export interface PitcherStats {
  readonly control: number
  readonly velocity: number
  readonly breaking: number
  readonly stamina: number
}

export interface PitchGradeInput {
  /** 환경설정 "투구 게이지" 가 켜져 있는가 (설정 +0x2d, **원본 기본값은 꺼짐**) */
  readonly gaugeSettingOn: boolean
  /** 고른 구질 번호 */
  readonly typeNumber: number
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 (그때 등급도 0) */
  readonly gaugeCell: number
  /** 제구 능력치 (체력% 감소까지 반영한 값) */
  readonly effectiveControl: number
  /** 체력 % */
  readonly staminaPercent: number
}

/**
 * 이번 공의 등급 t (0~5).
 *   - 마구(22)는 게이지를 쓰지 않고 늘 5 (0x4dbae)
 *   - 게이지를 쓰면 누른 칸 g → `max(g − 4, 1)`, 안 누르면 0 (0x50e08)
 *   - 게이지를 끄면 제구·체력 확률표 0xd896c (0xb74bc)
 */
export function pitchGradeOf(input: PitchGradeInput, random: RandomPort): number {
  if (input.typeNumber === MAGIC_PITCH_TYPE_NUMBER) return MAGIC_PITCH_GRADE
  const gauge = usesGauge({
    defenseIsHuman: true,
    gaugeSettingOn: input.gaugeSettingOn,
    pitchTypeNumber: input.typeNumber,
  })
  if (gauge) return gaugeGradeOf(input.gaugeCell)
  return controlTierOf(input.effectiveControl, input.staminaPercent !== 0, random)
}

/**
 * 존 반폭 (월드) — `selectPitch.ts` 가 월드 좌표를 존 좌표(−1~1)로 바꿀 때 쓰는 값과 같다.
 * 그쪽 상수가 파일 안에 숨어 있어 같은 수를 여기에 다시 적는다 (목표 종류 1·2 의 최대 거리 331·329).
 */
export const ZONE_HALF_WORLD = { x: 331, y: 329 }

/**
 * 스트라이크 존 표 `0xcfb7c` (존 판정 0x341ec, Q1 문서) — 칸 = 타자 우/좌(`scene+0x17e1`).
 * 화면 좌표 (x, y, 폭, 높이) 이고 경계를 포함한다. 한가운데 16×16 의 중심 표는 `0xcfb54` 다.
 */
export const STRIKE_ZONE_RECTS: readonly { x: number; y: number; width: number; height: number }[] = [
  { x: 226, y: 310, width: 33, height: 33 },
  { x: 221, y: 310, width: 33, height: 33 },
]
/** 한가운데 16×16 의 중심 `0xcfb54` */
export const ZONE_CENTER_POINTS: readonly { x: number; y: number }[] = [
  { x: 242, y: 326 },
  { x: 237, y: 326 },
]

function plateOf(target: WorldPoint, side: number) {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: (target.x - center.x) / ZONE_HALF_WORLD.x, y: (target.y - center.y) / ZONE_HALF_WORLD.y }
}

export interface HumanPitchInput {
  readonly typeNumber: number
  /**
   * 조준점 `+0x10b8/bc/c0` (x · y · z) — 투구 0x4dc78 이 세 칸을 그대로 목표로 복사한다(4dc9a).
   * 0x10 에서 사람이 움직인 값이다(`pitchAim`). 안 넘기면 0x10 진입 0x39894 의 존 중심 그대로(안 움직인 조준점).
   */
  readonly aim?: WorldPoint
  /** 등급 t (0~5) */
  readonly grade: number
  /**
   * 게이지에서 누른 칸 0~9 (안 눌렀거나 게이지를 안 쓰면 0). 게이지로 등급을 정한 공이면 이 칸이
   * 제구 흩어짐 반지름의 그림 칸(scene+0x17bc)이 된다 — `aimCellOf` 참조.
   */
  readonly gaugeCell: number
  readonly stats: PitcherStats
  readonly repertoire: PitcherRepertoire
  /** 화면 배치 side (투영 원점 0xcfb18 의 칸) */
  readonly side: number
}

/** 게이지를 안 쓴 공의 그림 칸 = t + 3 (0x4dce0) — CPU 의 `COMPUTER_AIM_OFFSET` 과 같은 줄이다 */
const NON_GAUGE_AIM_OFFSET = 3

/**
 * **제구 흩어짐 반지름을 고르는 그림 칸 `scene+0x17bc`** — 투구 순간 0x4dc78 이 읽는 값.
 *
 * ```
 * 4dcd4: bl 0x3f500 (게이지를 쓰는가 — 수비가 사람 · 설정 +0x2d · 구질 ≠ 22)
 * 4dcde: 쓰면 → 4dcf0 (17bc 는 게이지 커서가 멈춘 칸 그대로)
 * 4dce0: 안 쓰면 → scene+0x17bc ← scene+0x17c0(t) + 3
 * 4dd82: 반지름 = slt_pitch 프레임 min(0x3b + 17bc, 0x43) 의 폭/2,  t == 0 이면 프레임 0x3b 의 폭/2 (4ddb2)
 * ```
 * 게이지 커서(0x4d708)는 t 가 0 인 동안만 틱마다 +1 이고, OK(0x50e08)가 t 를 정하면 멈춘다 — 그래서 게이지로 등급을
 * 정한 공은 17bc = 누른 칸 g(1~9)다. 안 누르고 던지면 t = 0 이라 칸과 상관없이 프레임 0x3b 다.
 *
 * 부르는 쪽은 게이지를 안 쓰면 `gaugeCell` 을 0 으로 넘긴다(투수편·팀 경기·미션 화면 모두). 그래서
 * "마구가 아니고 칸이 1~9" 이면 게이지로 정한 공이고, 그 밖(게이지 끔 · 마구 · 안 누름)은 t + 3 이다.
 * 안 누른 공은 t = 0 이라 어느 칸이든 같은 반지름이므로 이 가름은 원본과 결과가 같다.
 */
function aimCellOf(input: Pick<HumanPitchInput, 'typeNumber' | 'gaugeCell' | 'grade'>): number {
  const pressedGauge =
    input.typeNumber !== MAGIC_PITCH_TYPE_NUMBER && input.gaugeCell >= 1 && input.gaugeCell <= GAUGE_LAST_CELL
  return pressedGauge ? input.gaugeCell : input.grade + NON_GAUGE_AIM_OFFSET
}

/**
 * 마구 궤적 레코드 고르기.
 *
 * `pitch.zt1` 구질 22 블록은 17 레코드이고 색인이 **`3(m−1) + trunc(폼/2)`**(육성 1~4) ·
 * **`m + 7`**(마투수 5~9) 이다 (0x9e944, H2 3절). 그 블록의 레코드들은 폼 칸이
 * `0,2,4 / 0,2,4 / 0,2,4 / 0,2,4 / 6,7,8,9,10` 으로 놓여 있어서, 기존
 * `pitchRecordOf(22, 폼, k)` 가 폼으로 거른 뒤 k 번째를 고르면 **k = 마구 번호 − 1** 일 때
 * 정확히 같은 레코드가 나온다. 마투수는 폼 하나에 레코드 하나라 k 가 무엇이든 같다.
 */
function magicSpeedStageOf(repertoire: PitcherRepertoire): number {
  return repertoire.isAce === true ? 0 : Math.max(0, repertoire.magicNumber - 1)
}

/**
 * 사람 투구 한 개를 만든다 — `entities/pitching/model/selectPitch.selectPitch`(CPU) 와 같은 순서지만
 * 구질·코스·등급을 사람이 정한다는 것만 다르다.
 *
 * 등급 t 가 쓰이는 곳은 원본과 같이 둘뿐이다 (P1 4-2):
 *   ① 능력치 배율 70~110% → 구속 단계 (`pitchSpeedStageOf`)
 *   ② 제구 흩어짐 표 0xcfd60 (`applyControlError`)
 */
export function buildHumanPitch(input: HumanPitchInput, random: RandomPort): Pitch {
  const { typeNumber, stats, repertoire, side } = input
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  const target = input.aim ?? aimStartOf(side)
  // 투수 미션의 조준 흔들림(0x39c5c)은 0x10 의 틱마다 이미 지나왔다(`pitchAim.aimTickOf`) — 여기는 놓는 순간
  // 0x4dc78 의 제구 흩어짐뿐이다
  const finalTarget = applyControlError(
    target,
    { tier: input.grade, isComputer: false, aimIndex: aimCellOf(input) },
    random,
  )
  const speedStage = isMagic
    ? magicSpeedStageOf(repertoire)
    : pitchSpeedStageOf(typeNumber - 1, stats, input.grade)
  const worldPath = pitchPathOf({ typeNumber, form: repertoire.form, speedStage, target: finalTarget })
  const type = isMagic ? null : (PITCH_TYPES[typeNumber - 1] ?? PITCH_TYPES[0])

  return {
    type: type?.name ?? (magicPitchNameOf(repertoire.magicNumber, repertoire.form) ?? '마구'),
    plate: plateOf(finalTarget, side),
    breakOffset: { x: type?.horizontalBreak ?? 0, y: type?.verticalBreak ?? 0 },
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier: input.grade,
    worldPath,
    stageSide: side,
    // 경기+0xfc8 == 0x16 — 0x34be0 의 마구 타이밍 폭 · 이펙트 세 곳이 이 칸으로 연다
    isMagicPitch: isMagic,
  }
}

/**
 * 실투 공의 점 수 N — 0x4dec0: 구질(+0xfc8) == 1 이면 0x12(18), 아니면 0x14(20) 를 +0x109c 에 쓰고
 * 0x9e301(공, N) 로 공 점 수를 바꾼다 (CPU `selectPitch` 와 같은 줄)
 */
const MISTAKE_PITCH_FRAMES_FASTBALL = 18
const MISTAKE_PITCH_FRAMES = 20
const FASTBALL_TYPE_NUMBER = 1

/** `mistakeHumanPitchOf` 가 곡선을 다시 놓을 때 보는 칸 — `buildHumanPitch` 에 넘긴 값 그대로 */
export type MistakeHumanPitchInput = Pick<HumanPitchInput, 'typeNumber' | 'grade' | 'stats' | 'repertoire' | 'side'>

/**
 * **사람 투구의 실투** — 0x4dc78 은 사람·CPU 를 가르지 않고 실투 판정 0x33cbc(4dea0)를 부르고, 참이면
 * 곡선 0x9e3c9(4df5e) 앞에서 공을 한가운데로 다시 놓는다 (CPU 는 `selectPitch` 가 따른다):
 *   4dec0  N(scene+0x109c) = 구질(scene+0xfc8) == 1 ? 0x12(18) : 0x14(20)
 *   4df1e  0x9e301(공, N) — 공+0x10(점 수)만 바꾼다. 레코드·구속 단계(0x9e669)는 그대로
 *   4df22  목표점 = 표 0xcfbcc[scene+0x17e1](타자 좌우별 존 한가운데) — 조준점·제구 흩어짐 낸 점 대신
 *   4df5e  0x9e3c9(공, 투수판 0xcfa8c, 그 목표점)
 * 부르는 쪽은 `buildHumanPitch`(제구 흩어짐 굴림) → `isMistakePitch`(rand(0,100)) 뒤에 실투면 이것으로 공을 바꾼다.
 * 곡선은 굴림이 없어 난수 차례는 그대로다. 실투 공의 `plate` 는 (0, 0), `frameCount` 는 18 · 20 이다.
 */
export function mistakeHumanPitchOf(pitch: Pitch, input: MistakeHumanPitchInput): Pitch {
  const { typeNumber, stats, repertoire, side } = input
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  const target = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  const speedStage = isMagic
    ? magicSpeedStageOf(repertoire)
    : pitchSpeedStageOf(typeNumber - 1, stats, input.grade)
  const frames = typeNumber === FASTBALL_TYPE_NUMBER ? MISTAKE_PITCH_FRAMES_FASTBALL : MISTAKE_PITCH_FRAMES
  const worldPath = pitchPathOf({ typeNumber, form: repertoire.form, speedStage, target, frames })
  return {
    ...pitch,
    plate: plateOf(target, side),
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    worldPath,
  }
}

export interface StaminaDrainInput {
  /** 지금 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly typeNumber: number
  /** 체력 실효 능력치 (장비·스킬 포함, 0xb6415(P, 3, 1)) */
  readonly staminaAbility: number
  /** 팀 사기 */
  readonly teamMorale: number
  /** 아직 교체가 없는 첫 투수인가 (`team+0x26 − team+0x33 == 1`) */
  readonly isFirstPitcher: boolean
  readonly batterIntimidates: boolean
  readonly pitcherIsCoward: boolean
  readonly pitcherEndures: boolean
}

/** 공 하나가 깎는 스태미나 (0xa5e14 → 0xaeb08). ⚠️ 0 에서 한 개 더 던지면 1% 로 되살아난다 */
export function drainStamina(input: StaminaDrainInput): number {
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: input.typeNumber,
    batterIntimidates: input.batterIntimidates,
    pitcherIsCoward: input.pitcherIsCoward,
    pitcherEndures: input.pitcherEndures,
  })
  const capacity = staminaCapacityOf(input.staminaAbility, input.teamMorale, input.isFirstPitcher)
  return consumeStamina(input.stamina, cost, capacity)
}

const clampFatigued = (value: number) => Math.min(MAXIMUM_PITCHER_ABILITY, Math.max(0, value))

/**
 * 체력%가 깎아 놓은 실효 능력치 (0xb570c → 0xb58e6). 투구 화면 0x34968 이 이 값으로 등급·구속을 낸다.
 * 장비·스킬·컨디션은 부르는 쪽이 이미 반영해 넘긴다 (투수편 `unclampedGamePitcherAbilityOf`).
 * 0xb570c 는 피로 **뒤** 맨 끝(0xb5b06)에서 0..999 로 자르므로 여기서 자른다 —
 * 냉정 22 로 999 를 넘은 제구가 피로로 깎일 때 먼저 자른 값과 달라진다.
 */
export function fatiguedStatsOf(stats: PitcherStats, stamina: number): PitcherStats {
  const percent = staminaPercentOf(stamina)
  return {
    control: clampFatigued(abilityAfterFatigue(stats.control, percent)),
    velocity: clampFatigued(abilityAfterFatigue(stats.velocity, percent)),
    breaking: clampFatigued(abilityAfterFatigue(stats.breaking, percent)),
    stamina: stats.stamina,
  }
}

/** 게이지 커서가 도는 칸 수 — 0 에서 시작해 9 까지, 한 틱에 한 칸 (0x4d708) */
export const GAUGE_CELL_COUNT = GAUGE_LAST_CELL + 1
