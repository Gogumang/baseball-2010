import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'
import { useGameSceneSetup } from '@/app/ui/gameRoute/useGameSceneSetup'
import { useGameRelay } from '@/app/ui/gameRoute/useGameRelay'
import { useBurstAndAlertScene } from '@/app/ui/gameRoute/useBurstAndAlertScene'
import { useGamePlayFlow } from '@/app/ui/gameRoute/useGamePlayFlow'
import { useGameRecordAlert } from '@/app/ui/gameRoute/useGameRecordAlert'

/** 경기 장면의 훅 — 장면 세우기 → 중계 → 돌발 · 알림 장면 → 판 흐름 → 기록 알림 차례 그대로 */
export function useGameRouteState(props: GameRouteProps) {
  const { session, progress, runner, random, career } = props
  const scene = useGameSceneSetup(props)
  const relay = useGameRelay(progress, scene.sceneSerial, scene.sessionActionsRef)
  const burst = useBurstAndAlertScene(props)
  const flow = useGamePlayFlow({
    session,
    progress,
    random,
    career,
    play: scene.play,
    shownPlay: scene.shownPlay,
    sceneSerial: scene.sceneSerial,
    alertSceneFrozenBefore: burst.alertSceneFrozenBefore,
    resolution: burst.resolution,
  })
  const alert = useGameRecordAlert({
    session,
    progress,
    runner,
    setAlertScene: burst.setAlertScene,
    alertScene: burst.alertScene,
    isDefenseShown: flow.isDefenseShown,
    isIntroDone: flow.isIntroDone,
    sceneBuntKindRef: scene.sceneBuntKindRef,
  })
  return { ...props, ...scene, ...relay, ...burst, ...flow, ...alert }
}

/** 경기 장면 갈래가 그리는 데 쓰는 재료 */
export type GameRouteView = ReturnType<typeof useGameRouteState>
