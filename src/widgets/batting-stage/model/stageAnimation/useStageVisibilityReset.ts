import { useEffect } from 'react'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 탭이 다시 보이면 타석을 준비 상태로 되돌린다 — `useStageAnimation` 의 루프 effect 다음에 선다 */
export function useStageVisibilityReset(refs: StageRefs): void {
  const {
    buntRef,
    heldResultRef,
    hitSkipKeyTickRef,
    homeRunStartTickRef,
    keyLatch,
    particlesRef,
    pendingHitRef,
    phaseEntryRef,
    phaseRef,
    phaseStartTickRef,
    pitchJudgedRef,
    pitchRef,
    pitcherStartTickRef,
    resultTextRef,
    shownTicks,
    swingRef,
    swingStartTickRef,
  } = refs
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // 탭이 숨겨진 동안 requestAnimationFrame이 멈춘다. 돌아왔을 때 경과 시간이
      // 통째로 쌓여 있으면 진행 중이던 투구가 곧바로 스트라이크로 처리되므로
      // 타석을 다시 준비 상태로 되돌린다.
      phaseRef.current = '대기'
      phaseStartTickRef.current = gameSceneTickNow()
      phaseEntryRef.current = null
      keyLatch.clear()
      shownTicks.clear()
      hitSkipKeyTickRef.current = null
      pitchRef.current = null
      buntRef.current = null
      swingRef.current = null
      swingStartTickRef.current = null
      pitcherStartTickRef.current = null
      pitchJudgedRef.current = false
      heldResultRef.current = null
      pendingHitRef.current = null
      resultTextRef.current = ''
      homeRunStartTickRef.current = null
      // 쉬는 동안 밀린 연출은 버린다 (원본도 상태가 바뀔 때 목록을 비운다, 0x6dee4)
      clearParticles(particlesRef.current)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [
    buntRef,
    heldResultRef,
    hitSkipKeyTickRef,
    homeRunStartTickRef,
    keyLatch,
    particlesRef,
    pendingHitRef,
    phaseEntryRef,
    phaseRef,
    phaseStartTickRef,
    pitchJudgedRef,
    pitchRef,
    pitcherStartTickRef,
    resultTextRef,
    shownTicks,
    swingRef,
    swingStartTickRef,
  ])
}
