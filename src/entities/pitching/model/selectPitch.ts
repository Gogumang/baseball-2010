import type { Pitch, PitcherAbility, PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitchPatternDifficulty } from '@/shared/config/original/pitchPatterns'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { controlTierOf } from '@/entities/pitching/model/controlTier'
import { pitchSpeedStageOf } from '@/entities/pitching/model/pitchSpeedStage'
import { computerPitchTypeOf, pitchListOf } from '@/entities/pitching/model/pitchIntelligence'
import type { CountSituation } from '@/entities/pitching/model/pitchIntelligence'
import { targetKindOf } from '@/entities/pitching/model/pitchIntelligence'
import { applyControlError, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
import { pitchPathOf, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/** 투구 엔진 능력치(0~100)를 원본 눈금(0~999)으로 — 투수편 이식 전 임시 경계 */
const ORIGINAL_SCALE = 10

export interface PitchSituation extends CountSituation {
  readonly batterSide: number
  /** 화면 배치 side */
  readonly side: number
}

/**
 * 마선수가 아닌 상대 투수의 레퍼토리 — 웹은 상대 투수 명단을 고르지 않아 원본 투수 명단 첫 선수(봉은중)의
 * 구질을 쓰고, 화면 투수 그림이 반전되지 않으니 폼은 0 으로 둔다 (추정)
 */
export const DEFAULT_REPERTOIRE: PitcherRepertoireInfo = { form: 0, pitchMask: ROSTER_PITCHER_REPERTOIRES[0].pitchMask, magicId: 0 }

/** 존 표시 반폭 (월드) — 목표 종류 1·2 의 최대 거리 331·329. 스트라이크 판정 경계로 쓴다 (추정: 원본 판정 위치 미확인) */
const ZONE_HALF_WORLD = { x: 331, y: 329 }

function plateOf(target: WorldPoint, side: number) {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: (target.x - center.x) / ZONE_HALF_WORLD.x, y: (target.y - center.y) / ZONE_HALF_WORLD.y }
}

/**
 * CPU 투구 — 원본 순서 그대로 난수를 뽑는다:
 *   구질(0x344dc) → 목표 종류(0x9eeac) → 목표점(0x345fc) → 제구 등급(0xb74bc) → 제구 오차(0x4dc78) → 곡선
 * 등급을 목표점 뒤에 뽑는 순서와, 구속 단계(등급이 필요)를 곡선 직전에 정하는 것은 호출 흐름에서 추정했다.
 * 마구(구질 22)는 B-스플라인 레코드와 남은 횟수가 미해독이라 목록에 넣지 않는다 (추정).
 */
export function selectPitch(
  pitcher: PitcherAbility,
  situation: PitchSituation,
  random: RandomPort,
  /**
   * 원본은 늘 `pitchpattern_hard` 를 쓴다 — 옵션 `+0x2c` 가 난이도이고 **기본값 2 = hard** 이며
   * 뒤로 바꾸는 코드가 없다 (L 4-A · P7 K2 확정 · DECISIONS 2026-09-20 ②).
   */
  difficulty: PitchPatternDifficulty = 'hard',
): Pitch {
  const repertoire = pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const list = pitchListOf(repertoire.pitchMask, false)
  const typeNumber = computerPitchTypeOf({ list, magicCount: 0, ...situation }, random)
  const kind = targetKindOf(difficulty, situation, random)
  const target = pitchTargetOf(kind, situation, random)
  const control = pitcher.control * ORIGINAL_SCALE
  const controlTier = controlTierOf(control, true, random)
  const finalTarget = applyControlError(target, { tier: controlTier, isComputer: true }, random)
  const stats = {
    control,
    velocity: pitcher.velocity * ORIGINAL_SCALE,
    breaking: (pitcher.breaking ?? pitcher.velocity) * ORIGINAL_SCALE,
  }
  const speedStage = pitchSpeedStageOf(typeNumber - 1, stats, controlTier)
  const worldPath = pitchPathOf({ typeNumber, form: repertoire.form, speedStage, target: finalTarget })
  const type = PITCH_TYPES[typeNumber - 1] ?? PITCH_TYPES[0]

  return {
    type: type.name,
    plate: plateOf(finalTarget, situation.side),
    breakOffset: { x: type.horizontalBreak, y: type.verticalBreak },
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier,
    worldPath,
    stageSide: situation.side,
  }
}

/**
 * 구속으로 원본의 구속 단계를 골라 비행 시간을 낸다 — 사용자 투구(투수편) 전용.
 * 단계 사이는 보간한다. 양 끝값은 원본 그대로다.
 */
export function flightMillisecondsOf(
  flightSteps: readonly number[],
  velocity: number,
): number {
  if (flightSteps.length === 0) return 18 * millisecondsPerFrame()

  const ratio = Math.min(1, Math.max(0, velocity / 100))
  const position = ratio * (flightSteps.length - 1)
  const lower = Math.floor(position)
  const upper = Math.min(flightSteps.length - 1, lower + 1)
  const steps = flightSteps[lower] + (flightSteps[upper] - flightSteps[lower]) * (position - lower)

  return Math.round(steps * millisecondsPerFrame())
}
