import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { passesHeldResult } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { thrownBusyTicksOf, thrownWaitTicksOf } from './thrownPitch'

/**
 * 내 공의 남은 0x11 비행 + 0x12 대기 (`pitchSceneBusyTicksOf`) — 그동안은 원본도 상태 0x11 · 0x12 라 다음 공의 구질 키 ·
 * 견제 · '#' · 0xe 의 OK 를 안 받는다. 0x12 길이는 0x4e6d4 의 15(타석 끝 31) — 장면이 공을 마지막 점에 두는 틱이기도 하다.
 * 진행기는 놓는 순간(0x11 틱 10) 판정까지 내므로 던질 때 표시해 둔 공의 판정이 들어오면 센다.
 *
 * 칸 셋(`atBatBeforeThrowRef` · `isThrowPendingRef` · `isThrowPitchEndPendingRef`)은 던질 때(`throwWith`) 적고, 판정이 든 그림의 효과가 내린다.
 */
export function useThrowSettle(session: TeamGameSession, isTickFrozen: boolean) {
  const { progress } = session
  const atBatBeforeThrowRef = useRef(progress.atBat)
  const isThrowPendingRef = useRef(false)
  /** 던진 공의 판정이 들면 공 끝 대기(`useBatterPitchEnd`)에 싣는다 — 아래 공 끝 효과가 내린다 */
  const isThrowPitchEndPendingRef = useRef(false)
  const [pitchBusyTicks, setPitchBusyTicks] = useState(0)
  const [heldResultTicks, setHeldResultTicks] = useState(0)
  /** 던진 공의 판정이 든 렌더 — 공 끝 대기 · 0x11 길이를 그 렌더 값으로 정한다 (아래 deps 가 바뀔 때만) */
  const settleThrownPitch = useEffectEvent(() => {
    if (!isThrowPendingRef.current) return
    isThrowPendingRef.current = false
    const thrown = progress.lastResolution
    if (thrown === null || session.pendingDefensePlay !== null || !passesHeldResult(thrown)) {
      setHeldResultTicks(0)
      return
    }
    const waitTicks = thrownWaitTicksOf(atBatBeforeThrowRef.current, thrown)
    setHeldResultTicks(waitTicks)
    // 공 도착 판(도루 · 폭투) — 장면은 0x12 틱 0 까지 그리고(`usePitchArrivalHold`) 키 막음은 판이 맡는다
    if (progress.pendingRunnerPlay != null) return
    setPitchBusyTicks(thrownBusyTicksOf(progress, waitTicks))
  })
  // oxlint-disable-next-line react/set-state-in-effect -- 던진 공의 판정이 든 그림이 한 번 커밋된 뒤(그 그림은 '게이지' 갈래 — 아래 sceneStateKey) 공 끝 대기 · 0x11 · 0x12 틱을 세운다 — 렌더 중으로 옮기면 그 그림이 사라져 상태 틱 0 점이 달라진다
  useEffect(() => settleThrownPitch(), [progress.lastResolution, progress.lastPitch, session.pendingDefensePlay, progress.pendingRunnerPlay])
  useSceneTick(() => setPitchBusyTicks((left) => Math.max(0, left - 1)), pitchBusyTicks > 0 && !isTickFrozen)
  return {
    atBatBeforeThrowRef,
    isThrowPendingRef,
    isThrowPitchEndPendingRef,
    pitchBusyTicks,
    setPitchBusyTicks,
    heldResultTicks,
    isPitchSceneBusy: pitchBusyTicks > 0,
  }
}
