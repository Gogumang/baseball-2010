/** 맞은 판정 틀 — 타격점 파티클을 쏘고, 0x13 이 그릴 재료(`PendingHit`)를 모은다 */
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { hitBallTrajectoryOf, hitPauseTicksOf } from '@/widgets/batting-stage/lib/hitPause'
import { hitBallPathOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { hitCameraAngleOf } from '@/widgets/batting-stage/lib/hitCamera'
import {
  HIT_PARTICLE_IMAGE,
  hitParticleInputOf,
  isHomeRunHitResult,
  isStrongHit,
  specialSwingParticlesOf,
} from '@/widgets/batting-stage/lib/hitParticles'
import { hitFlameAnimationOf } from '@/widgets/batting-stage/lib/batterOverlayMarks'
import type { PendingHit } from '@/widgets/batting-stage/model/stageRefs'
import { plainHitParticleIdOf, plainHitPatternOf } from '@/widgets/batting-stage/model/battingStage/contactLook'
import type { ContactLook, SpecialSwingLook } from '@/widgets/batting-stage/model/battingStage/contactLook'

/** 타석 파티클 칸에 쏜다 (id · x · y · 그림) */
export type EmitStageParticle = (id: number, x: number, y: number, img: number) => void

/** 판정 틀 그리기 0x49e64 의 타격점 파티클 — 필살 그림 갈래면 필살 파티클, 아니면 보통 ptc */
export function emitContactParticles(emit: EmitStageParticle, look: ContactLook, resultCode: number, special: SpecialSwingLook): void {
  const { contact } = look
  if (look.specialEffect !== null && contact !== null) {
    for (const shot of specialSwingParticlesOf(special.specialSwingNumber, special.batterForm, special.aceBatterIndex)) {
      emit(shot.id, contact.x, contact.y + shot.offsetY, shot.img)
    }
    return
  }
  const pattern = plainHitPatternOf(look)
  if (pattern === null || contact === null) return
  const particleId = plainHitParticleIdOf(look, pattern, resultCode)
  if (particleId !== null) emit(particleId, contact.x, contact.y, HIT_PARTICLE_IMAGE)
}

/** 이 0x13 의 판정 · 공 재료 */
export interface PendingHitSource {
  readonly detail: PitchOutcomeDetail & { readonly resultCode: number }
  readonly pitch: Pitch
  readonly isUncatchable: boolean
  readonly isHomeRun: boolean
  readonly resultText: string
  readonly buntKind: number
  readonly hitSide: number
}

export function pendingHitOf(look: ContactLook, source: PendingHitSource): PendingHit {
  const { pattern, contact, specialEffect, watchesBigHit } = look
  const { resultCode } = source.detail
  const flameAnimation = hitFlameAnimationNowOf(look, resultCode)
  return {
    // 0x13 진입 0x33e34 — [경기+0xf2c] 공(수평각 d 다른 공)의 점을 옮겨 타석 공 경로를 다시 채운다(`hitBallPath`)
    hitPath: pattern === null ? null : hitBallPathOf(hitBallTrajectoryOf(pattern, source.hitSide), source.hitSide),
    showsHitTrail: showsHitTrailOf(look, resultCode),
    // 0x13 카메라(0x3f060 3f23e)가 보는 판정 각 [+0xfcc] — 판 패턴 각의 부호를 뒤집은 값
    hitAngle: pattern === null ? null : hitCameraAngleOf(pattern[0]),
    ticks: hitPauseTicksOf(look.pauseInput),
    detail: source.detail,
    pitch: source.pitch,
    isUncatchable: source.isUncatchable,
    isHomeRun: source.isHomeRun,
    // 큰 타구 멈춤이 풀리는 0x13 그림(틱 7)에 016 을 쏜다 (0x4cb1c → 0x4cd14, `useStageAnimation`)
    bigHitAt: watchesBigHit ? contact : null,
    watchesBigHit,
    resultText: source.resultText,
    buntKind: source.buntKind,
    specialEffect: specialEffect === null || contact === null ? null : { ...specialEffect, x: contact.x, y: contact.y },
    hitFlame: flameAnimation === null || contact === null ? null : { animation: flameAnimation, x: contact.x, y: contact.y },
  }
}

/** 같은 갈래의 그림 — game_effect 애니 2 · 3 을 타격점에 (49fe6~4a0a2, `batterOverlayMarks`). 고르기는 ptc 와 같은 판정이다 */
function hitFlameAnimationNowOf(look: ContactLook, resultCode: number): number | null {
  const pattern = plainHitPatternOf(look)
  if (pattern === null) return null
  return hitFlameAnimationOf(plainHitParticleIdOf(look, pattern, resultCode), look.watchesBigHit)
}

/** 꼬리선 — 강한 타구(0x35988) · 결과 코드 24~26(0x357e0)일 때만(3b440) */
function showsHitTrailOf(look: ContactLook, resultCode: number): boolean {
  const { pattern } = look
  if (pattern === null) return false
  if (isHomeRunHitResult(resultCode)) return true
  // 0x35988 머리 359a0 — 스윙 객체 [+0xf9c]+8(번트 자세)이 서 있으면 거짓
  return !look.isBuntStance && isStrongHit(hitParticleInputOf(pattern, resultCode, look.watchesBigHit))
}
