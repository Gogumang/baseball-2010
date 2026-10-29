import { type RefObject, useEffect, useRef, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { passesHeldResult, pitchResultEntryDelayTicksOf, pitchSceneBusyTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameSession } from '@/pages/pitching/model/usePitcherGame'
import { RESULT_WAIT_TICKS_AT_BAT_END, resultWaitTicksOf, useHitByPitchWait, type useBatterPitchEnd } from './otherSlices'

type Resolution = NonNullable<PitcherGameProgress['lastResolution']>

/** 판정이 든 그림의 진행 칸 — 맞은 공 판 · 주자 판 · 던진 공 */
type ThrownState = Pick<PitcherGameProgress, 'pendingDefensePlay' | 'pendingRunnerPlay' | 'lastPitch'>

interface ThrownResultSetters {
  readonly setPitchWaitTicks: (ticks: number) => void
  readonly setHeldResultTicks: (ticks: number) => void
}

/**
 * 판정이 든 그림의 0x12 칸 — 판(맞은 공)이 섰으면 그 판 끝이 공 끝이라 아무것도 안 세운다. 공 도착 판은 장면이 0x12 틱 0 까지 그린다
 * (0x12 문턱은 그 그림의 판정 글자 틱만 본다 — 키 막음은 판이 맡는다). 그 밖에 맞히지 못한 공이면 0x11 · 0x12 대기 틱
 */
/** 공 도착 판이 선 공이고 0x12 를 그리는 판정인가 */
const isHeldArrivalOf = (progress: ThrownState, resolution: Resolution) =>
  progress.pendingRunnerPlay?.kind === 'arrival' && passesHeldResult(resolution)

/** 던진 공의 공 틱 수 (없으면 0) */
const frameCountOf = (progress: ThrownState) => progress.lastPitch?.frameCount ?? 0

function applyThrownResult(progress: ThrownState, resolution: Resolution, waitTicks: number, set: ThrownResultSetters): void {
  if (progress.pendingDefensePlay !== null) return
  if (isHeldArrivalOf(progress, resolution)) set.setHeldResultTicks(waitTicks)
  if (progress.pendingRunnerPlay != null) return
  if (resolution.kind === '타구') return
  set.setPitchWaitTicks(pitchSceneBusyTicksOf(frameCountOf(progress), waitTicks))
  set.setHeldResultTicks(waitTicks)
}

interface PitchWaitInput {
  readonly session: PitcherGameSession
  readonly random: RandomPort
  readonly pitchEnd: ReturnType<typeof useBatterPitchEnd>
  readonly arrivalPlay: unknown
  readonly atBatBeforeThrowRef: RefObject<AtBatState>
  readonly isPopupOpen: boolean
  /** 팝업 · 강판 물음 — 0x12 상태 틱이 멈춘다 */
  readonly isFrozen: boolean
}

/** 내 공의 0x11 · 0x12 대기 틱과 0x12 길이 — 판정이 든 그림에서 세운다. 사구는 0x12 대기 틱 31 의 판정 */
export function usePitchWait({ session, random, pitchEnd, arrivalPlay, atBatBeforeThrowRef, isPopupOpen, isFrozen }: PitchWaitInput) {
  const { progress, actions } = session
  const { notePitchResolved, notePitchPlayOpened } = pitchEnd
  const [pitchWaitTicks, setPitchWaitTicks] = useState(0)
  /** 마지막 공의 0x12 길이 — 타석 장면(`PitcherSideStage`)이 공을 마지막 점에 두는 틱 수 */
  const [heldResultTicks, setHeldResultTicks] = useState(0)
  const { lastResolution, pendingDefensePlay, pendingRunnerPlay, lastPitch } = progress
  const lastResolutionRef = useRef(lastResolution)
  useEffect(() => {
    if (lastResolutionRef.current === lastResolution) return
    lastResolutionRef.current = lastResolution
    if (lastResolution === null) return
    const waitTicks = resultWaitTicksOf(applyPitchResolution(atBatBeforeThrowRef.current, lastResolution).outcome)
    // 공 끝 — 이 그림(놓은 틱)에서 0x12 틱 0 까지 + 문턱. 판(맞은 공 · 공 도착 판)이 섰으면 그 판 끝이 공 끝이다
    const entryDelay = pitchResultEntryDelayTicksOf(lastPitch?.frameCount ?? 0)
    notePitchResolved({ isHit: pendingDefensePlay !== null, waitTicks: entryDelay - 1 + waitTicks })
    applyThrownResult({ pendingDefensePlay, pendingRunnerPlay, lastPitch }, lastResolution, waitTicks, { setPitchWaitTicks, setHeldResultTicks })
  }, [lastResolution, pendingDefensePlay, pendingRunnerPlay, lastPitch, notePitchResolved, atBatBeforeThrowRef])
  // 0x12 진입 틀에 공 도착 판이 섰다 — 공 끝 · 키 막음은 이제 판이 맡는다(놓는 그림은 판이 설지 몰라 대기 틱을 세웠다)
  useEffect(() => {
    if (arrivalPlay === null) return
    // oxlint-disable-next-line react/set-state-in-effect -- 판이 선 그림(0x12 틱 0)은 대기 틱이 남은 채 한 번 커밋된다 — 공 끝 알림(notePitchPlayOpened)과 같은 자리에서 지운다
    setPitchWaitTicks(0)
    notePitchPlayOpened()
  }, [arrivalPlay, notePitchPlayOpened])
  useSceneTick(() => setPitchWaitTicks((left) => Math.max(0, left - 1)), pitchWaitTicks > 0 && !isPopupOpen)
  // 사구 — 0x12 대기 틱 31 의 4e74c 판정, 들어갔으면 다음 틀의 진입 0x3a5f0 (A-22). 진행기는 붙든 공의 공 도착을 0x12 진입 틀에 돌려
  // (`enterPitchResult` — r293) 붙든 칸이 0x12 틱 0 그림에 서므로 그 그림부터 0x1f − 1
  useHitByPitchWait({
    hold: progress.pendingBenchClearing,
    waitTicks: RESULT_WAIT_TICKS_AT_BAT_END - 1,
    isFrozen,
    random,
    onJudge: actions.judgeHitByPitch,
    onEnter: actions.enterBenchClearing,
  })
  return { pitchWaitTicks, heldResultTicks, lastResolution, lastResolutionRef, isPitchSceneBusy: pitchWaitTicks > 0 }
}
