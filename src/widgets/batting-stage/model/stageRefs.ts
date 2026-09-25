import { useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { BatterEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { PITCHER_RELEASE_TICKS } from '@/widgets/batting-stage/lib/stageScenery'

/** 원본 경기 상태 — 대기·투구중 0xf/0x11 · **타격 0x13** · 결과 0x12/0x17 */
export type StagePhase = '대기' | '투구중' | '타격' | '결과'

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

/**
 * 상태 0x13 동안 손에 들고 있는 타격 결과 — 이 단계가 끝나야 인플레이(0x17)로 넘긴다.
 * 결과 문구·HOMERUN 글자도 여기서 꺼내므로 붙잡아 두는 동안에는 화면에 뜨지 않는다.
 */
export interface PendingHit {
  /** 붙잡아 둘 틱 수 (0x406a4 문턱 또는 틱 8) */
  readonly ticks: number
  readonly detail: PitchOutcomeDetail
  readonly pitch: Pitch
  readonly isUncatchable: boolean
  readonly isHomeRun: boolean
  /**
   * 큰 타구 감상이 끝나는 자리에 쏠 파티클의 화면 좌표 (0x4cb1c → 0x4cd14 의 `016.ptc`).
   * 감상 플래그 `+0x199a` 가 꺼진 타구면 null 이라 아무것도 안 쏜다.
   */
  readonly bigHitAt: { readonly x: number; readonly y: number } | null
  readonly resultText: string
}

/** 매 프레임 최신 값을 읽어야 하는 props 묶음. */
export interface StageLatest {
  readonly batterAbility: BatterAbility
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  readonly hud: StageHud | null
  readonly acePitcher: AcePitcherFrames | null
  readonly canBunt: boolean
  /** 타자 폼 (원본 rec[0xb] 윗니블 = 2 × 타입 + 손). 몸통·자세표를 `폼 >> 1` 로 고른다 */
  readonly batterForm: number
  /** 타자 그림 팔레트 재료 — 몸통 피부×15+팀 · 헬멧 팀 (0x78be8·0x78c14) */
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /** 장착 장비의 등급 순번 (부위별 −1 = 미장착) — 머리·손·다리 그림 슬롯을 채운다 */
  readonly batterEquipment: BatterEquipment
  /**
   * 시즌 구장 세 값 (관중석 칸·관중 단계·전광판 칸). 차 있으면 배경을 시즌 구장 0x77494 로 그린다 —
   * 원본은 모드 2 의 **홈경기**(0x40ff0 `내 팀 == 홈팀`)와 대전 모드 8·9 에서만 그 길로 간다.
   */
  readonly seasonStadium?: SeasonStadium
  readonly isPaused: boolean
  readonly random: RandomPort
  readonly swingMode: SwingMode
  readonly batterSkillIds: readonly number[]
  /** 최근 타석 기록 코드 — 스킬 16·17 조건 */
  readonly recentAtBatCodes: readonly number[]
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean) => void
}

export interface StageRefs {
  readonly canvasRef: RefObject<HTMLCanvasElement>
  readonly pitchRef: MutableRefObject<Pitch | null>
  readonly phaseRef: MutableRefObject<StagePhase>
  readonly phaseStartedAtRef: MutableRefObject<number>
  readonly resultTextRef: MutableRefObject<string>
  /**
   * 홈런 글자 연출(원본 켜짐 칸 +0x1960)이 켜진 시각. −1 이면 꺼짐.
   * 원본은 홈런 판정 가지에서 켜고 다음 플레이가 지울 때까지 돌리므로,
   * 웹도 결과 문구 시간과 따로 두고 **다음 투구가 시작할 때** 끈다.
   */
  readonly homeRunStartedAtRef: MutableRefObject<number>
  readonly swingStartedAtRef: MutableRefObject<number>
  readonly shiftRef: MutableRefObject<number>
  readonly buntRef: MutableRefObject<BuntStance | null>
  readonly deckRef: MutableRefObject<PatternDeck | null>
  /** 상태 0x13 이 붙잡고 있는 타격 결과. 없으면 이 단계가 아니다 */
  readonly pendingHitRef: MutableRefObject<PendingHit | null>
  /** 살아 있는 파티클 이미터 목록 (원본 파티클 관리자 [0x1400068]) */
  readonly particlesRef: MutableRefObject<ParticleScene>
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
    homeRunStartedAtRef: useRef(-1),
    swingStartedAtRef: useRef(-1),
    shiftRef: useRef(0),
    buntRef: useRef<BuntStance | null>(null),
    deckRef: useRef<PatternDeck | null>(null),
    pendingHitRef: useRef<PendingHit | null>(null),
    particlesRef: useRef<ParticleScene>(createParticleScene()),
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
