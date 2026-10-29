import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { useInPlayTouchKeys, type InPlayRunnerSituation } from '@/features/defense-play/model/inPlayTouchKeys'
import type { LiveRunnerPlay, LiveRunnerStepper } from '@/features/defense-play/model/liveRunnerPlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { DefenseParticles } from '@/pages/defense/ui/DefenseEffectsLayer'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'
import { createLiveRunnerPlaybackSlots, drawLiveRunnerFrame, runnerSceneTickOf } from '@/pages/defense/ui/playback/liveRunnerPlaybackSlots'
import { frozenCamera } from '@/pages/defense/ui/playback/playbackPictures'
import { tallyBoardScoresOf, type RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'
import { useSceneKeyEvents } from '@/pages/defense/ui/playback/useSceneKeyEvents'
import { useGameSceneRedrawCount } from '@/shared/lib/commonWindow/useGameSceneRedrawCount'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { useShownSceneTicks } from '@/shared/lib/sceneKeyLatch/useShownSceneTicks'

interface LiveRunnerPlaybackProps {
  readonly play: LiveRunnerPlay
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly children?: React.ReactNode
  readonly burstWindow?: React.ReactNode
}

/**
 * 사람이 잡은 **주자 판**(도루 · 폭투 · 견제)을 매 갱신 한 틱씩 돌린다 — 타구 판(`LivePlayback`)과 같은 모양이다.
 * 눌린 키를 줄 세워 한 틱에 하나씩 진행기에 먹이고(상태 0x17 키 0x53420 → 수비면 송구 0x588 → +0x160, 공격이면 주루 0x5331c →
 * 0x582 · 0x584 와 OK 슬라이딩 0x585 — 어느 쪽인지는 판의 `side`), 관문이 닫힌 뒤로는 재생 갈래와
 * 같은 닫힌 갱신(+0x1094 가 11 이 되는 갱신에 0x35108)과 득점 점수판 셈(`stepRecordedBoard`)을 지난다.
 */
export function LiveRunnerPlayback({ play, onDone, onFieldingErrors, grassPalette, runScoreBoard, children, burstWindow }: LiveRunnerPlaybackProps) {
  const [slots] = useState(createLiveRunnerPlaybackSlots)
  const update = useGameSceneUpdateCounter(true, slots.updateStartTickRef)
  /**
   * 키를 받은 틱 = 키 사건이 난 때 화면에 있던 그림의 틱(r217 — 원본은 키를 받은 틀 = 마지막으로 그린 틀). 이 갈래는 그림(갱신 u)마다 그 장면
   * 틱까지 진행기를 돌려 그린다 — 그리기가 밀려 갱신이 늦게 오면 지금 틱은 앞서도 진행기는 본 그림에 서 있다
   */
  const tickSeenOf = useShownSceneTicks(runnerSceneTickOf(slots, update))
  /** 창이 선 첫 그림([창+0x250])의 수 — 다시 그린 수는 판마다 센다 */
  const redraws = useGameSceneRedrawCount()

  useSceneKeyEvents(slots, tickSeenOf)

  const { bundle, isFinished, burstHold } = drawLiveRunnerFrame(slots, { play, update, redraws, hasBurstWindow: burstWindow != null })
  const { stepper, startedAt, tally, errors: drawnErrors, run } = bundle
  const ticks = stepper.ticks
  const lastIndex = Math.max(0, ticks.length - 1)
  const seen = update - startedAt

  /** `onDone` 을 부른 판 — 판이 끝난 뒤에도 남는 그림(0x1c)이 다시 그려져도 한 번만 부른다 */
  const doneForRef = useRef<LiveRunnerStepper | null>(null)
  // 실책 묶음은 판(play)마다 하나 — 실책 · 넘길 곳은 늘 최신 것을 읽기만 하고, 다시 보는 때는 끝남 · onDone · 판이 바뀔 때뿐이다
  const finishOncePerPlay = useEffectEvent(() => {
    if (!isFinished || doneForRef.current === stepper) return
    doneForRef.current = stepper
    if (drawnErrors.length > 0) onFieldingErrors?.(drawnErrors)
    // 판이 닫힌 뒤(+0x1094 셈) 온 키 · 판 끝까지 못 먹인 키도 키 처리 0x53420 을 지나 사람 수비면 송구 0x533c8 → 0x588 → vt60 이
    // +0x160 에 적지만, 다음 판 시작 vt18 0xb27ec 가 부르는 vt1c 0xb0edc(b0f66~b0f68)가 −1 로 지워 넘어가지 않는다
    onDone(stepper.result())
  })
  useEffect(() => finishOncePerPlay(), [isFinished, onDone, stepper])

  const tickState = ticks[Math.min(Math.max(0, seen), lastIndex)]
  // 터치 기기 — 사람이 잡은 쪽(판의 side, 안 주면 수비)의 송구 · 주루 상황 버튼. 공격 쪽 도루 · 폭투 판은 판을 연 주자 목록으로
  // 그 판에 먹는 키만(`offenseOffersFor` — 주자 판에는 타구가 없어 +0x111 이 서지 않는다). 견제 판은 주자 목록을 따로 안 들어 아홉 다
  // 0x1c 동안은 키가 창 갱신 0x8e5b8 몫이라 버튼이 없다
  const touch = runnerTouchKeysOf(play, burstHold !== null)
  useInPlayTouchKeys(touch.side, touch.situation)
  if (tickState === undefined) return null
  // 판이 닫힌 뒤 갱신 — 0x3f060 의 G1(3f0b8)이 닫혀 카메라가 선다
  const state = stepper.finished && seen > lastIndex ? frozenCamera(tickState) : tickState
  const board = tallyBoardScoresOf(runScoreBoard, tally)
  return (
    <DefenseScreen state={state} grassPalette={grassPalette} cameraOffsetRef={slots.cameraOffsetRef} drawRedraws={redraws}>
      {board !== null && runScoreBoard !== undefined && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      <DefenseParticles scene={run.scene} version={run.version} />
      {children}
      {burstHold !== null && burstWindow}
    </DefenseScreen>
  )
}

/**
 * 터치 기기 — 사람이 잡은 쪽(판의 side, 안 주면 수비)의 송구 · 주루 상황 버튼. 공격 쪽 도루 · 폭투 판은 판을 연 주자 목록으로
 * 그 판에 먹는 키만(`offenseOffersFor` — 주자 판에는 타구가 없어 +0x111 이 서지 않는다). 견제 판은 주자 목록을 따로 안 들어 아홉 다.
 * 0x1c 동안은 키가 창 갱신 0x8e5b8 몫이라 버튼이 없다
 */
function runnerTouchKeysOf(
  play: LiveRunnerPlay,
  underBurst: boolean,
): { readonly side: ControlSide | undefined; readonly situation: InPlayRunnerSituation | null } {
  return {
    side: underBurst ? undefined : (play.side ?? '수비'),
    situation: play.kind === 'arrival' ? { runners: play.opened.engineInput.runners } : null,
  }
}
