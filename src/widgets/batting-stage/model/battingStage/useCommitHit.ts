import { useCallback } from 'react'
import { SCENE_STATE, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { RESULT_PHASE_TICKS } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 상태 0x13 을 끝내고 인플레이(0x17)로 넘긴다 — 시간이 다 됐거나 OK/'5' 로 건너뛸 때 */
export function useCommitHit(refs: StageRefs): (tick: number) => void {
  const {
    hitSkipKeyTickRef,
    homeRunStartTickRef,
    inPlayEnteredTickRef,
    isHitByPitchResultRef,
    isInPlayResultRef,
    latestRef,
    pendingHitRef,
    phaseEntryRef,
    resultTextRef,
    resultTicksRef,
  } = refs
  return useCallback(
    (tick: number) => {
      const pending = pendingHitRef.current
      if (pending === null) return
      pendingHitRef.current = null
      // 016(id 15, 프레임 10)은 0x13 끝이 아니라 멈춤이 풀리는 0x13 그림(틱 7)이 쏜다 — 정정(2026-10-24, 0x4cb1c 4ccba~4cd14 직접
      // 떴다): `useStageAnimation` 의 0x13 그리기 몫(`hitPause.HIT_STOP_TICKS`)
      // 0x13 → 0x17 — 0x17 진입 0x46418(4673e)이 다음 틱에 파티클 관리자를 비운다 (`useStageAnimation`)
      inPlayEnteredTickRef.current = tick
      hitSkipKeyTickRef.current = null
      resultTextRef.current = pending.resultText
      // 0x13 갱신이 이 틀에 0x17 을 예약한다(40786~407b0 → 0xbcb49) — 다음 틀이 틱 0 이다(`phaseEntryRef`)
      homeRunStartTickRef.current = pending.isHomeRun ? tick + 1 : null
      // 맞은 공은 원본이 0x12 가 아니라 인플레이(0x17)로 간다 — 웹 결과 문구는 보통 결과 길이로 둔다
      resultTicksRef.current = RESULT_PHASE_TICKS
      isInPlayResultRef.current = true
      isHitByPitchResultRef.current = false
      phaseEntryRef.current = { phase: '결과', tick: tick + 1 }
      markSceneStateEntries({ tick: tick + 1, state: SCENE_STATE.인플레이 })
      latestRef.current.onPitchResolved(pending.detail, pending.pitch, pending.isUncatchable, pending.buntKind, tick)
    },
    [
      hitSkipKeyTickRef,
      homeRunStartTickRef,
      inPlayEnteredTickRef,
      isHitByPitchResultRef,
      isInPlayResultRef,
      latestRef,
      pendingHitRef,
      phaseEntryRef,
      resultTextRef,
      resultTicksRef,
    ],
  )
}
