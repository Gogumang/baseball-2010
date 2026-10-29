import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { FielderState, PlayView } from '@/entities/fielding/model/fieldingState'
import type { CurrentBallPath } from '@/features/defense-play/model/coverTick'
import type { ActionMemory, DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { LaserFlags } from '@/features/defense-play/model/laserTick'
import type { LooseBallChase } from '@/features/defense-play/model/looseBallChase'
import type { PickoffPlayInput, PickoffResultCode, PickoffRunner } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import { loadedRunnerAceOf, runnerAceIndexesOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerPlayTickSound } from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **견제 판 하나의 칸** — 예전 `pickoffPlaySteps`(제너레이터 한 덩이)의 지역 변수들. 판 칸과 틱 칸(`ballEventThisTick` ·
 * `outJudgedThisTick` · `tickMessageCode` · `lastJudgedKind` · `pausedAtHead` · `pausedThisTick`)을 함께 든다(r371).
 */
export interface PickoffFrame {
  readonly input: PickoffPlayInput
  readonly ticks: DefensePlayView[]
  readonly sound: RunnerPlayTickSound
  readonly abilities: readonly (number | null)[]
  readonly autoBaserunningEnabled: boolean
  /** state[0x27] — 견제할 루 */
  readonly targetBase: PickoffBase
  readonly log: string[]
  readonly previousActions: ActionMemory
  fielders: readonly FielderState[]
  play: PlayView
  readonly runners: PickoffRunner[]
  outs: number
  outsAdded: number
  runsScored: number
  /** 주자관리+0x31c — 사람 슬라이딩 키의 효과음 잠금(한 판 한 번). 0x17 진입 0xa9fd0 이 지운다 */
  slidingSoundPlayed: boolean
  tagOut: boolean
  throwArrivalTick: number
  errantThrow: boolean
  fumbled: boolean
  resultCode: PickoffResultCode | null
  /** 날아가는 송구 — 견제 송구와 그 뒤 받은 야수의 이어 던지기 (0xb2e38). 그림 · 던지는 동작만 본다 */
  flight: { from: number; base: number; releaseTick: number } | null
  /** 야수 +0x3b — 마지막 목록 틱(이동)에서 목표점에 막 닿았다 (0xbf0dc). AI 2~5 b47f2 가 본다 */
  fielderArrivals: boolean[]
  /** 쫓는 공 — 송구공(b307c) · 튕긴 공(0xb3148). 받을(주울) 야수 · 포구 틱. 쥐면 null */
  chase: LooseBallChase | null
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 */
  ballBody: LooseBallChase['body']
  /** 지금 공 궤적(공.vt68(0) · 공.vt60) — 송구 · 튕김이 새로 깐다. 그 전에는 0xa276c 의 점 하나(투수판 0xd7c24 · 각 0) */
  ballPath: CurrentBallPath | null
  /** 플레이 +0x126 — 판 시작 vt20(b28cc → b11fe)이 1. 0xb203a 가 중계 자리를 잡으면 0 */
  relayFlag: boolean
  /** 처음 공을 쥔 틱 */
  catchTick: number
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2). 서면 틱 끝 b45a4 가 0xb3148 */
  ballEventThisTick: boolean
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 */
  endCounter: number
  /** 판을 닫은 관문 다음 그림의 G1 이 열렸나 (`fielderSlackAtPlayEnd`) */
  closingListTickOpen: boolean
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 결과 메시지 0xbba */
  outJudgedThisTick: boolean
  /** 이번 틱 플레이 틱이 보낼 결과 메시지 0xbba 의 코드 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다(b4562 에서 한 번) */
  tickMessageCode: number
  /** 수비 장면 연출 칸 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로 (`defenseScene`) */
  scene: DefenseScene
  /**
   * 플레이+0x160 — 사람 송구 목표. 판 시작 vt18 0xb27ec 의 견제 갈래 0xb28be 가 vt1c 0xb0edc 를 먼저 불러 b0f66~b0f68 이 −1 로 지운다
   * (앞 판의 키는 넘어오지 않는다). 키 메시지 0x588 이 쓰고 b46a8 이 −1
   */
  manualThrowBase: number
  /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운다 */
  laserOutFlag: boolean
  /** 경기+0x19ad · +0x19ae · +0x19af — 레이저 반짝임 · 확정 · 굴림 마침 (`laserTick`, r201) */
  laserFlags: LaserFlags
  /** 플레이+0x1f4 — 레이저 발사 0x400bc 가 세우고 다음 송구 b2f06 이 레이저(vtb0 0xa222c)로 던진 뒤 내린다 */
  laserArmed: boolean
  /** 레이저로 던졌다 (판 결과 `laserThrow`) */
  laserThrow: boolean
  /** **그림 전용** 장면 +0x1991 — 레이저 잔상 */
  laserTrailOn: boolean
  /** 장면 +0x1993 — 경기 멈춤. 0x400bc 가 세우고 연출 0x4403c 단계 1 이 내린다 */
  gamePaused: boolean
  /** 앞 틱 끝 G2 앞의 +0x120 — 이 틱 머리에서 멈추면 G2 를 안 부른 것으로 되돌린다 */
  counterBeforeHead: number
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  deferredThrowReceiver: number
  deferredThrowBase: number
  /**
   * 송구 계획 +0x14c [4] · [7] — 중계([0] = 1)면 최종 받는 야수 · 목표 루, 아니면 −1. 0xb2e38 이 덮어쓰고 0xb0ea0(판 시작 vt1c ·
   * CPU 송구 결정 0xafa60 성공 뒤)이 지운다. 중계맨이 쥐면 플레이 틱 b4616 이 [4] 에게 던진다 (`runnerPlayEngine` 3a 절)
   */
  relayFinalSlot: number
  relayBase: number
  /**
   * **그림 전용** 경기+0x19ac — 쥐기 0xb2710 의 메시지 0x15 가 세우고 0x17 진입 0x467de 가 내린다. 판 시작에 투수가 쥔 공
   * (0xb28be)은 0x46418 안에서 0x467de 보다 앞이라 지워진다 — 견제 송구를 받은(주운) 야수가 쥘 때 선다
   */
  grabbed: boolean
  /** **그림 전용** 야수 +0xb8(펌블 표시) · +0xc0(송구 실수 표시) — `runDefensePlay` 와 같은 칸 */
  fumbleMarks: number[]
  throwErrorMarks: number[]
  readonly runnerAceIndexes: ReturnType<typeof runnerAceIndexesOf>
  readonly runnerAceSprite: ReturnType<typeof loadedRunnerAceOf>
  /** `0xae6c8`([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 슬롯 2 의 0xafa60 이 매 틱 돈다 */
  readonly cpuThrowEnabled: boolean
  /** 바로 앞 0xb36d0 한 번의 결과 */
  lastJudgedKind: number
  /** 이 틱이 멈춘 그림인가 — 머리에서 이미 +0x1993 이 서 있다(목록 틱 · 슬롯 2 가 통째로 없다, 타구 진행기와 같다) */
  pausedAtHead: boolean
  /** 이 틱 머리(슬롯 2 머리)에서 0x400bc 가 경기를 멈췄는가 */
  pausedThisTick: boolean
}
