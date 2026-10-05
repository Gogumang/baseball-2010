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
import { applyControlError, cpuPickoffBaseOf, isCpuPickoff, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
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

/** CPU 가 공을 던진다 */
export interface CpuPitchThrow {
  readonly kind: '투구'
  readonly pitch: Pitch
}

/**
 * CPU 가 공 대신 **견제**를 건다 (0x34848 → 메시지 0x10, I-controls 4a-2). 공은 없다 —
 * 상태 0x11 예약(0x34888)도, 마구 소모(0x34894)·싣기(0x3de10)도 안 지난다.
 */
export interface CpuPickoffChoice {
  readonly kind: '견제'
  /** 견제할 루 1·2·3 — 주자가 있는 루가 나올 때까지 rand(1,4) 를 다시 굴려 얻은 것 */
  readonly base: 1 | 2 | 3
}

export type CpuPitchChoice = CpuPitchThrow | CpuPickoffChoice

/**
 * CPU 견제를 켜는 입력 — 원본 `0xa9878(주자관리, 루)` 자리. 그 루에 주자가 있는가.
 * `situation.runnerCount` 와 같은 루 상태에서 와야 한다(`isCpuPickoff` 가 그 수로 거른다).
 */
export interface CpuPickoffInput {
  readonly hasRunnerOnBase: (base: number) => boolean
}

/**
 * CPU 투구 — 원본 순서 그대로 난수를 뽑는다:
 *   구질(0x344dc) → 목표 종류(0x9eeac) → 목표점(0x345fc) → 제구 등급(0xb74bc) → 제구 오차(0x4dc78) → 곡선
 * 목표 종류가 4(견제)이고 주자가 1·2명이면(`isCpuPickoff`, 0x34684) 목표점을 만들지 않고 0x34848 이
 * **견제 루**를 굴린 뒤 끝난다 — 목표점·제구 등급·제구 오차·곡선 굴림이 **없다** (`{ kind: '견제' }`).
 *   0x51214 bl 0x344dc(구질) → 0x5121e bl 0x345fc(→ 0x9eeac 종류 → 종류 4 면 0x34848 루프 → 메시지 0x10 → 0x348d6 끝)
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
  /**
   * CPU 견제를 켠다 (0x34848). 원본은 홈런더비(모드 7, 0x3460e 에서 0x345fc 를 일찍 끝낸다) 말고는
   * 모드를 가리지 않고 견제한다.
   *
   * ⚠️ **안 넘기면 견제가 꺼진다** — 종류 4 가 예전처럼 종류 1(모서리 투구)로 내려앉아 원본이 굴리지 않는
   *    목표점·제구·곡선 난수를 굴리고 원본이 던지지 않는 공을 던진다(**알려진 어긋남**, 미해결).
   *    견제를 받아 줄 진행기가 없는 호출처(나만의리그 타자편·미션 — 다른 작업 구역)가 깨지지 않게 둔 것이다.
   */
  cpuPickoff?: CpuPickoffInput,
): CpuPitchChoice {
  const repertoire = pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const magicState = magic ?? { remaining: 0, ballMagicNumber: 0 }
  const list = pitchListOf(repertoire.pitchMask, repertoire.magicId !== 0)
  const typeNumber = computerPitchTypeOf({ list, magicCount: magicState.remaining, ...situation }, random)
  const kind = targetKindOf(difficulty, situation, random)
  if (cpuPickoff !== undefined && isCpuPickoff(kind, situation)) {
    // 0x34848: 루 = rand(1,4) 를 주자 있는 루까지 반복 → 메시지 0x10 → 0x348d6(에필로그). 그 뒤 굴림은 없다
    return { kind: '견제', base: cpuPickoffBaseOf(cpuPickoff.hasRunnerOnBase, random) }
  }
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

  const pitch: Pitch = {
    type: isMagic ? magicPitchNameOf(repertoire.magicId, repertoire.form) ?? MAGIC_PITCH_NAME : type.name,
    plate: plateOf(finalTarget, situation.side),
    breakOffset: { x: type.horizontalBreak, y: type.verticalBreak },
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier,
    worldPath,
    stageSide: situation.side,
    magicNumber: magicState.ballMagicNumber,
    // 던질 때 값 — 0x46fa8 은 구질 22 일 때만 경기+0x1080 을 쓰고, 새 투구 준비 0x3d954 가 0 으로 지운다.
    // 0x3b55e 도 날아가는 도중 1 을 쓰지만(마구 1·4, 경로 번호 8 부터) 그건 그릴 때 magicBallKindAtPath 가 덮는다
    ballKind: isMagic ? magicBallKindOf(repertoire.magicId) : 0,
    // 이펙트 가리개 — 경기+0xfc8 == 0x16 과 투수 레코드 +0x18·폼을 그대로 실어 보낸다
    isMagicPitch: isMagic,
    pitcherMagicNumber: repertoire.magicId,
    pitcherForm: repertoire.form,
  }
  return { kind: '투구', pitch }
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
