import { useCallback, useState } from 'react'
import { useLastRenderValue } from '@/shared/lib/renderMachine/useLastRenderValue'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { useIsSceneConfirmAwaiting } from '@/features/play-game/model/useSceneConfirm'
import type { RecordAlertScene } from '@/pages/game/ui/GameScreen'
import { useDefenseUnderBurstWindow } from '@/pages/defense/model/useDefenseUnderBurstWindow'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'

/** 돌발 제안 · 판정 창과 기록 달성 알림 장면 칸 */
export function useBurstAndAlertScene({ session, progress }: Pick<GameRouteProps, 'session' | 'progress'>) {
  /** 제안 대사를 이미 보여 준 돌발 행. 판정은 진행기가 지워 주므로 여기서 셀 것이 없다 */
  const [shownProposal, setShownProposal] = useState<BurstMissionRow | null>(null)
  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  /**
   * 돌발 제안 창(0x1b)은 상태 0xe 의 **OK 뒤**에 선다 — OK 메시지 1 의 0x50c18 이 0xf 를 예약한 뒤 0x50c42 의 0x8f158 이
   * 뜨면 그 예약을 0x1b 로 덮는다. 같은 걸음에 0xe 를 두 번 지나면(CPU 투수 교체 뒤 다시 굴려 뜬 돌발) 두 OK 를 다 받은 뒤다.
   */
  const isAwaitingConfirm = useIsSceneConfirmAwaiting(progress.sceneConfirm)
  /** 팝업이 떠 있으면 0x12 상태 틱이 멈춘다(0x52cc6) — 아래 알림 장면 칸을 밀어내기 판 대기도 본다 */
  const [alertScene, setAlertScene] = useState<RecordAlertScene>({ isFrozen: false, key: 'play' })
  /** 지난 그림의 알림 멈춤 — 아래 두 고리는 알림 장면이 이 그림에 고친 값을 한 그림 뒤에 본다(옛 차례) */
  const alertSceneFrozenBefore = useLastRenderValue(alertScene.isFrozen, false)
  const proposal = burst !== null && burst.current !== null && burst.current !== shownProposal && !isAwaitingConfirm ? burst.current : null
  const closeProposal = useCallback(() => setShownProposal(proposal), [proposal])
  const { closeBurstResult } = session.actions
  /** 판 끝에서 난 돌발 판정(상태 0x1c)이면 그 판을 창 아래에 이어 그린다 (`useDefenseUnderBurstWindow`) */
  const defenseUnderBurst = useDefenseUnderBurstWindow(resolution)
  return { burst, resolution, alertScene, setAlertScene, alertSceneFrozenBefore, proposal, closeProposal, closeBurstResult, defenseUnderBurst }
}
