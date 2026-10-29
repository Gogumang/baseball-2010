import { useEffect, useLayoutEffect, useRef } from 'react'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { StageHandlers } from '@/widgets/batting-stage/model/stageAnimation/stageHandlers'
import { startStageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageFrame'
import { useStageVisibilityReset } from '@/widgets/batting-stage/model/stageAnimation/useStageVisibilityReset'
import type { StageParticleKit } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { particleSignatureOf } from '@/widgets/particles/lib/particleSignature'
import { preloadPtcParts } from '@/widgets/particles/lib/renderParticles'

/** 루프가 쓰는 파티클 도구 — 다른 조각(`widgets/particles`)이라 여기서 묶어 넘긴다 */
const STAGE_PARTICLE_KIT: StageParticleKit = {
  configOf: particleConfigOf,
  signatureOf: particleSignatureOf,
  preloadParts: preloadPtcParts,
}

/**
 * 캔버스 애니메이션 루프와 투구 단계 진행. 루프 한 틀의 차례(진입 → 키 → 갱신 → 파티클 틱 → 그림)는 `stageAnimation/stageFrame`,
 * 단계 갱신은 `stageAnimation/advancePhase`, 그림 입력은 `stageAnimation/stageSceneNow` 가 든다. 이 훅은 루프를 세우고 거두는 때만 정한다.
 */
export function useStageAnimation(refs: StageRefs, handlers: StageHandlers) {
  const {
    canvasRef,
    pitchRef,
    pitchTypeNumberRef,
    phaseRef,
    phaseStartTickRef,
    phaseEntryRef,
    hitSkipKeyTickRef,
    keyLatch,
    shownTicks,
    resultTextRef,
    homeRunStartTickRef,
    swingStartTickRef,
    pitcherStartTickRef,
    shiftRef,
    buntRef,
    pendingHitRef,
    resultTicksRef,
    isInPlayResultRef,
    isHitByPitchResultRef,
    swingRef,
    pitchJudgedRef,
    heldResultRef,
    particlesRef,
    inPlayEnteredTickRef,
    latestRef,
  } = refs
  // 고리는 남은 필살 횟수 같은 props 로 자주 바뀐다 — 루프를 다시 세우면 투구 시작 시각이 지워지므로 ref 로 읽는다
  const handlersRef = useRef(handlers)
  useMirrorRef(handlersRef, handlers)
  /**
   * 쉬기(`isPaused`)가 풀린 커밋의 장면 틱 — 쉬기를 푸는 쪽(견제 판 끝 `finishRunnerPlay` · 0xe 의 OK)은 원본에서 그 틀의 갱신이 다음
   * 상태를 예약하는 자리라(0xbcb48 → 다음 틀 0xbc9c8 이 틱 0) 다음 틀이 0xf 틱 0 이다. 루프가 쉬는 '대기' 를 본 뒤에만 쓴다
   */
  const resumeTickRef = useRef<number | null>(null)
  // 첫 커밋은 비교만 하고 넘어간다 — 첫 값이 무엇이든 `앞 && !지금` 이 거짓이다(첫 그림의 쉬기와 첫 커밋의 쉬기는 같은 값)
  const pausedAtCommitRef = useRef(false)
  useLayoutEffect(() => {
    const isPaused = latestRef.current.isPaused
    if (pausedAtCommitRef.current && !isPaused) resumeTickRef.current = gameSceneTickNow()
    pausedAtCommitRef.current = isPaused
  })

  useEffect(
    () =>
      startStageLoop(
        {
          canvasRef,
          pitchRef,
          pitchTypeNumberRef,
          phaseRef,
          phaseStartTickRef,
          phaseEntryRef,
          hitSkipKeyTickRef,
          keyLatch,
          shownTicks,
          resultTextRef,
          homeRunStartTickRef,
          swingStartTickRef,
          pitcherStartTickRef,
          shiftRef,
          buntRef,
          pendingHitRef,
          resultTicksRef,
          isInPlayResultRef,
          isHitByPitchResultRef,
          swingRef,
          pitchJudgedRef,
          heldResultRef,
          particlesRef,
          inPlayEnteredTickRef,
          latestRef,
          handlersRef,
          resumeTickRef,
        },
        STAGE_PARTICLE_KIT,
      ),
    // ref 묶음은 값이 바뀌지 않는다. 고리는 handlersRef 로 읽는다 — 루프를 다시 세우는 때는 예전처럼 판정 · 0x13 고리가 바뀔 때뿐이다
    // (타자가 바뀌면 판정 고리가 바뀐다). 필살 횟수로 바뀌는 고리(releaseSwing · endPitch)는 투구 도중이라 다시 세우지 않는다
    [
      handlers.judgePitch,
      handlers.commitHit,
      buntRef,
      canvasRef,
      heldResultRef,
      hitSkipKeyTickRef,
      homeRunStartTickRef,
      inPlayEnteredTickRef,
      isHitByPitchResultRef,
      isInPlayResultRef,
      keyLatch,
      latestRef,
      particlesRef,
      pendingHitRef,
      phaseEntryRef,
      phaseRef,
      phaseStartTickRef,
      pitchJudgedRef,
      pitchRef,
      pitchTypeNumberRef,
      pitcherStartTickRef,
      resultTextRef,
      resultTicksRef,
      shiftRef,
      shownTicks,
      swingRef,
      swingStartTickRef,
    ],
  )

  useStageVisibilityReset(refs)
}
