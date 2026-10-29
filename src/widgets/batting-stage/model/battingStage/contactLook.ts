/**
 * 맞은 판정 틀의 그림 재료 — 0x13 이 보는 패턴 · 멈춤 · 타격점 · 필살 그림 갈래 · 불꽃 · 타구 공 경로.
 * 타격 순간 불꽃 (0x49e64 → 0x4a0ca) — 타격점은 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라(4a03a · 필살 49b02 · 큰 타구 4cb80).
 * +0x10dc 는 놓기 0x4dc78(4dffa~4e024)만 적는 공 도착점(경로 끝 점의 투영)이라 `platePixelOf` 다 (r184 직접 떴다)
 */
import type { BattingSwing, PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { lastDrawnPattern, type PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { isBigHit, launchedPauseInputOf, pauseInputOf, type LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import { hitParticleIdOf, hitParticleInputOf } from '@/widgets/batting-stage/lib/hitParticles'
import { specialSwingStageEffectOf, type SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'
import { platePixelOf } from '@/widgets/batting-stage/lib/trajectory'

/** 판정이 낸 맞은 공 — 결과 코드가 선 것 */
export interface JudgedContact {
  readonly detail: PitchOutcomeDetail & { readonly resultCode: number }
  readonly deck: PatternDeck
}

export interface ContactLook {
  /** 0x13 이 보는 +0xfcc — 덱에도 없으면 null */
  readonly pattern: BattedBallPattern | null
  readonly pauseInput: ReturnType<typeof pauseInputOf>
  readonly watchesBigHit: boolean
  /** 타격점 — 안 친 공(스윙 없음)이면 null */
  readonly contact: { readonly x: number; readonly y: number } | null
  /** 49faa 스윙 객체 S+8(번트 자세) */
  readonly isBuntStance: boolean
  /** 필살 스윙이 탄 0x49aec 그림 갈래 — 아니면 null */
  readonly specialEffect: SpecialSwingStageEffect | null
}

/** 필살 스윙의 그림 재료 (props) */
export interface SpecialSwingLook {
  readonly specialSwingNumber: number
  readonly batterForm: number
  readonly aceBatterIndex: number
  readonly hitSide: number
}

/**
 * 0x13 이 보는 +0xfcc — 메시지 0x11 이 고친 표시 패턴(창이 열렸으면), 아니면 쏜 패턴(0x514f2 특수 표 덮어쓰기 뒤). 쏜 공을 모르는
 * 결과(시험)만 덱에서 방금 꺼낸 패턴이다
 */
function launchedPatternOf(judged: JudgedContact, shot: LaunchedShot | null): BattedBallPattern | null {
  const { detail } = judged
  const shotContact = detail.resolution.kind === '타구' ? contactOfOutcome(detail.resolution.outcome) : detail.foulContact
  return shot?.launchedPattern ?? shotContact?.pattern ?? lastDrawnPattern(judged.deck, detail.resultCode)
}

export function contactLookOf(
  judged: JudgedContact,
  shot: LaunchedShot | null,
  pitch: Pitch,
  swing: BattingSwing | null,
  look: SpecialSwingLook,
): ContactLook {
  const { resultCode } = judged.detail
  const pattern = launchedPatternOf(judged, shot)
  const pauseInput =
    pattern === null ? pauseInputOf(resultCode, judged.deck, look.hitSide) : launchedPauseInputOf(resultCode, pattern, look.hitSide, shot?.trajectory)
  // 필살 스윙(S+0x10)이 0x49aec 의 그림 갈래를 타면 그 함수가 [sp+0x60] = 1 을 세워 보통 불꽃(49faa~4a0ce)을 건너뛰고,
  // 같은 타격점에 필살 파티클을 쏜다(49dbc · 49de0) — 0x49aec 는 0x13 · 맞은 공에서만 불리므로 헛스윙엔 아무것도 없다
  // 49faa 스윙 객체 S+8(번트 자세 — 0xb93a8 이 쓰는 번트 종류) ≠ 0 이면 보통 불꽃 · ptc 를 건너뛴다(직접 뜸, r215).
  // 번트 판정은 자세가 선 채 나므로(`buntStance`) 맞은 번트에는 불꽃 · 007/006 이 없다
  return {
    pattern,
    pauseInput,
    watchesBigHit: isBigHit(pauseInput),
    contact: swing === null ? null : platePixelOf(pitch),
    isBuntStance: (swing?.buntKind ?? 0) !== 0,
    specialEffect:
      swing?.isSpecial === true ? specialSwingStageEffectOf(look.specialSwingNumber, look.batterForm, look.aceBatterIndex, look.hitSide) : null,
  }
}

/** 보통 타격 불꽃 · ptc 를 고르는 패턴 — 필살 그림 갈래 · 번트 자세 · 패턴 없음 · 안 친 공이면 null */
export function plainHitPatternOf(look: ContactLook): BattedBallPattern | null {
  if (look.specialEffect !== null || look.isBuntStance || look.contact === null) return null
  return look.pattern
}

/** 보통 타격 ptc id (`hitParticleIdOf`) */
export function plainHitParticleIdOf(look: ContactLook, pattern: BattedBallPattern, resultCode: number): number | null {
  return hitParticleIdOf(hitParticleInputOf(pattern, resultCode, look.watchesBigHit))
}
