import { useEffect, useEffectEvent, useState } from 'react'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { useInPlayTouchKeys, type InPlayRunnerSituation } from '@/features/defense-play/model/inPlayTouchKeys'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { isHomeRunHitCode } from '@/pages/defense/lib/runScoreBoard'
import { drawLiveBurstFrames } from '@/pages/defense/ui/playback/liveBurst'
import { finishLivePlay } from '@/pages/defense/ui/playback/liveFinish'
import {
  NO_EFFECTS_VIEW,
  createLivePlaybackSlots,
  type LiveEffectsView,
  type LiveScreenSetters,
  type RunScoreBoardView,
} from '@/pages/defense/ui/playback/livePlaybackSlots'
import { LivePlaybackScreen } from '@/pages/defense/ui/playback/LivePlaybackScreen'
import { redrawLivePictures } from '@/pages/defense/ui/playback/liveRedraw'
import { runLiveUpdate } from '@/pages/defense/ui/playback/liveUpdate'
import type { RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'
import { useSceneKeyEvents } from '@/pages/defense/ui/playback/useSceneKeyEvents'
import { useGameSceneRedrawCount } from '@/shared/lib/commonWindow/useGameSceneRedrawCount'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { useShownSceneTicks } from '@/shared/lib/sceneKeyLatch/useShownSceneTicks'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'

/** 판을 연 첫 그림 전 — 주루 버튼 없음 */
const NO_RUNNER_SITUATION: InPlayRunnerSituation = { runners: [] }

interface LivePlaybackProps {
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly sceneMemory?: { current: DefenseSceneMemory }
  readonly children?: React.ReactNode
  readonly burstWindow?: React.ReactNode
}

/**
 * 진행기를 **매 갱신 한 틱씩** 직접 돌린다 (0xc2198).
 *
 * 원본 경기 장면은 매 틱 눌린 키를 `this+0x38` 에 담고 조작 객체(0x536bc)가 상태 0x17 갈래로 가른다.
 * 여기서는 `keydown` 을 줄 세워 두고 **한 틱에 한 개씩** 진행기에 먹인다.
 * 키 → 뜻은 진행기 안에서 `inPlayCommandOf` 가 한다 — 표를 여기서 다시 만들지 않는다.
 * 갱신 · 창 첫 그림 · 0x1c · 끝은 effect 가 칸 객체(`LivePlaybackSlots`)의 이름 붙인 함수로 지나고, 이 컴포넌트는 그 결과를 그린다.
 */
export function LivePlayback({
  input,
  side,
  onDone,
  onFieldingErrors,
  grassPalette,
  runScoreBoard,
  sceneMemory,
  children,
  burstWindow,
}: LivePlaybackProps) {
  const [slots] = useState(() => createLivePlaybackSlots(sceneMemory))
  const update = useGameSceneUpdateCounter(true, slots.updateStartTickRef)
  const [view, setView] = useState<DefenseViewState | null>(null)
  /**
   * 화면에 낸 판 그림(`view`)의 장면 틱 — 키를 받은 틱은 키 사건이 난 때 화면에 있던 그림의 틱이다(r217, `useShownSceneTicks` — 원본은 키를
   * 받은 틀 = 마지막으로 그린 틀). 그리기가 밀려 갱신이 늦게 오면 지금 틱은 앞서도 진행기는 본 그림에 서 있다
   */
  const [viewTick, setViewTick] = useState<number | null>(null)
  const tickSeenOf = useShownSceneTicks(shownTickOf(view, viewTick))
  /** 터치 기기 — 사람이 잡은 쪽의 송구 · 주루 상황 버튼 (자동 판은 없음). 판을 연 첫 그림 전에는 주루 버튼이 없다 */
  const [runnerSituation, setRunnerSituation] = useState<InPlayRunnerSituation>(NO_RUNNER_SITUATION)
  // `ended` — 0x35108(0x17 끝)을 지났다: 닫힌 뒤 11 번째 갱신, 홈런 점수판이 선 홈런 타구는 내려갈 때까지 더, 키 건너뛰기면 그 그림
  const [ended, setEnded] = useState(false)
  const holdsUnderBurst = ended && burstWindow != null
  // 0x1c 동안은 키가 창 갱신 0x8e5b8 몫이라 버튼이 없다
  useInPlayTouchKeys(holdsUnderBurst ? undefined : side, runnerSituation)
  /** 판이 닫힌 뒤 갱신(+0x1094 셈)에 들었고 0x3f060 의 G1(3f0b8)이 닫혔다 — 카메라가 선다 */
  const [closed, setClosed] = useState(false)
  const [runBoard, setRunBoard] = useState<RunScoreBoardView | null>(null)
  const [particles] = useState<ParticleScene>(sceneParticleScene)
  const [effectsView, setEffectsView] = useState<LiveEffectsView>(NO_EFFECTS_VIEW)
  /** 창이 선 첫 그림([창+0x250])의 수 (`useGameSceneRedrawCount`) */
  const redraws = useGameSceneRedrawCount()
  const homeRunHit = homeRunHitOf(input)

  useSceneKeyEvents(slots, tickSeenOf)
  useEffect(() => {
    const ui: LiveScreenSetters = { setView, setViewTick, setRunnerSituation, setEnded, setClosed, setRunBoard, setEffectsView }
    runLiveUpdate(slots, { update, input, side, ended, runScoreBoard, sceneMemory, homeRunHit, particles }, ui)
  }, [slots, update, input, side, ended, runScoreBoard, sceneMemory, homeRunHit, particles])
  useEffect(() => {
    redrawLivePictures(slots, { redraws, ended, input, runScoreBoard, homeRunHit, particles }, { setView, setEffectsView, setRunBoard })
  }, [slots, redraws, ended, input, runScoreBoard, homeRunHit, particles])
  useEffect(() => {
    drawLiveBurstFrames(slots, { update, holdsUnderBurst, input, particles }, { setEffectsView })
  }, [slots, update, holdsUnderBurst, input, particles])
  // 실책 · 넘길 곳은 늘 최신 것을 읽기만 하고, 다시 보는 때는 끝남 · onDone · 장면 칸이 바뀔 때뿐이다
  const finishOncePerPlay = useEffectEvent(() => finishLivePlay(slots, { ended, sceneMemory, particles, onDone, onFieldingErrors }))
  useEffect(() => finishOncePerPlay(), [ended, onDone, sceneMemory, particles])

  if (view === null) return null
  return (
    <LivePlaybackScreen
      view={view}
      holdsUnderBurst={holdsUnderBurst}
      closed={closed}
      ended={ended}
      grassPalette={grassPalette}
      cameraOffsetRef={slots.cameraOffsetRef}
      redraws={redraws}
      effectsView={effectsView}
      particles={particles}
      runScoreBoard={runScoreBoard}
      runBoard={runBoard}
      burstWindow={burstWindow}
    >
      {children}
    </LivePlaybackScreen>
  )
}

/** 0x357e0 — 이 타구의 결과 코드 [+0xfd4] 가 24~26(홈런성)인가. 타석이 묶어 둔 쏜 공(`contactOfOutcome`)에서 읽는다 */
function homeRunHitOf(input: DefensePlayInput): boolean {
  return isHomeRunHitCode(contactOfOutcome(input.outcome)?.resultCode)
}

/** 화면에 낸 판 그림의 장면 틱 — 그림이 없으면 null */
function shownTickOf(view: DefenseViewState | null, viewTick: number | null): number | null {
  return view === null ? null : viewTick
}
