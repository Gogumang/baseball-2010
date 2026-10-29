import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { memoryAceMatchPendingAtom, portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'

/**
 * 콜백이 읽는 지난 그림 값을 그림마다 상자에 적는다 — 내보인 커리어(캔버스 고리 · 콜백이 읽는다, `useAtBatRunner` 의 `atBatRef` 와
 * 같은 이유)와 손잡이들(콜백 신원이 흔들리지 않게). 그리는 중에 읽는 곳은 없다.
 */
export function useCareerMirrors(scope: CareerScope, career: PlayerCareer | null): void {
  const { atoms, nariGameSave, aceMatchPending, aceMatchHold, runningModeManual, onManagementBgmRestart } = scope
  const memoryAceMatchPending = useCareerValue(atoms, memoryAceMatchPendingAtom)
  useMirrorRef(useCareerValue(atoms, shownCareerMirrorAtom), career)
  useMirrorRef(useCareerValue(atoms, portsMirrorAtom), {
    nariGameSave,
    aceMatchPending: aceMatchPending ?? memoryAceMatchPending,
    aceMatchHold,
    runningModeManual,
    onManagementBgmRestart,
  })
}
