import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isHomeRunHitCode } from '@/pages/defense/lib/runScoreBoard'
import { DefenseParticles } from '@/pages/defense/ui/DefenseEffectsLayer'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'
import { UPDATES_PER_TICK } from '@/pages/defense/ui/playback/playbackClock'
import { frozenCamera } from '@/pages/defense/ui/playback/playbackPictures'
import { createRecordedPlaybackSlots, drawRecordedFrame } from '@/pages/defense/ui/playback/recordedPlaybackSlots'
import { tallyBoardScoresOf, type RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'
import { useFreePassSkipTick } from '@/pages/defense/ui/playback/useFreePassSkipTick'
import { useGameSceneRedrawCount } from '@/shared/lib/commonWindow/useGameSceneRedrawCount'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PressArea } from '@/shared/ui/PressArea/PressArea'

interface RecordedPlaybackProps {
  readonly ticks: readonly DefenseViewState[]
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly freePassPlay: boolean
  readonly children?: React.ReactNode
  readonly burstWindow?: React.ReactNode
}

/**
 * 미리 계산해 둔 틱을 차례대로 보여 주기만 한다 — 한 갱신에 한 틱, 마지막 틱(관문이 닫힌 틱) 뒤로는 원본 닫힌 갈래대로
 * +0x1094 가 11 이 되는 갱신(홈런 재생은 홈런 점수판이 내려갈 때까지 더)에 끝낸다 — 그동안 마지막 그림과 점수판을 그린다.
 *
 * ⚠️ **펌블 소리 53 은 여기서 내지 않는다.** 이 갈래로 오는 타구 판은 패턴 없이 온 홈런의 재생(`homeRunPlayback` — 시험·옛 호출)뿐이고
 * (그 밖은 견제 · 도루 · 폭투 판), 그 판은 난수 없이 돌려 펌블 굴림 자체가 없다. 화면 스냅샷(`DefenseViewState`)에는
 * 펌블 동작(0xd)도 `fumbled` 칸도 실려 오지 않으므로 여기서는 알 길도 없다.
 * 두 갈래는 `input` 이 있으면 실시간, 없으면 재생으로 **서로 배타**라 겹쳐 울릴 일도 없다.
 */
export function RecordedPlayback({
  ticks,
  onDone,
  onFieldingErrors,
  grassPalette,
  runScoreBoard,
  freePassPlay,
  children,
  burstWindow,
}: RecordedPlaybackProps) {
  const [slots] = useState(createRecordedPlaybackSlots)
  const update = useGameSceneUpdateCounter(ticks.length > 0, slots.updateStartTickRef)
  /** 창이 선 첫 그림([창+0x250])의 수 — 다시 그린 수는 재생 묶음마다 센다 */
  const redraws = useGameSceneRedrawCount(ticks.length > 0)
  const lastIndex = Math.max(0, ticks.length - 1)
  const index = Math.min(Math.floor(update / UPDATES_PER_TICK), lastIndex)
  const isHomeRun = recordedIsHomeRunOf(ticks, freePassPlay)
  const skipTick = useFreePassSkipTick(freePassPlay, ticks)
  const { bundle, isFinished, burstHold } = drawRecordedFrame(slots, {
    ticks,
    update,
    redraws,
    isHomeRun,
    skipTick,
    hasBurstWindow: burstWindow != null,
  })
  const { tally, errors: drawnErrors, run } = bundle

  /** `onDone` 을 부른 재생 묶음 — 판이 끝난 뒤에도 남는 그림(0x1c)이 다시 그려져도 한 번만 부른다 */
  const doneForRef = useRef<readonly DefenseViewState[] | null>(null)
  // 실책 묶음은 재생 묶음(ticks)마다 하나 — 묶음 · 실책 · 넘길 곳(onFieldingErrors)은 늘 최신 것을 읽기만 하고, 다시 보는 때는
  // 끝남 · onDone 이 바뀔 때뿐이다(부르는 쪽이 그릴 때마다 새 함수를 줘도 끝을 다시 부르지 않는다)
  const finishOncePerTicks = useEffectEvent(() => {
    if (!isFinished || doneForRef.current === ticks) return
    doneForRef.current = ticks
    if (drawnErrors.length > 0) onFieldingErrors?.(drawnErrors)
    onDone()
  })
  useEffect(() => finishOncePerTicks(), [isFinished, onDone])

  const tickState = ticks[index]
  if (tickState === undefined) return null
  // 마지막 틱(관문이 닫힌 틱) 뒤 갱신 — 0x3f060 의 G1(3f0b8)이 닫혀 카메라가 선다
  const state = Math.floor(update / UPDATES_PER_TICK) > lastIndex ? frozenCamera(tickState) : tickState
  const board = tallyBoardScoresOf(runScoreBoard, tally)
  return (
    <DefenseScreen state={state} grassPalette={grassPalette} cameraOffsetRef={slots.cameraOffsetRef} drawRedraws={redraws}>
      {board !== null && runScoreBoard !== undefined && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      <DefenseParticles scene={run.scene} version={run.version} />
      {/*
        밀어내기 판은 원본이 아는 키 아무것이나 받아 넘긴다(0x519cc) — 화면에 그 글자는 없어 판 전체를 OK 누름 칸으로(웹 전용,
        r186 — 늘 있던 확인 버튼을 걷었다). 키와 같은 길(keydown → 위 듣는 곳)로 들어간다
      */}
      {freePassPlay && burstHold === null && <PressArea label="넘기기" onPress={() => tapKey('Enter')} />}
      {children}
      {burstHold !== null && burstWindow}
    </DefenseScreen>
  )
}

/**
 * 0x357e0(결과 코드 [경기+0xfd4] 24~26) — 주자 판(견제 · 도루 · 폭투 · 밀어내기)의 틱은 판이 열린 때의 값(`sceneResultCode`)을 싣고
 * 와 그것으로 본다(견제는 앞 공의 값이 남아 홈런 뒤 첫 공 앞 견제면 참이다 — null 은 정해지지 않은 값이라 거짓). ⚠️ 그 값이 없는
 * 재생(패턴 없이 온 홈런 재생)은 "타자주자(칸 0)가 달리는 재생 = 홈런 비행" 으로 읽는다. 밀어내기 판(종류 2)은 타자주자를 싣지만 홈런이 아니다
 */
function recordedIsHomeRunOf(ticks: readonly DefenseViewState[], freePassPlay: boolean): boolean {
  const sceneResultCode = ticks[0]?.sceneResultCode
  if (sceneResultCode !== undefined) return isHomeRunHitCode(sceneResultCode)
  return !freePassPlay && ticks[0]?.runners.some((runner) => runner.index === 0) === true
}
