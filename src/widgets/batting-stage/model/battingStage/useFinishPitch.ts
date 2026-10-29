import { useCallback } from 'react'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingSwing, PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck, scenePatternDeckOf } from '@/entities/batting/model/battedBallOutcome'
import type { PatternDeck, ScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import { emitParticles } from '@/entities/particle/model/particleScene'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { SCENE_STATE, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { describeResolution, isHomeRunResolution } from '@/widgets/batting-stage/lib/stageText'
import type { StageLatest, StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import { pitchJudgeContextOf, type BatterMarks } from '@/widgets/batting-stage/model/battingStage/pitchJudgeContext'
import { contactLookOf, type JudgedContact, type SpecialSwingLook } from '@/widgets/batting-stage/model/battingStage/contactLook'
import { emitContactParticles, pendingHitOf, type EmitStageParticle } from '@/widgets/batting-stage/model/battingStage/pendingHit'
import { playContactSoundNow, vibratePitch } from '@/widgets/batting-stage/model/battingStage/pitchFeedback'
import type { ShowResult } from '@/widgets/batting-stage/model/battingStage/useShowResult'

/** 판정 틀 — 스윙(없으면 안 친 공)으로 이 공을 판정한다 (0x51408) */
export type FinishPitch = (swing: BattingSwing | null, tick: number) => void

/** 판정이 쓰는 칸 · 고리 */
export interface FinishPitchDeps {
  readonly refs: StageRefs
  readonly marks: BatterMarks
  readonly sceneBuntKindOfThisPitch: () => number
  readonly showResult: ShowResult
  /** 파티클 설정 표 — 다른 조각(`widgets/particles`)이라 부품이 넘긴다 */
  readonly particleConfigOf: (callId: number) => ParticleConfig | null
}

export function useFinishPitch({ refs, marks, sceneBuntKindOfThisPitch, showResult, particleConfigOf }: FinishPitchDeps): FinishPitch {
  const { aceBatterIndex, specialSwingNumber, isBatterOwnPlayer, careerYearIndex } = marks
  const { buntRef, deckRef, heldResultRef, hitSkipKeyTickRef, latestRef, particlesRef, pendingHitRef, phaseEntryRef, pitchRef } = refs
  const { pitchTypeNumberRef } = refs
  return useCallback(
    (swing: BattingSwing | null, tick: number) => {
      const pitch = pitchRef.current
      if (pitch === null) return
      const latest = latestRef.current
      const batterMarks = { aceBatterIndex, specialSwingNumber, isBatterOwnPlayer, careerYearIndex }
      // 장면 덱(0x3e340 이 경기 시작에 연 하나 — 같은 난수로 도는 진행기가 연다)을 CPU 타자와 같이 쓴다.
      // 장면을 열지 않은 화면(시험 · 장면 없는 연습)만 이 화면이 첫 공에 덱을 섞어 들고 있는다(웹 전용)
      const scene = scenePatternDeckOf(latest.random)
      const deck = judgeDeckOf(scene, deckRef.current, latest)
      const resolved = resolvePitch(pitch, swing, pitchJudgeContextOf(latest, pitch, swing, batterMarks), deck, latest.random)
      // 맞은 공은 판정 순간, 나머지는 결과(0x12)를 세울 때 울린다 (`vibratePitch`)
      const vibrateNow = () => vibratePitch(latest, resolved.detail, swing?.frame ?? null, pitch)
      // 타구 순간 소리(배트 · 헛스윙 바람 — 0x515de~0x5164a)는 판정 메시지를 받은 0x51408 이 **이 판정 틀**에 낸다. 심판 콜(0x12 진입 ·
      // 수비 판)은 뒤 틀이라 받는 쪽이 낸다 — 그래서 받는 쪽에는 이미 낸 소리를 비워 넘긴다(`contactSoundId: null`)
      playContactSoundNow(resolved.detail.contactSoundId)
      // 구질 번호(game+0xfc8)를 실어 보낸다 — 받는 쪽이 0xa5e14 처럼 상대 투수 투구 수·스태미나를 깎는다
      const detail = receivedDetailOf(resolved.detail, pitchTypeNumberRef.current)
      // 필살 성공(0x34c74 → 0x517e6)은 판정이 방향·패턴 뒤에 굴려 실어 준다 — 헛스윙이면 굴리지 않는다
      const isUncatchable = resolved.isUncatchable
      if (scene !== undefined) scene.deck = resolved.deck
      else deckRef.current = resolved.deck
      // 맞은 공이면 인플레이(0x17) 앞에 **상태 0x13** 을 한 번 거친다. 헛스윙·볼은 0x12 라 그냥 결과다.
      if (hasResultCode(detail)) {
        const hitRefs = { buntRef, hitSkipKeyTickRef, particlesRef, pendingHitRef, phaseEntryRef }
        const hitDeps = { refs: hitRefs, sceneBuntKindOfThisPitch, particleConfigOf, specialSwingNumber, aceBatterIndex }
        enterHitState(hitDeps, latest, { detail, deck: resolved.deck }, { pitch, swing, tick, isUncatchable, vibrateNow })
        return
      }
      // 맞지 않은 스윙(헛스윙 · 번트 헛맞음)은 0x51226 이 0x51840 으로 끝나 상태를 안 바꾼다 — 공 끝(틱 N + 1, 0x4e24e)의
      // 0x12 에서 결과가 선다. 그때까지 들고 있는다(`endPitch`). 안 친 공은 이미 공 끝이라 곧바로 세운다
      const show = (at: number) => {
        vibrateNow()
        showResult(detail, pitch, isUncatchable, at)
      }
      if (swing !== null) heldResultRef.current = show
      else show(tick)
    },
    [
      aceBatterIndex,
      specialSwingNumber,
      isBatterOwnPlayer,
      careerYearIndex,
      buntRef,
      deckRef,
      heldResultRef,
      hitSkipKeyTickRef,
      latestRef,
      particlesRef,
      pendingHitRef,
      phaseEntryRef,
      pitchRef,
      pitchTypeNumberRef,
      sceneBuntKindOfThisPitch,
      showResult,
      particleConfigOf,
    ],
  )
}

/** 판정에 쓰는 덱 — 장면 덱, 없으면 이 화면이 든 덱, 그것도 없으면 첫 공에 섞는다 */
function judgeDeckOf(scene: ScenePatternDeck | undefined, own: PatternDeck | null, latest: StageLatest): PatternDeck {
  return scene?.deck ?? own ?? createPatternDeck(latest.random)
}

/** 받는 쪽에 넘기는 판정 — 이 틀에 낸 타구 소리는 비우고 구질 번호(있으면)를 싣는다 */
function receivedDetailOf(detail: PitchOutcomeDetail, pitchTypeNumber: number | null): PitchOutcomeDetail {
  return { ...detail, contactSoundId: null, ...(pitchTypeNumber === null ? {} : { pitchTypeNumber }) }
}

function hasResultCode<T extends PitchOutcomeDetail>(detail: T): detail is T & { readonly resultCode: number } {
  return detail.resultCode !== null
}

/** 0x13 진입이 쓰는 칸 · 재료 */
interface HitStateDeps {
  readonly refs: Pick<StageRefs, 'buntRef' | 'hitSkipKeyTickRef' | 'particlesRef' | 'pendingHitRef' | 'phaseEntryRef'>
  readonly sceneBuntKindOfThisPitch: () => number
  readonly particleConfigOf: (callId: number) => ParticleConfig | null
  readonly specialSwingNumber: number
  readonly aceBatterIndex: number
}

/** 판정한 공 · 그 틀 */
interface JudgedAt {
  readonly pitch: Pitch
  readonly swing: BattingSwing | null
  readonly tick: number
  readonly isUncatchable: boolean
  readonly vibrateNow: () => void
}

/**
 * 맞은 판정 틀의 0x51408 — 515c0 메시지 0x11(0x50faa: 필살수비 · 표시 패턴 · 판 공 · [경기+0xf2c] 공 폴 굴림) · 517e6 필살타법을
 * 이 틀(아래 진동 0xbc5 · 0x13 예약 · 이 틀 그림의 불꽃보다 앞)에 굴린다 — 받는 쪽이 판 입력으로 미리 굴려 쏜 공을 돌려준다(A-37)
 */
function enterHitState(deps: HitStateDeps, latest: StageLatest, contact: JudgedContact, at: JudgedAt): void {
  const { refs } = deps
  const { detail } = contact
  const buntKindNow = deps.sceneBuntKindOfThisPitch()
  const shot = latest.onContact?.(detail, buntKindNow) ?? null
  at.vibrateNow()
  refs.buntRef.current = null
  const hitSide = latest.batterHand ?? batterSideOfForm(latest.batterForm)
  const special: SpecialSwingLook = {
    specialSwingNumber: deps.specialSwingNumber,
    batterForm: latest.batterForm,
    aceBatterIndex: deps.aceBatterIndex,
    hitSide,
  }
  const look = contactLookOf(contact, shot, at.pitch, at.swing, special)
  const emit: EmitStageParticle = (id, x, y, img) => emitParticles(refs.particlesRef.current, deps.particleConfigOf(id), x, y, img)
  emitContactParticles(emit, look, detail.resultCode, special)
  refs.pendingHitRef.current = pendingHitOf(look, {
    detail,
    pitch: at.pitch,
    isUncatchable: at.isUncatchable,
    // 홈런이면 판정 글자 대신 HOMERUN 글자 연출을 켠다 (원본 0x51cd8 의 +0x1960, 사운드 11 은 웹에 없음)
    isHomeRun: isHomeRunResolution(detail),
    resultText: describeResolution(detail),
    buntKind: buntKindNow,
    hitSide,
  })
  // 0x6aa 가 이 틀(판정 틱)의 갱신에서 0x13 을 예약한다 — 0x13 은 다음 틀이 틱 0 이다(`phaseEntryRef`)
  refs.hitSkipKeyTickRef.current = null
  refs.phaseEntryRef.current = { phase: '타격', tick: at.tick + 1 }
  markSceneStateEntries({ tick: at.tick + 1, state: SCENE_STATE.타격 })
}
