import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState, PlayView } from '@/entities/fielding/model/fieldingState'
import type { HeldRunState } from '@/entities/fielding/model/heldRuns'
import type { CurrentBallPath } from '@/features/defense-play/model/coverTick'
import type { ActionMemory } from '@/features/defense-play/model/defensePlayView/actionMemory'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { LaserFlags } from '@/features/defense-play/model/laserTick'
import type { LooseBallChase as ChasedBall } from '@/features/defense-play/model/looseBallChase'
import type {
  PlayRunner,
  RunnerPlayEngineInput,
  RunnerPlayResultCode,
  RunnerPlayTickSound,
  ThrowInFlight,
} from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/**
 * **주자 판 하나의 칸** — 예전 `runnerPlaySteps`(제너레이터 한 덩이)의 지역 변수들. 판 칸(판 내내 남는다)과 틱 칸(이번 틱만 —
 * `ballEventThisTick` · `outJudgedThisTick` · `tickMessageCode` · `lastJudgedKind` · `pausedAtHead` · `pausedThisTick`)을 함께 든다.
 * 각 절(`tick/…`)은 이 칸을 그 자리에서 고친다(r371).
 */
export interface RunnerPlayFrame {
  readonly input: RunnerPlayEngineInput
  /** 그림 — 바깥 stepper 와 같은 배열 */
  readonly ticks: DefensePlayView[]
  /** 이 틱의 소리 — 바깥 stepper 와 같은 칸 */
  readonly sound: RunnerPlayTickSound
  readonly abilities: readonly (number | null)[]
  readonly maximumTicks: number
  readonly autoBaserunningEnabled: boolean
  readonly cpuThrowEnabled: boolean
  /** 플레이+0x160 — 사람이 고른 송구 목표 (키 메시지 0x588 이 쓰고 b46a8 이 −1) */
  manualThrowBase: number
  /** 플레이 vt4c 0xb45dc(사람 목표 b4660 · AI 9 b4838)가 도는 판인가 */
  readonly vt4cRuns: boolean
  readonly log: string[]
  readonly previousActions: ActionMemory
  fielders: readonly FielderState[]
  play: PlayView
  /** +0x84 — 판을 연 0x3d7b8 의 vt48 두 번 뒤 값(`previousTargetAfterLead`) */
  readonly runners: PlayRunner[]
  /** 주자관리+0x31c — 사람 슬라이딩 키의 효과음 잠금(한 판 한 번). 0x17 진입 0xa9fd0 이 지운다 */
  slidingSoundPlayed: boolean
  outs: number
  outsAdded: number
  held: HeldRunState
  ballOnGround: boolean
  tagOut: boolean
  resultCode: RunnerPlayResultCode | null
  /** 쫓는 공 — 종류 9 의 폭투 · 포일 공(0xb284a), 송구공(b307c), 튕긴 공(0xb3148). 쥐면 null */
  chase: ChasedBall | null
  /**
   * 다이빙 검사(`diveCheck`, r180)가 보는 지금 공 — +0x178 · +0x174 · 공+0x68 의 0 틱 · 쥔 틱(쥔 동안 0x3f378 이 공+0x68 을 안 올린다).
   * 첫 점이 표준 배팅 지점인 폭투 · 포일 공(0xb284a)만 후보가 있다 — 송구 · 튕긴 공은 새 예보가 모두 1000 으로 채운다
   */
  diveBall: DiveBall
  /** 처음 공을 쥔 틱 (종류 9) */
  firstCatchTick: number
  fumbled: boolean
  errantThrow: boolean
  firstThrowBase: number
  firstThrowArrival: number
  /** 지금 날아가는 송구 — 자동 슬라이딩 · 그림이 본다 */
  flight: ThrowInFlight | null
  /** 야수 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다 (0xbf0dc). AI 2~5 b47f2 가 본다 */
  fielderArrivals: boolean[]
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 */
  ballBody: ChasedBall['body']
  /** 지금 공 궤적(공.vt68(0) · 공.vt60 이 읽는 점들) — 폭투 공 · 송구 · 튕김이 새로 깐다. 없으면 0xa276c 의 점 하나 */
  ballPath: CurrentBallPath | null
  /** 0xa276c — 종류 5 는 포수 자리 0xd7c30, 그 밖은 투수판 0xd7c24 (밀어내기 종류 2 는 `restingBall` 로 받는다) */
  readonly placedBallPoint: WorldPoint
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1. 0xb203a 가 중계 자리를 잡으면 0 */
  relayFlag: boolean
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2). 서면 틱 끝 b45a4 가 0xb3148 */
  ballEventThisTick: boolean
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba */
  outJudgedThisTick: boolean
  /** 이번 틱 플레이 틱이 보낼 결과 메시지 0xbba 의 코드 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다(b4562 에서 한 번) */
  tickMessageCode: number
  /** 수비 장면 연출 칸 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로 (`defenseScene`) */
  scene: DefenseScene
  /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운다 */
  laserOutFlag: boolean
  /** 경기+0x19ad · +0x19ae · +0x19af — 레이저 반짝임 · 확정 · 굴림 마침 (`laserTick`, r201) */
  laserFlags: LaserFlags
  /** 플레이+0x1f4 — 레이저 발사 0x400bc 가 세우고 다음 송구 b2f06 이 레이저(vtb0 0xa222c)로 던진 뒤 내린다 */
  laserArmed: boolean
  /** 레이저로 던졌다 (판 결과 `laserThrow`) */
  laserThrow: boolean
  /** **그림 전용** 장면 +0x1991 — 레이저 잔상. 0x400bc 가 세우고 5254c 가 포구 관문(동작 시작 틱 − 1)에서 내린다 */
  laserTrailOn: boolean
  /** 장면 +0x1993 — 경기 멈춤. 0x400bc 가 세우고 연출 0x4403c 단계 1 이 내린다 */
  gamePaused: boolean
  /** 앞 틱 끝 G2 앞의 +0x120 — 이 틱 머리에서 멈추면 G2 를 안 부른 것으로 되돌린다 */
  counterBeforeHead: number
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 */
  endCounter: number
  /** 판을 닫은 관문 다음 그림의 G1 이 열렸나 (`fielderSlackAtPlayEnd`) */
  closingListTickOpen: boolean
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  deferredThrowReceiver: number
  deferredThrowBase: number
  /**
   * 송구 계획 +0x14c [4](+0x150) — 계획이 중계([0] = 1)면 최종 받는 야수, 아니면 −1 · [7](+0x153) 그 목표 루. 0xb2e38 이 덮어쓰고
   * 0xb0ea0 이 지운다(판 시작 vt1c b0f48 · CPU 송구 결정 0xafa60 성공 뒤 afb08). 중계맨이 쥐면 플레이 틱 b4616 이 [4] 에게 던진다
   */
  relayFinalSlot: number
  relayBase: number
  /**
   * **그림 전용** 경기+0x19ac — 쥐기 0xb2710 의 메시지 0x15(0x51872)가 세우고 0x17 진입 0x467de 가 내린다. 도루 판의 포수 ·
   * 판 시작 쥐기(b29d4 의 0xb2710)는 0x17 진입 0x46418 안에서 0x467de 보다 앞이라 지워진다 — 판 동안 새로 쥘 때 선다
   */
  grabbed: boolean
  /** **그림 전용** 야수 +0xb8(펌블 표시) · +0xc0(송구 실수 표시) — `runDefensePlay` 와 같은 칸 */
  fumbleMarks: number[]
  throwErrorMarks: number[]
  /** 바로 앞 0xb36d0 한 번의 결과 — 같은 플레이 틱의 두 번째 판정이 state[0x87] 을 다시 적는다(타구 진행기 `grabOutThisTick`) */
  lastJudgedKind: number
  /** 이 틱이 멈춘 그림인가 — 머리에서 이미 +0x1993 이 서 있다(0x3f060 의 목록 틱 · 슬롯 2 가 통째로 없다, 타구 진행기와 같다) */
  pausedAtHead: boolean
  /** 이 틱 머리(슬롯 2 머리)에서 0x400bc 가 경기를 멈췄는가 */
  pausedThisTick: boolean
}

/** 다이빙 검사가 보는 공 (`RunnerPlayFrame.diveBall`) */
export interface DiveBall {
  readonly ticks: readonly number[]
  readonly catchTick: number
  readonly launchTick: number
  readonly trajectory: BattedBallTrajectory | null
  readonly heldAt: number
}
