import { MAGIC_PITCH, pitchListOf } from '@/entities/pitching/model/pitchIntelligence'
import { pitchPathOf, PLATE_DEPTH, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
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

/**
 * 투수편에서 **사람이 던지는 한 개의 공** (P1 3절 스태미나 · 4절 게이지, 궤적은 원본 표 그대로).
 *
 * 원본 순서(0x50da8 구질 → 0x50e9c 코스 확정 → 0x50e08 게이지 OK → 0x4dc78 투구)를 따른다.
 *   1. 구질 칸 6개 중 하나 (칸 5 = 마구, 남은 횟수가 0 이면 못 고른다 — 0x50db8)
 *   2. 코스(조준점)
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
const ZONE_HALF_WORLD = { x: 331, y: 329 }

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

/**
 * 코스 칸 0~8 → 월드 조준점.
 *
 * **근사 두 군데**.
 *   ① 원본은 사람이 (2)(4)(6)(8) 로 조준 커서를 움직인다(`I-controls` 0절, 상태 0x10 메시지 8).
 *      **칸이 몇 개인지, 칸마다 어느 좌표인지 적어 둔 문서가 없다** — P6 에는 투구 화면 절 자체가 없고,
 *      `ui/slt_pitch.raw`(30×30 반투명 원)를 그리는 호출지도 미해결이다(L 5-B).
 *      그래서 설명서 <투구 조작> 2단계를 따라 웹이 써 온 **3×3 격자**를 그대로 둔다.
 *   ② 칸 중심은 스트라이크 존 33px 을 셋으로 나눈 자리(±11px)로 잡았다. 존 반폭이 16.5px 이므로
 *      존 좌표로는 ±2/3 다. (`pitchCommand.courseOf` 의 ±0.62 는 근거가 적힌 값이 아니라 쓰지 않는다.)
 */
export const COURSE_GRID = 3
const COURSE_STEP = 2 / 3

export function courseTargetOf(cell: number, side: number): WorldPoint {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  const column = cell % COURSE_GRID
  const row = Math.floor(cell / COURSE_GRID)
  return {
    x: center.x + (column - 1) * COURSE_STEP * ZONE_HALF_WORLD.x,
    y: center.y + (1 - row) * COURSE_STEP * ZONE_HALF_WORLD.y,
    z: PLATE_DEPTH,
  }
}

function plateOf(target: WorldPoint, side: number) {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: (target.x - center.x) / ZONE_HALF_WORLD.x, y: (target.y - center.y) / ZONE_HALF_WORLD.y }
}

export interface HumanPitchInput {
  readonly typeNumber: number
  /** 코스 칸 0~8 */
  readonly courseCell: number
  /** 등급 t (0~5) */
  readonly grade: number
  /** 게이지에서 누른 칸 — 제구 흩어짐의 조준 칸(slt_pitch 59~67)으로 들어간다 */
  readonly gaugeCell: number
  readonly stats: PitcherStats
  readonly repertoire: PitcherRepertoire
  /** 화면 배치 side (투영 원점 0xcfb18 의 칸) */
  readonly side: number
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
  const target = courseTargetOf(input.courseCell, side)
  const finalTarget = applyControlError(
    target,
    { tier: input.grade, isComputer: false, aimIndex: input.gaugeCell },
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

/**
 * 체력%가 깎아 놓은 실효 능력치 (0xb570c → 0xb58e6). 투구 화면 0x34968 이 이 값으로 등급·구속을 낸다.
 * 장비·스킬 보정은 웹 투수편에 아직 선수 레코드가 없어 넣지 못한다 — 부르는 쪽이 이미 반영해 넘긴다.
 */
export function fatiguedStatsOf(stats: PitcherStats, stamina: number): PitcherStats {
  const percent = staminaPercentOf(stamina)
  return {
    control: abilityAfterFatigue(stats.control, percent),
    velocity: abilityAfterFatigue(stats.velocity, percent),
    breaking: abilityAfterFatigue(stats.breaking, percent),
    stamina: stats.stamina,
  }
}

/** 게이지 커서가 도는 칸 수 — 0 에서 시작해 9 까지, 한 틱에 한 칸 (0x4d708) */
export const GAUGE_CELL_COUNT = GAUGE_LAST_CELL + 1
