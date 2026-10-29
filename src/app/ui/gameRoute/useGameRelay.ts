import { useCallback, useEffect, useState } from 'react'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { useGameSceneSetup } from '@/app/ui/gameRoute/useGameSceneSetup'

type SessionActionsRef = ReturnType<typeof useGameSceneSetup>['sessionActionsRef']

export function useGameRelay(progress: GameProgress, sceneSerial: number, sessionActionsRef: SessionActionsRef) {
  /**
   * **자동진행 중계(상태 0x21)** — 내 타석 사이에 돈 동료 타석 · 상대 반 이닝(`progress.autoRelay`)을 틱마다 한 칸씩 튼다.
   * 모드 4 는 0x21 키 · 속도 · 배경음 · 연출 대기가 없어 굴린 결과를 뒤에 틀어도 원본과 같다. 이미 튼 묶음은 (장면, serial) 로 기억한다
   */
  const relay = progress.autoRelay ?? null
  const [shownRelay, setShownRelay] = useState<{ readonly scene: number; readonly serial: number } | null>(null)
  const relayScene = sceneSerial
  // 경기를 끝낸 중계면 세션이 정산을 그 끝으로 미룬다 — 이 화면이 붙어 있는 동안만 (`attachRelayHost`, A-38)
  // ref 상자는 바뀌지 않는다 — 붙이기는 처음 한 번
  useEffect(() => sessionActionsRef.current.attachRelayHost(), [sessionActionsRef])
  const finishRelay = useCallback(() => {
    setShownRelay(relay === null ? null : { scene: relayScene, serial: relay.serial })
    sessionActionsRef.current.finishRelay(relay)
  }, [relay, relayScene, sessionActionsRef])

  return { relay, shownRelay, relayScene, finishRelay }
}
