import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamAutoRelayEntryStepOf, teamRelayEntryFiguresOf } from '@/pages/team-game/lib/teamAutoRelay'
import type { TeamRelayFigures as TeamRelayFiguresValue } from '@/pages/team-game/lib/teamAutoRelay'
import { autoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'
import type { RelayWait } from './relayWait'

/**
 * 중계 화면의 칸 — 그림 값(보인 칸 · 운동장 그림 · 속도 · "CHANGE" · 질문 창 · 장면 틱)과 틱 · 키 처리가 고치고 읽는 ref.
 * 질문 창이 섰다 · 내렸다는 부르는 쪽에 알리고(`onAskingChange`), 중계 화면이 내려가면 창도 함께 내려간다
 */
export function useRelayState(
  progress: TeamGameProgress,
  entryLoadedRunnerAce: number | null | undefined,
  onAskingChange: ((isAsking: boolean) => void) | undefined,
) {
  const [shown, setShown] = useState<MissionAutoRelayStep>(() => teamAutoRelayEntryStepOf(progress))
  // 0x18 길은 4faf8 0x47cc8 이 주자 그림판에 마선수 그림을 다시 싣는다(타자 → 가장 앞선 마선수 주자) · 메뉴 길은 타석 0xd 때 그림
  const [figures, setFigures] = useState<TeamRelayFiguresValue>(() => teamRelayEntryFiguresOf(progress, entryLoadedRunnerAce))
  const [speed, setSpeed] = useState(autoRelaySpeed)
  const speedRef = useRef(speed)
  useLayoutEffect(() => {
    speedRef.current = speed
  })
  const [isChangeShown, setChangeShown] = useState(false)
  const [isAsking, setAsking] = useState(false)
  const isAskingRef = useRef(false)
  const onAskingChangeRef = useRef(onAskingChange)
  useLayoutEffect(() => {
    isAskingRef.current = isAsking
    onAskingChangeRef.current = onAskingChange
  })
  useEffect(() => {
    onAskingChangeRef.current?.(isAsking)
  }, [isAsking])
  // 중계 화면이 내려가면 창도 함께 내려간다
  useEffect(() => () => onAskingChangeRef.current?.(false), [])
  /** CLR 을 받았다 — 다음 그림(그 키의 그림)이 갱신 · 그리기를 다 한 뒤 질문 창을 띄운다 */
  const clrPendingRef = useRef(false)
  const [sceneTick, setSceneTick] = useState(0)
  /** sim+0x9c · sim+0x9d */
  const waitRef = useRef<RelayWait>({ armed: false, count: 0 })
  const isDoneRef = useRef(false)
  return {
    shown,
    setShown,
    figures,
    setFigures,
    speed,
    setSpeed,
    speedRef,
    isChangeShown,
    setChangeShown,
    isAsking,
    setAsking,
    isAskingRef,
    clrPendingRef,
    sceneTick,
    setSceneTick,
    waitRef,
    isDoneRef,
  }
}

export type RelayState = ReturnType<typeof useRelayState>
