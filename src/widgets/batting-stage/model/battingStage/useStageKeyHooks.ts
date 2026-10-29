import { useCallback, useEffect, useMemo } from 'react'
import { remainingAfterSpecialSwing } from '@/entities/batting/model/specialSwing'
import type { StageRefs, SwingReservation } from '@/widgets/batting-stage/model/stageRefs'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'
import { createStageActions, type StageActionDeps } from '@/widgets/batting-stage/model/battingStage/stageActions'

/** 타석 키 동작 — 칸 · 필살 표지가 바뀔 때만 새로 만든다 */
export function useStageActions(deps: StageActionDeps): StageActions {
  const { refs, sceneBuntKindRef, sceneBuntKindOfThisPitch, specialSwingNumber, aceBatterIndex, specialSwingRemaining } = deps
  const { buntRef, hitSkipKeyTickRef, latestRef, pendingHitRef, phaseEntryRef, phaseRef, phaseStartTickRef, pitchRef, shiftRef, swingRef } = refs
  return useMemo(
    () =>
      createStageActions({
        refs: { buntRef, hitSkipKeyTickRef, latestRef, pendingHitRef, phaseEntryRef, phaseRef, phaseStartTickRef, pitchRef, shiftRef, swingRef },
        sceneBuntKindRef,
        sceneBuntKindOfThisPitch,
        specialSwingNumber,
        aceBatterIndex,
        specialSwingRemaining,
      }),
    [
      specialSwingNumber,
      aceBatterIndex,
      specialSwingRemaining,
      buntRef,
      hitSkipKeyTickRef,
      latestRef,
      pendingHitRef,
      phaseEntryRef,
      phaseRef,
      phaseStartTickRef,
      pitchRef,
      sceneBuntKindOfThisPitch,
      sceneBuntKindRef,
      shiftRef,
      swingRef,
    ],
  )
}

/** 스윙이 나가는 틱(F + 1, 0x4e0ce) — 필살이면 남은 횟수 −1 (0x4e136: S+0x10 ≠ 0 && 남은 > 0, 결과와 무관) */
export function useReleaseSwing(
  specialSwingRemaining: number | undefined,
  onSpecialSwingUsed: ((remaining: number) => void) | undefined,
): (swing: SwingReservation) => void {
  return useCallback(
    (swing: SwingReservation) => {
      if (!swing.isSpecial) return
      if (specialSwingRemaining !== undefined && specialSwingRemaining > 0) {
        onSpecialSwingUsed?.(remainingAfterSpecialSwing(specialSwingRemaining))
      }
    },
    [specialSwingRemaining, onSpecialSwingUsed],
  )
}

/**
 * 상태 0x11 인가 — 도루 키(0x53610)를 받는 화면이 묻는다. 0x53670 은 0x11 **전체**(와인드업 포함, 공 틱이 0 인 동안도)에서
 * 0x53610 을 부르므로 릴리스 전도 참이다. 0x11 은 맞은 공의 판정(→ 0x13)이나 공 끝(틱 N + 1 → 0x12)까지 이어진다
 */
export function useFlightProbe(refs: StageRefs, flightProbeRef: { current: (() => boolean) | null } | undefined): void {
  const { phaseRef, pitchRef } = refs
  useEffect(() => {
    if (flightProbeRef === undefined) return
    flightProbeRef.current = () => phaseRef.current === '투구중' && pitchRef.current !== null
    return () => {
      flightProbeRef.current = null
    }
  }, [flightProbeRef, phaseRef, pitchRef])
}
