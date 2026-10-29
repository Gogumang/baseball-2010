/**
 * **타석 연출의 가변 칸** — 루프가 그림마다 읽고 고치는 ref 묶음(`useStageRefs`)과 그 칸에 드는 값의 꼴.
 *
 * - 단계 · 마투수 그림 재료 · 번트 자세 · 스윙 예약(`stagePhase`) · 0x13 이 붙잡은 타격 결과(`pendingHit`)
 * - 그림마다 최신 값을 읽는 props 묶음(`stageLatest`) · 스킬 판 · 정산 효과 재료(`stageSources`)
 * - ref 칸 목록(`stageRefSlots`) · 공 프레임 F(`ballFrame`)
 *
 * 파티클 관리자(`widgets/particles` 의 `sceneParticleScene`)를 처음 값으로 받는 훅은 이 파일에 둔다 — 조각 경계 예외가 이 파일 하나다.
 */
import { useRef, useState } from 'react'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { createSceneKeyLatch } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { createShownSceneTicks } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'
import { RESULT_PHASE_TICKS } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import type { PendingHit } from '@/widgets/batting-stage/model/stageRefs/pendingHit'
import type { StageLatest } from '@/widgets/batting-stage/model/stageRefs/stageLatest'
import type { BuntStance, StagePhase, SwingReservation } from '@/widgets/batting-stage/model/stageRefs/stagePhase'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs/stageRefSlots'

export { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs/stagePhase'
export type { StageHud, AcePitcherFrames, BuntStance, SwingReservation } from '@/widgets/batting-stage/model/stageRefs/stagePhase'
export type { PendingHit } from '@/widgets/batting-stage/model/stageRefs/pendingHit'
export type { StageLatest } from '@/widgets/batting-stage/model/stageRefs/stageLatest'
export type {
  SkillPanelSource,
  PitcherSideSkillPanelSource,
  SettlementEffectSource,
  SettlementEffectLayers,
} from '@/widgets/batting-stage/model/stageRefs/stageSources'
export type { StageRefs } from '@/widgets/batting-stage/model/stageRefs/stageRefSlots'
export { ballFrameOf, ballFrameStartTick } from '@/widgets/batting-stage/model/stageRefs/ballFrame'

/**
 * 타석 연출의 가변 상태를 전부 ref로 든다.
 * 매 프레임 최신 값을 읽어야 하고, props가 바뀌어도 애니메이션 루프를
 * 다시 시작하면 안 되기 때문이다.
 */
export function useStageRefs(latest: StageLatest): StageRefs {
  const latestRef = useRef(latest)
  useMirrorRef(latestRef, latest)

  return {
    canvasRef: useRef<HTMLCanvasElement>(null),
    pitchRef: useRef<Pitch | null>(null),
    pitchTypeNumberRef: useRef<number | null>(null),
    phaseRef: useRef<StagePhase>('대기'),
    phaseStartTickRef: useRef(0),
    phaseEntryRef: useRef<{ readonly phase: StagePhase; readonly tick: number } | null>(null),
    hitSkipKeyTickRef: useRef<number | null>(null),
    resultTextRef: useRef(''),
    homeRunStartTickRef: useRef<number | null>(null),
    swingStartTickRef: useRef<number | null>(null),
    pitcherStartTickRef: useRef<number | null>(null),
    shiftRef: useRef(0),
    buntRef: useRef<BuntStance | null>(null),
    deckRef: useRef<PatternDeck | null>(null),
    pendingHitRef: useRef<PendingHit | null>(null),
    swingRef: useRef<SwingReservation | null>(null),
    pitchJudgedRef: useRef(false),
    heldResultRef: useRef<((tick: number) => void) | null>(null),
    resultTicksRef: useRef(RESULT_PHASE_TICKS),
    isInPlayResultRef: useRef(false),
    isHitByPitchResultRef: useRef(false),
    particlesRef: useRef<ParticleScene>(sceneParticleScene()),
    inPlayEnteredTickRef: useRef<number | null>(null),
    pointerDownAtRef: useRef(0),
    ...useState(() => {
      const shownTicks = createShownSceneTicks()
      const keyLatch = createSceneKeyLatch(gameSceneTickNow, (inputTime) => shownTicks.tickSeenAt(inputTime, gameSceneTickNow()))
      return { keyLatch, shownTicks }
    })[0],
    latestRef,
  }
}
