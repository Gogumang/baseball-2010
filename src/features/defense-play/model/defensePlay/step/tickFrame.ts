import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import type { DefenseKeyPress } from '@/features/defense-play/model/defensePlay/types/defenseKeyPress'
import type { DefensePlayState, DefenseTickSound } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **판 틱 하나의 칸** — `stepDefensePlay` 가 한 틱을 도는 동안만 사는 값. 판 상태(`DefensePlayState`)는 틱 몸통이 그 자리에서 고치고,
 * 이 칸은 그 틱의 머리 값 · 틱 안의 표시 · 틱 끝에 상태로 넘기는 출력(소리 · 득점 메시지)을 든다.
 * 예전에는 한 함수의 지역 변수 80여 개였다 — 판 칸은 상태로, 틱 칸은 여기로 갈랐다(r371).
 */
export interface TickFrame {
  /** 이 판 틱 (`state.tick` 머리 값 — 틱 끝에 +1) */
  readonly tick: number
  /** 이번 틱에 눌린 키 */
  readonly key: DefenseKeyPress | null
  /** 0xae690([장면+0x214], 설정+0xbd) — 공격이 CPU 거나 주루 설정이 자동이면 자동 진루 제어기가 돈다. 안 넘기면 원본 기본값(자동) */
  readonly autoBaserunningEnabled: boolean
  /**
   * 0xae6c8([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 CPU 송구 결정 제어기(0xaf8e0 → vt0xc = 0xafa60 →
   * 점수식 0xafb24)가 돈다. 안 넘기면 원본 기본값(수동)이다
   */
  readonly cpuThrowEnabled: boolean
  /** 이 틱이 멈춘 그림 F+1 인가 — 머리에서 이미 +0x1993 이 서 있다(0x3f060 의 목록 틱 · 슬롯 2 가 통째로 없다) */
  readonly pausedAtHead: boolean
  /** 머리의 키 건너뛰기(+0xfe7) — 이 그림에 막 누른 건너뛰기를 가른다 */
  readonly fastForwardAtHead: boolean
  /** 이 틱 머리(그림 F 의 슬롯 2 머리)에서 0x400bc 가 경기를 멈췄는가 */
  pausedThisTick: boolean
  /** 6d 절 b4492 — 아무도 쥐기 전에 공이 이 틱에 처음 땅에 닿았다(+0x113 = 1, 공+0x68 == 공+0xaa0) */
  landedUncaughtThisTick: boolean
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2 · 필살타법 표시 공 0xbc3 — 송구 받기는 사건 없이 b42c8 쥐기). 서면 틱 끝 b45a4 가 플레이.vt70 = 0xb3148 */
  ballEventThisTick: boolean
  /** sp+0x38 — 포구 틱 b4292 가 세운 결과 코드 9(발밑 루에 주자가 서 있는 포구). 6c 절의 결과 코드가 이어받는다 */
  catchResultCode: number
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba (6c 절) */
  outJudgedThisTick: boolean
  /** 이번 틱 쥐기 0xb2710 안의 판정(0xb2758)이 아웃을 냈나 — 같은 플레이 틱의 두 번째 판정(6b 절)이 state[0x87] 을 다시 적는다 */
  grabOutThisTick: boolean
  /** 바로 앞 `runOutJudgement` 한 번의 결과 종류 — 쥐기의 뜬공 아웃(결과 1)을 가른다 */
  judgedKindThisCall: number
  slidingSoundThisTick: boolean
  hitStaggerSoundThisTick: boolean
  readonly runInsThisTick: number[]
  readonly tickSounds: DefenseTickSound[]
}

/** 틱 머리 — 판 상태에서 이 틱의 칸을 연다 */
export function openTickFrame(state: DefensePlayState, key: DefenseKeyPress | null): TickFrame {
  const input = state.input
  return {
    tick: state.tick,
    key,
    autoBaserunningEnabled: input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동',
    cpuThrowEnabled: input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동',
    pausedAtHead: state.gamePaused,
    fastForwardAtHead: state.fastForward,
    pausedThisTick: false,
    landedUncaughtThisTick: false,
    ballEventThisTick: false,
    catchResultCode: 0,
    outJudgedThisTick: false,
    grabOutThisTick: false,
    judgedKindThisCall: OUT_KIND.NONE,
    slidingSoundThisTick: false,
    hitStaggerSoundThisTick: false,
    runInsThisTick: [],
    tickSounds: [],
  }
}

/** 틱 끝 — 이 틱의 출력 칸을 상태에 넘기고 판 틱을 하나 올린다 */
export function closeTickFrame(state: DefensePlayState, frame: TickFrame): void {
  state.slidingSoundThisTick = frame.slidingSoundThisTick
  state.hitStaggerSoundThisTick = frame.hitStaggerSoundThisTick
  state.runInsThisTick = frame.runInsThisTick
  state.tickSounds = frame.tickSounds
  state.tick = frame.tick + 1
}
