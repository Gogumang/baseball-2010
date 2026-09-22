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
import {
  MAGIC_PITCH_TYPE_NUMBER,
  magicBallKindOf,
  magicPitchNameOf,
  magicPitchRecordIndexOf,
} from '@/entities/pitcher-career/model/magicPitch'
import { advanceMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'

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

/** 마구 이름을 못 고를 때 쓰는 글자 — `features/play-pitcher-game` 의 사람 투구와 같은 대체값 */
const MAGIC_PITCH_NAME = '마구'

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
 *
 * 마구(구질 22)는 투수 레코드 **+0x18(= `repertoire.magicId`)** 이 0 이 아니면 구질 칸 5 에 들어간다
 * (0xb6d6a). 남은 횟수는 `magicPitchGame` 이 들고 있다 — 일반 선수 레코드는 +0x18 이 모두 0 이라
 * (H2 4-2) 마구를 던지는 것은 마투수와 육성·명전 투수뿐이다.
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
  /**
   * 경기 내내 이어지는 마구 상태 (남은 횟수 · 공+0x10). 원본이 팀+0x28 과 공 객체를 고치듯
   * **제자리에서 고친다** — 경기마다 `createMagicPitchGameState(레퍼토리)` 로 하나 만들어
   * 투구마다 같은 객체를 넘겨야 한다.
   *
   * ⚠️ **안 넘기면 마구가 나오지 않는다** (남은 횟수 0). 마구 조건(0x344dc)이 볼카운트 48칸 중
   * 36칸(75%)에서 참이라, 남은 횟수를 줄이는 이 객체가 없으면 마구가 경기 내내 계속 나가
   * 원본(한 경기 4~9회)과 크게 어긋난다 — 그래서 기본값은 "꺼짐" 이다.
   * 타석 화면 호출처는 `widgets/batting-stage/model/useStageAnimation.ts` 다.
   */
  magic?: MagicPitchGameState,
): Pitch {
  const repertoire = pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const magicState = magic ?? { remaining: 0, ballMagicNumber: 0 }
  const list = pitchListOf(repertoire.pitchMask, repertoire.magicId !== 0)
  const typeNumber = computerPitchTypeOf({ list, magicCount: magicState.remaining, ...situation }, random)
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
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  // 마구는 게이지를 쓰지 않고 등급이 늘 5 다 — 구속 단계 레코드가 없어 번호로 곧장 고른다 (H2 3-5·3-6)
  const speedStage = pitchSpeedStageOf(typeNumber - 1, stats, controlTier)
  const recordIndex = isMagic ? magicPitchRecordIndexOf(repertoire.magicId, repertoire.form) : null
  const worldPath = pitchPathOf({
    typeNumber,
    form: repertoire.form,
    speedStage,
    target: finalTarget,
    ...(recordIndex === null ? {} : { recordIndex }),
  })
  const type = PITCH_TYPES[typeNumber - 1] ?? PITCH_TYPES[0]

  advanceMagicPitchGameState(magicState, typeNumber, repertoire.magicId)

  return {
    type: isMagic ? magicPitchNameOf(repertoire.magicId, repertoire.form) ?? MAGIC_PITCH_NAME : type.name,
    plate: plateOf(finalTarget, situation.side),
    breakOffset: { x: type.horizontalBreak, y: type.verticalBreak },
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier,
    worldPath,
    stageSide: situation.side,
    magicNumber: magicState.ballMagicNumber,
    // 0x46fa8 은 구질 22 일 때만 경기+0x1080 을 쓰고, 새 투구 준비 0x3d954 가 0 으로 지운다
    ballKind: isMagic ? magicBallKindOf(repertoire.magicId) : 0,
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
