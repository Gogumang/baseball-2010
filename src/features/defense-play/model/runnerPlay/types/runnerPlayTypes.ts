import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { FielderState, PlayView, RunnerState } from '@/entities/fielding/model/fieldingState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { DefenseKeyPress, DefensePlayControls, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 결과 코드 — 9 세이프(0xb4292) · 13 아웃(0xb4556) */
export const RUNNER_PLAY_RESULT = { SAFE: 9, OUT: 13 } as const
/** 송구를 고른 쪽 — 사람 키(참) · CPU 결정(거짓) · AI 9 미룬 송구 · 중계 이어 던지기(b4616) */
export type ThrowChooser = boolean | '미룬' | '중계'

export type RunnerPlayResultCode = (typeof RUNNER_PLAY_RESULT)[keyof typeof RUNNER_PLAY_RESULT]

/** (종류 9) 공을 쫓아 줍는 갈래 */
export interface LooseBallChase {
  readonly trajectory: BattedBallTrajectory
  /** 쫓는 야수 (+0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 예보의 다이빙 후보 틱 +0x178[칸] (`catchForecast.diveTicks`) — 다이빙 검사 b46e2 가 본다 */
  readonly diveTicks?: readonly number[]
  /** 고르기가 적은 +0x174 그대로(판 끝으로 자르기 전) */
  readonly forecastCatchTick?: number
}

export interface RunnerPlayEngineInput {
  readonly kind: number
  /** 시작 야수 — 목표·커버가 이미 세워진 것 */
  readonly fielders: readonly FielderState[]
  /** 시작 플레이 칸 — 커버(+0xf0)·공 쥔 야수(+0x130)·쥠(+0x12c)·+0x112 */
  readonly play: PlayView
  /** 시작 주자 — 원본 목록 순서 */
  readonly runners: readonly RunnerState[]
  readonly abilities: readonly (number | null)[]
  readonly outs: number
  /** state[0x1e] 시작 값 — 공이 땅에 닿았거나 잡혔음 */
  readonly ballOnGround: boolean
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1 로 세우고 판 시작 0xb1c90 의 0xb203a 가 중계 자리를 잡으면 0. 안 주면 1 */
  readonly relayFlag?: boolean
  /** 없으면 처음부터 `play.ballHolderSlot` 이 쥐고 있다 */
  readonly chase?: LooseBallChase
  /**
   * 아무도 손에 안 쥔 채 땅에 놓인 공의 자리 — 종류 2(밀어내기)는 0xa276c 가 공 첫 점을 0xd7c24(투수판)에 두고 쥐기를 안 부른다.
   * 없으면 공은 공 가진 야수(+0x130) 자리에 그린다.
   */
  readonly restingBall?: WorldPoint
  readonly random?: RandomPort
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) +3%p (`DefensePlayInput.fielderSkillIds`). 안 주면 없음 */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /**
   * 판이 열릴 때의 사람 송구 목표 루 (플레이+0x160, 시험용). 안 주면 −1 — 0x17 진입 0x46418 의 판 시작 vt18 0xb27ec 가
   * 종류 2·3(0xb288c) · 5(0xb2950) · 9(0xb284a) 모두 vt1c 0xb0edc 를 먼저 부르고 그 b0f66~b0f68 이 +0x160 = −1 을 적으므로
   * 앞 판의 키는 넘어오지 않는다. 그 키로 한 번 던지면 −1 로 지운다(b46a8).
   */
  readonly manualThrowBase?: number
  /**
   * 사람 조작 — 이 판 동안 틱마다 눌린 키(`runDefensePlay` 와 같은 꼴). 상태 0x17 키 0x53420 은 판 종류를 안 가린다 —
   * 사람이 수비면 0x533c8 이 메시지 0x588(목표 루) → 0x51890 → 플레이 vt60 → +0x160. 안 주면 키가 없다.
   * 사람이 공격(`side: '공격'`)이면 같은 키가 주루 0x5331c(0x582 진루 · 0x584 귀루) · OK 슬라이딩 0x585 다.
   */
  readonly controls?: DefensePlayControls
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly maximumTicks?: number
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) — 이 판들(밀어내기 · 도루 · 폭투)은 투구 뒤라 +0x1997 · 애니가 되감겨 있다 */
  readonly scene?: DefenseScene
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`). 안 주면 고리만 그린다 */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 주자 칸(`RunnerState.index`) → 마선수 번호 (`runnerAces.runnerAceIndexesOf`). 안 주면 아무도 마선수가 아니다 */
  readonly runnerAceIndexes?: readonly (number | null)[]
  /** 타석 교대 0x483a0 이 실은 주자 마선수 그림 번호 (`runnerAces.loadedRunnerAceOf`) */
  readonly runnerAceSprite?: number | null
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  /**
   * 판이 열릴 때의 야수 +0xb8(펌블 표시, 칸별). 폭투 · 포일 판정 0x3e062(0x3e08c~0x3e092)가 **포수 +0xb8 = 6** 을 적고
   * 0x17 로 간다 — 첫 그림 앞 야수 틱(a12da)이 하나 줄여 첫 그림은 5 다(`passedBallPlay`). 안 주면 0
   */
  readonly fumbleMarks?: readonly number[]
  /**
   * **판을 안 열고 CPU 송구 결정 0xafa60 한 번만** — 도루 키 0x583 의 52222(`stealPlay.stealStartThrowDecision`). 판 시작 자동 진루
   * 0x46766 도 틱도 없이, 앞 판이 끝난 그대로의 플레이 · 야수(`fielders` · `play`)로 0xafa60 → 0xb2c90 → 0xb2e38 을 돌리고 끝낸다.
   * 결과의 `scene.playEnd` 가 그 뒤 상태다(+0x128 · 쥠 · 던진 야수)
   */
  readonly throwDecisionOnly?: boolean
}

export interface RunnerPlayEngineResult extends DefensePlayResult {
  readonly kind: number
  /** 9 세이프 · 13 아웃 · null(결과 코드 없이 끝남 — 송구가 없었거나 악송구) */
  readonly resultCode: RunnerPlayResultCode | null
}

export interface PlayRunner {
  state: RunnerState
  counted: boolean
  /** 주자 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표 루에 막 닿았다. 득점 0xaa0a8(aa12a)이 본다 */
  arrivedThisListTick: boolean
  /**
   * 주자 +0x84 — 직전 목표 루. vt88(0xa0820, 루에 세우기)과 도착 0xa040c 가 +0x8c 로, vt48(0xa07b0)이 목표가 바뀔 때 옛 +0x7c 로 적는다.
   * 사람 진루 키의 앞길 검사(0xa9924 → 방향 판정 0x9fe80)가 본다
   */
  previousTarget: number
}

/** 날아가는 송구 — 던진 야수 · 목표 루 · 손을 떠난 틱 (받는 틱 · 받는 야수는 쫓는 공 `LooseBallChase`) */
export interface ThrowInFlight {
  readonly from: number
  readonly base: number
  readonly releaseTick: number
}

/**
 * 판을 한 틱씩 돌리는 손잡이 — 화면이 실시간으로 키를 넣을 때 쓴다(`DefensePlayback` 의 주자 판 갈래).
 * `step(키)` 한 번 = 그 틱 하나(키는 그 틱 머리에 먹인다). 다 돌면 `result()`.
 */
export interface RunnerPlayStepper {
  /** 다음에 돌 틱 */
  readonly tick: number
  readonly finished: boolean
  /** 지금까지 그린 그림 */
  readonly ticks: readonly DefensePlayView[]
  /**
   * 방금 돈 틱에서 슬라이딩 효과음 10 을 낸다 — 사람 슬라이딩 키 0x518da 의 0x5199c(+0x31c 잠금으로 한 판 한 번) · 자동 슬라이딩
   * 0x5268c(잠금 없음). 진행기는 소리를 못 내므로 화면이 이 칸을 보고 그 틱에 낸다(`runDefensePlay` 의 같은 칸)
   */
  readonly slidingSoundThisTick: boolean
  /**
   * 방금 돈 틱에 낸 소리 — 낸 차례대로. 사람 슬라이딩 키(틱 머리) → 결과 메시지 0xbba 의 판정 콜(플레이 틱 b4562 →
   * 0xbfbac → 0xbfb78 이 받는 곳 vt+0xc 를 곧바로 부른다 → 0x51a56 → 표 0xd0488: 9 → 0x51c14(17) · 13 → 0x51b36(62/20)) →
   * 자동 슬라이딩 0x5268c(슬롯 2 의 vt48 플레이 틱 0x525e8 뒤). 화면은 이것을 그 틱에 차례로 낸다 (`runnerPlayCallSoundIdOf`)
   */
  readonly soundsThisTick: readonly number[]
  step(press: DefenseKeyPress | null): void
  result(): RunnerPlayEngineResult
}

/** 진행기가 틱마다 적는 소리 칸 — 슬라이딩 10 이 났나 · 그 틱에 낸 소리(차례대로) · 득점 0xaa0a8 이 끼는 자리 */
export interface RunnerPlayTickSound {
  slidingThisTick: boolean
  thisTick: number[]
  /**
   * 이 틱의 득점 0xaa0a8(슬롯 2 525fc)이 `thisTick` 의 몇 번째 자리에 끼는가 — 그 앞은 사람 슬라이딩 키(틱 머리) · 플레이 틱
   * vt48(525e8)의 판정 콜, 그 뒤는 자동 슬라이딩 0x5268c(52670). 득점의 메시지 0x13 → 0x51fb8 함성은 화면이 그림으로 세어
   * 이 자리에 낀다(`DefenseViewState.tickRunInSoundAt`). 0xaa0a8 을 안 부른 틱이면 없다
   */
  runInAt?: number
}
