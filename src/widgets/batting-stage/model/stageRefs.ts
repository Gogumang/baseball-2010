import { useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { PITCHER_RELEASE_TICKS } from '@/widgets/batting-stage/lib/stageScenery'

export type StagePhase = '대기' | '투구중' | '결과'

export type StageHud = StageScene['hud']

export interface AcePitcherFrames {
  readonly framesUrl: string
  readonly frameCount: number
  readonly stillUrl: string
}

/** 번트 자세 — 종류와 누른 순간의 공 프레임 (0x53670 토글) */
export interface BuntStance {
  readonly kind: number
  readonly frame: number
}

/** 매 프레임 최신 값을 읽어야 하는 props 묶음. */
export interface StageLatest {
  readonly batterAbility: BatterAbility
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  readonly hud: StageHud | null
  readonly acePitcher: AcePitcherFrames | null
  readonly canBunt: boolean
  readonly isPaused: boolean
  readonly random: RandomPort
  readonly swingMode: SwingMode
  readonly batterSkillIds: readonly number[]
  /** 최근 타석 기록 코드 — 스킬 16·17 조건 */
  readonly recentAtBatCodes: readonly number[]
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch) => void
}

export interface StageRefs {
  readonly canvasRef: RefObject<HTMLCanvasElement>
  readonly pitchRef: MutableRefObject<Pitch | null>
  readonly phaseRef: MutableRefObject<StagePhase>
  readonly phaseStartedAtRef: MutableRefObject<number>
  readonly resultTextRef: MutableRefObject<string>
  readonly swingStartedAtRef: MutableRefObject<number>
  readonly shiftRef: MutableRefObject<number>
  readonly buntRef: MutableRefObject<BuntStance | null>
  readonly deckRef: MutableRefObject<PatternDeck | null>
  readonly pointerDownAtRef: MutableRefObject<number>
  readonly latestRef: MutableRefObject<StageLatest>
}

/**
 * 타석 연출의 가변 상태를 전부 ref로 든다.
 * 매 프레임 최신 값을 읽어야 하고, props가 바뀌어도 애니메이션 루프를
 * 다시 시작하면 안 되기 때문이다.
 */
export function useStageRefs(latest: StageLatest): StageRefs {
  const latestRef = useRef(latest)
  latestRef.current = latest

  return {
    canvasRef: useRef<HTMLCanvasElement>(null),
    pitchRef: useRef<Pitch | null>(null),
    phaseRef: useRef<StagePhase>('대기'),
    phaseStartedAtRef: useRef(0),
    resultTextRef: useRef(''),
    swingStartedAtRef: useRef(-1),
    shiftRef: useRef(0),
    buntRef: useRef<BuntStance | null>(null),
    deckRef: useRef<PatternDeck | null>(null),
    pointerDownAtRef: useRef(0),
    latestRef,
  }
}

/** 투구 시작부터 흐른 틱 */
export function pitchTickAt(now: number, startedAt: number, millisecondsPerTick: number): number {
  return Math.floor((now - startedAt) / millisecondsPerTick)
}

/**
 * 공 프레임 F — 투수 애니가 릴리스 단계(6)에 닿은 뒤부터 매 틱 +1 (0x3f378).
 * 그 전에는 음수라 공을 그리지 않는다.
 */
export function ballFrameAt(now: number, startedAt: number, millisecondsPerTick: number): number {
  return pitchTickAt(now, startedAt, millisecondsPerTick) - PITCHER_RELEASE_TICKS
}
