import type { Dispatch, SetStateAction } from 'react'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { InPlayRunnerSituation } from '@/features/defense-play/model/inPlayTouchKeys'
import type { DefensePlayInput, DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import { DEFENSE_SCENE_START, defenseEffectsOf, type DefenseEffects, type DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { EMPTY_HOME_RUN_SCORE_BOARD, type HomeRunScoreBoard } from '@/pages/defense/lib/runScoreBoard'
import type { BurstWindowHold } from '@/pages/defense/ui/playback/burstWindowHold'
import { newSceneKeyQueue, type SceneKeyQueue } from '@/pages/defense/ui/playback/keyQueue'
import type { CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import type { RunScoreBoardSource } from '@/pages/defense/ui/playback/runScoreBoardView'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'

/** 창이 선 첫 그림이 다시 그릴 마지막 그림 — 판 틱의 그림(`isPlay`)인가 · 그 그림의 HOMERUN 글자 관문 */
export interface LivePicture {
  readonly view: DefenseViewState
  readonly isPlay: boolean
  readonly drawsText: boolean
}

/** 득점 점수판이 이번 그리기에 보이는 모습 */
export interface RunScoreBoardView {
  readonly scores: readonly [number, number]
}

/** 홈런 연출 층이 이번 그리기에 그리는 것 — 글자 · 비거리 판 · 파티클 그림 판 */
export interface LiveEffectsView {
  readonly text: HomeRunTextFrame | null
  readonly distanceBoard: number | null
  readonly version: number
}

export const NO_EFFECTS_VIEW: LiveEffectsView = { text: null, distanceBoard: null, version: 0 }

/**
 * **실시간 타구 판이 갱신 · 그리기마다 고치는 칸** (이름 붙인 칸 객체 — `CODE_QUALITY.md` "렌더 중 곁일"). 한 번 만들어 useState 로 들고,
 * 고치는 일은 effect 가 부르는 `liveUpdate` · `liveRedraw` · `liveBurst` · `liveFinish` 의 이름 붙인 함수와 키 사건만 한다 — 그리는 중에는 안 고친다
 */
export interface LivePlaybackSlots {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u (`useGameSceneUpdateCounter` 가 적는다) */
  readonly updateStartTickRef: { current: number | null }
  /** 화면(`DefenseScreen`)이 적는다 — 공 그리기 파티클의 화면 좌표 */
  readonly cameraOffsetRef: { current: CameraOffset }
  state: DefensePlayState | null
  builtFrom: DefensePlayInput | null
  builtSide: ControlSide | undefined
  /** 이 플레이가 시작된 갱신 번호 — 갱신 계수는 화면이 서고부터 계속 오르므로 빼 준다 */
  startedAt: number
  /** 아직 진행기에 안 먹인 키 · 받은 장면 틱 · 누른 채 되풀이 셈 */
  keys: SceneKeyQueue
  /** 그린 틱이 올린 실책 (야수 그리기 0x43278 4381a~43904) */
  drawnErrors: DrawnFieldingError[]
  /** 이미 본 진행기 틱 수 */
  seenTickCount: number
  /**
   * 득점 점수판 칸 — 타이머 [+0x10f8] · 수 [+0x10fc] · 간격 [+0x1101] · 홈런 판 [+0x1100] (`lib/runScoreBoard`).
   * 메시지 0x13(1점)마다 0x357e0 이면 홈런 갈래, 아니면 타이머 20 — 그릴 때마다 줄인다. 판이 닫힌 뒤에도 0x35108 까지 그린다.
   */
  board: HomeRunScoreBoard
  /** +0x1094 — 관문이 닫힌 뒤 지난 갱신 수 (판 시작 0) */
  closedCount: number
  /** 공격 쪽 상황 버튼의 남는 키 묶음 — 바뀔 때만 다시 그린다 */
  runnerSituationKey: string
  /** 0x1c — 판이 끝난 뒤 돌발 창 아래 그림. 어느 판인가 · 마지막으로 그린 갱신 */
  burstHold: BurstWindowHold<DefensePlayInput> | null
  /**
   * 진행기가 판 끝에 찍은 "G2 만 닫힌 그림"(`closingListFrame`) — 원본은 닫힌 첫 갱신(+0x1094 = 1)에 목록 틱 · 카메라를 한 번 더 돌려
   * 이 그림을 그리고, 그 다음 갱신부터 G1 이 닫혀 카메라가 선다. 없으면 null
   */
  closingFrame: DefenseViewState | null
  /**
   * 홈런 연출(HOMERUN 글자 · 홈런 효과 · 파티클 · 비거리 판 — `lib/defenseHomeRunEffects`). 원본 한 그림 = 진행기 한 틱이라 틱마다
   * 갱신(홈런 갈래) → 그리기(글자 · 유지 그림의 효과 틱) → 파티클 틱 차례로 돌고, 판이 닫힌 뒤 갱신에도 그리기 · 파티클 틱은 돈다.
   * 난수는 진행기와 같은 경기 난수(`input.random`)다 — 진행기 굴림 뒤에 그 그림의 효과 · 파티클 굴림이 든다.
   */
  effects: DefenseEffects
  /** 마지막으로 돈 갱신 — 판이 닫힌 뒤 건너뛴 갱신을 따라잡는다 */
  closedUpdate: number | null
  /** 창이 선 첫 그림([창+0x250]) 가운데 다시 그린 수 */
  redrawn: number
  lastPicture: LivePicture | null
  /** `onDone` 을 부른 판 — 판이 끝난 뒤에도 남는 그림(0x1c)이 다시 그려져도 한 번만 부른다 */
  doneFor: DefensePlayState | null
}

export function createLivePlaybackSlots(sceneMemory: { current: DefenseSceneMemory } | undefined): LivePlaybackSlots {
  return {
    updateStartTickRef: { current: null },
    cameraOffsetRef: { current: null },
    state: null,
    builtFrom: null,
    builtSide: undefined,
    startedAt: 0,
    keys: newSceneKeyQueue(),
    drawnErrors: [],
    seenTickCount: 0,
    board: EMPTY_HOME_RUN_SCORE_BOARD,
    closedCount: 0,
    runnerSituationKey: '',
    burstHold: null,
    closingFrame: null,
    effects: defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START),
    closedUpdate: null,
    redrawn: 0,
    lastPicture: null,
    doneFor: null,
  }
}

/** 실시간 판 effect 들이 읽는 그 그림의 값 */
export interface LiveContext {
  readonly update: number
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly ended: boolean
  readonly runScoreBoard?: RunScoreBoardSource
  readonly sceneMemory?: { current: DefenseSceneMemory }
  /** 0x357e0 — 이 타구의 결과 코드 [+0xfd4] 가 24~26(홈런성)인가 */
  readonly homeRunHit: boolean
  readonly particles: ParticleScene
}

/** 화면 상태를 고치는 곳 — effect 가 옛 차례 그대로 부른다 */
export interface LiveScreenSetters {
  readonly setView: Dispatch<SetStateAction<DefenseViewState | null>>
  readonly setViewTick: Dispatch<SetStateAction<number | null>>
  readonly setRunnerSituation: Dispatch<SetStateAction<InPlayRunnerSituation>>
  readonly setEnded: Dispatch<SetStateAction<boolean>>
  readonly setClosed: Dispatch<SetStateAction<boolean>>
  readonly setRunBoard: Dispatch<SetStateAction<RunScoreBoardView | null>>
  readonly setEffectsView: Dispatch<SetStateAction<LiveEffectsView>>
}
