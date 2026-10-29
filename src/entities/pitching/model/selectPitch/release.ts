import type { Pitch, PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pitchSpeedStageOf } from '@/entities/pitching/model/pitchSpeedStage'
import { rollDisplaySpeedKmh } from '@/entities/pitching/model/displaySpeed'
import { applyControlError, derbyPitchTargetOf } from '@/entities/pitching/model/pitchTarget'
import { pitchPathOf, type WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { advanceMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { magicBallKindOf, magicPitchRecordIndexOf } from '@/entities/pitching/model/selectPitch/otherSlices'
import { DEFAULT_REPERTOIRE, isMagicTypeNumber, pitchNameOf, pitchTypeRowOf, plateOf } from '@/entities/pitching/model/selectPitch/pitchFace'
import { releaseStatsOf, rollControlTier, rollMistakePitch, type ReleaseStats } from '@/entities/pitching/model/selectPitch/releaseStats'
import type { CpuPitchArgs, CpuPitchThrow } from '@/entities/pitching/model/selectPitch/types'

/**
 * 실투 공의 점 수 N — 0x4dec0: 구질(+0xfc8) == 1 이면 0x12(18), 아니면 0x14(20) 를 +0x109c 에 쓰고
 * 0x9e301(공, N) 로 공 점 수를 바꾼다
 */
const MISTAKE_PITCH_FRAMES_FASTBALL = 18
const MISTAKE_PITCH_FRAMES = 20
const FASTBALL_TYPE_NUMBER = 1

/**
 * 4dcc6~4dcd2: 홈런더비(장면 [+0x1104] == 7)면 0x4de60 으로 뛰어 4dcd4~4de5e 를 통째로 건너뛴다 —
 * 그림 칸 [+0x17bc] = t + 3(4dce0) · 흩어짐 rand(0,100)(4dcf6) · 반지름 · 방향 굴림이 모두 없어 목표점(존 한가운데)
 * 그대로 던진다. 0x4de60 뒤(0xb6e25 · 궤적 준비 0x9e669 · 실투 0x33cbc · 곡선)는 더비에서도 그대로 돈다
 */
function rollAimedTarget(isHomeRunDerby: boolean, target: WorldPoint, controlTier: number, random: RandomPort): WorldPoint {
  if (isHomeRunDerby) return target
  return applyControlError(target, { tier: controlTier, isComputer: true }, random)
}

const mistakeFramesOf = (typeNumber: number) => (typeNumber === FASTBALL_TYPE_NUMBER ? MISTAKE_PITCH_FRAMES_FASTBALL : MISTAKE_PITCH_FRAMES)

interface ReleasedPathInput {
  readonly typeNumber: number
  readonly repertoire: PitcherRepertoireInfo
  readonly release: ReleaseStats
  readonly controlTier: number
  readonly isMistake: boolean
  readonly finalTarget: WorldPoint
}

/**
 * 곡선 — 0x4df36~0x4df5e: 0x9e3c9(공, 투수판 0xcfa8c, 목표점) 를 실투 판정 **뒤** 한 번 부른다(굴림 없음).
 * 실투면 그 앞(0x4dec0~0x4df34)에서 N = 구질 1 ? 18 : 20 으로 공 점 수를 바꾸고(0x9e301) 목표점을 제구 오차
 * 낸 점 대신 타자 좌우별 존 한가운데(표 0xcfbcc[+0x17e1])로 바꾼다 — 레코드·구속 단계(0x9e669)는 그대로다.
 * 마구는 게이지를 쓰지 않고 등급이 늘 5 다 — 구속 단계 레코드가 없어 번호로 곧장 고른다 (H2 3-5·3-6)
 */
function releasedPathOf(input: ReleasedPathInput) {
  const { typeNumber, repertoire } = input
  const speedStage = pitchSpeedStageOf(typeNumber - 1, input.release.stats, input.controlTier)
  const recordIndex = isMagicTypeNumber(typeNumber) ? magicPitchRecordIndexOf(repertoire.magicId, repertoire.form) : null
  return pitchPathOf({
    typeNumber,
    form: repertoire.form,
    speedStage,
    target: input.finalTarget,
    ...(recordIndex === null ? {} : { recordIndex }),
    ...(input.isMistake ? { frames: mistakeFramesOf(typeNumber) } : {}),
  })
}

interface ReleasedPitchInput {
  readonly args: CpuPitchArgs
  readonly typeNumber: number
  readonly target: WorldPoint
  readonly finalTarget: WorldPoint
  readonly worldPath: readonly WorldPoint[]
  readonly controlTier: number
  readonly displaySpeedKmh: number
  readonly ballMagicNumber: number
  readonly staminaPercent: number | undefined
}

/** 놓은 공 — 그림 · 판정이 읽는 칸 */
function releasedPitchOf(input: ReleasedPitchInput): Pitch {
  const { args, typeNumber, worldPath, staminaPercent } = input
  const { pitcher, situation } = args
  const repertoire = pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const isMagic = isMagicTypeNumber(typeNumber)
  const type = pitchTypeRowOf(typeNumber)
  return {
    type: pitchNameOf(typeNumber, repertoire),
    plate: plateOf(input.finalTarget, situation.side),
    // 이글아이가 그리는 0x10 목표점(+0x10b8) — 오차 · 실투 바꾸기 전 점
    aimTarget: input.target,
    breakOffset: { x: type.horizontalBreak, y: type.verticalBreak },
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    controlTier: input.controlTier,
    worldPath,
    stageSide: situation.side,
    displaySpeedKmh: input.displaySpeedKmh,
    magicNumber: input.ballMagicNumber,
    // 던질 때 값 — 0x46fa8 은 구질 22 일 때만 경기+0x1080 을 쓰고, 새 투구 준비 0x3d954 가 0 으로 지운다.
    // 0x3b55e 도 날아가는 도중 1 을 쓰지만(마구 1·4, 경로 번호 8 부터) 그건 그릴 때 magicBallKindAtPath 가 덮는다
    ballKind: isMagic ? magicBallKindOf(repertoire.magicId) : 0,
    // 이펙트 가리개 — 경기+0xfc8 == 0x16 과 투수 레코드 +0x18·폼을 그대로 실어 보낸다
    isMagicPitch: isMagic,
    pitcherMagicNumber: repertoire.magicId,
    pitcherForm: repertoire.form,
    // 깎은 뒤 체력% — 사람 스윙 판정 0xab214 가 같은 값을 본다
    ...(pitcher.staminaPercentAfterPitch === undefined || staminaPercent === undefined ? {} : { pitcherStaminaPercent: staminaPercent }),
  }
}

/**
 * **상태 0x11 틱 10 의 공 놓기 0x4dc78** (0x4e078) — 제구 등급 · 제구 오차 · 실투 · 곡선. `typeNumber` 는 0xf 의 마지막
 * 구질, `target` 은 0x10 의 목표점이다. 굴림 차례: 제구 등급 → 표시 구속 → 제구 오차 → 실투 (곡선 · 마구 소모는 굴림 없음)
 */
export function releaseCpuPitch(args: CpuPitchArgs, typeNumber: number, target: WorldPoint, random: RandomPort): CpuPitchThrow {
  const { pitcher, situation, batterIntimidates } = args
  const repertoire = pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const magicState = args.magic ?? { remaining: 0, ballMagicNumber: 0 }
  const isHomeRunDerby = args.derbyPitchType !== undefined
  const release = releaseStatsOf(pitcher, typeNumber)
  const isMagic = isMagicTypeNumber(typeNumber)
  const controlTier = rollControlTier(isMagic, release, random)
  // 0x34968(4dcc2) — 표시 구속 [+0x19a0] 을 등급 **뒤** · 흩어짐 **앞**에 한 번 굴린다 (`displaySpeed`)
  const displaySpeedKmh = rollDisplaySpeedKmh(
    { typeNumber, stats: release.stats, controlTier, magicNumber: repertoire.magicId, form: repertoire.form },
    random,
  )
  const aimedTarget = rollAimedTarget(isHomeRunDerby, target, controlTier, random)
  const isMistake = rollMistakePitch({ isMagic, controlTier, release, pitcher, situation, batterIntimidates }, random)
  const finalTarget = isMistake ? derbyPitchTargetOf(situation.side) : aimedTarget
  const worldPath = releasedPathOf({ typeNumber, repertoire, release, controlTier, isMistake, finalTarget })

  advanceMagicPitchGameState(magicState, typeNumber, repertoire.magicId, isHomeRunDerby)

  const pitch = releasedPitchOf({
    args,
    typeNumber,
    target,
    finalTarget,
    worldPath,
    controlTier,
    displaySpeedKmh,
    ballMagicNumber: magicState.ballMagicNumber,
    staminaPercent: release.staminaPercent,
  })
  return { kind: '투구', pitch, pitchTypeNumber: typeNumber, isMistakePitch: isMistake }
}
