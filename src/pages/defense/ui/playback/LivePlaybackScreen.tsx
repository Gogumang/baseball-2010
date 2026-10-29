import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { DefenseDistanceBoard, DefenseHomeRunText, DefenseParticles } from '@/pages/defense/ui/DefenseEffectsLayer'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'
import type { LiveEffectsView, RunScoreBoardView } from '@/pages/defense/ui/playback/livePlaybackSlots'
import type { CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import { frozenCamera, unzoomed } from '@/pages/defense/ui/playback/playbackPictures'
import type { RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'

interface LivePlaybackScreenProps {
  readonly view: DefenseViewState
  /** 0x1c — 판이 끝난 뒤 돌발 창 아래 그림 */
  readonly holdsUnderBurst: boolean
  /** 판이 닫힌 뒤 갱신(+0x1094 셈)에 들었다 — 카메라가 선다 */
  readonly closed: boolean
  readonly ended: boolean
  readonly grassPalette: number | null
  readonly cameraOffsetRef: { current: CameraOffset }
  readonly redraws: number
  readonly effectsView: LiveEffectsView
  readonly particles: ParticleScene
  readonly runScoreBoard?: RunScoreBoardSource
  readonly runBoard: RunScoreBoardView | null
  readonly children?: React.ReactNode
  readonly burstWindow?: React.ReactNode
}

/**
 * 실시간 타구 판의 그림 층 — 0x46c88 차례: 비거리 판(0x46cb6, 선수 아래 · 줌 안) → 선수 · 공 → … → HOMERUN 글자(0x46e5c) →
 * 득점 점수판(0x46e62), 그 뒤 프레임 끝 파티클(0x6dd68). 0x1c 는 판이 선 채(카메라도 선다) 그 위에 창 — 줌은 0x35108 의 0xbb428 이 내렸다
 */
export function LivePlaybackScreen({
  view,
  holdsUnderBurst,
  closed,
  ended,
  grassPalette,
  cameraOffsetRef,
  redraws,
  effectsView,
  particles,
  runScoreBoard,
  runBoard,
  children,
  burstWindow,
}: LivePlaybackScreenProps) {
  const distanceBoard = effectsView.distanceBoard
  return (
    <DefenseScreen
      state={screenStateOf(view, holdsUnderBurst, closed)}
      grassPalette={grassPalette}
      cameraOffsetRef={cameraOffsetRef}
      drawRedraws={redraws}
      underActors={distanceBoard !== null ? <DefenseDistanceBoard value={distanceBoard} /> : undefined}
    >
      {effectsView.text !== null && <DefenseHomeRunText frame={effectsView.text} />}
      {runScoreBoard !== undefined && runBoard !== null && !ended && <RunScoreBoard sides={runScoreBoard.sides} scores={runBoard.scores} />}
      <DefenseParticles scene={particles} version={effectsView.version} />
      {children}
      {holdsUnderBurst && burstWindow}
    </DefenseScreen>
  )
}

/** 0x1c 동안은 카메라가 서고 줌이 내려가고, 판이 닫힌 뒤에는 카메라만 선다 */
function screenStateOf(view: DefenseViewState, holdsUnderBurst: boolean, closed: boolean): DefenseViewState {
  if (holdsUnderBurst) return unzoomed(frozenCamera(view))
  return closed ? frozenCamera(view) : view
}
