import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'

/** 0x4e060 `[+0x2c] > 9` — 사람 공은 0x11 의 틱 10 에 놓는다 (`PitchGradeGauge`) */
export const HUMAN_PITCH_RELEASE_STATE_TICK = 10

export interface PitcherSideStageClock {
  /** 지금 장면 틱 */
  readonly nowTick: number
  /** 마지막 공을 놓은 장면 틱 (0x11 틱 10). 이 화면에서 던진 공이 없으면 null */
  readonly releaseTick: number | null
  /** 그 공의 경로 점 수 N */
  readonly frameCount: number
  /**
   * 0x12 대기 문턱 (0x4e6d4 — 15, 타석이 끝났으면 31). 0 이면 0x12 를 안 지난다(맞은 공).
   * 0x12 는 상태 틱 0 ~ 문턱의 **문턱 + 1 그림**이다(4e72c `틱 < 문턱` 이면 기다리고, 문턱 틱의 갱신이 다음 상태를 예약한다 — 타자편
   * `resultPhaseTicksOf` 와 같은 셈)
   */
  readonly resultTicks: number
  /** 0xd · 0xe 확인 대기 따위 — 쉬는 '대기' */
  readonly isPaused: boolean
  /** 쉬기 시작한 장면 틱 (쉬지 않으면 무시) */
  readonly pausedSinceTick: number
  /** 마운드 마투수 순번 (0~4) — 공 틱이 오르는 단계가 0xcfbe4[순번]이다(0x3f378). 없으면 평범한 투수(단계 6) */
  readonly aceOrder?: number | null
  /**
   * 그 공이 맞은 공(0x13 → 0x17)이면 판정 공 틱 · 0x13 길이 (`pitcherHitSceneOf`). 없으면 맞은 공도 예전처럼 공 틱 N + 1 에서 대기다
   */
  readonly hit?: PitcherHitClock | null
}

/** 맞은 공의 0x11 끝 · 0x13 — `PitcherSideStageClock.hit` */
export interface PitcherHitClock {
  /** 판정(0x6aa) 공 틱 J — 이 틀의 갱신이 0x13 을 예약한다(`PitcherHitScene.judgeBallTick`) */
  readonly judgeBallTick: number
  /** 0x13 이 0x17 을 예약하는 상태 틱 (`hitPause.hitPauseTicksOf`) */
  readonly ticks: number
  /** OK · '5' 건너뛰기(0x406e8 40708)를 읽은 0x13 상태 틱 — 없으면 null (큰 타구만) */
  readonly skipTick?: number | null
  /**
   * 큰 타구 0x13 동안 창이 선 첫 그림([창+0x250])이 든 자리 — 그 앞에 마지막으로 갱신한 0x13 틱(`bigHitScreen.bigHitReleaseTickOf`).
   * 그 그림의 0x4cb1c 가 [+0x10a8] 을 한 번 더 줄여 막음이 일찍 풀리고 0x13 이 그만큼 일찍 끝난다. 안 주면 없음
   */
  readonly frozenDraws?: readonly number[]
}

export interface PitcherSideStageFrame {
  readonly phase: StagePhaseSnapshot
  /** 공 경로 번호 F (0 = 릴리스). 공이 날지 않으면 −1 */
  readonly ballFrame: number
  /**
   * 0x11 진입(투수 그림 객체 상태 1) 뒤 틱 — 투수 단계 표가 본다. 0x12 에도 이어져 마지막 자세에 머문다.
   * '대기'(다음 0xf 진입이 상태 0 으로 되돌린 뒤)면 null
   */
  readonly pitcherTick: number | null
  /**
   * 0x11 의 마지막 갱신 틱(`pitcherTick` 셈) — 공 틱 N + 1 의 0x4e060 이 0x12 를 예약한 그림. 그 뒤로는 투수 갱신 0x9e004 가
   * 안 불려 단계가 굳는다(0x9e004 는 0xf · 0x11 갱신에서만). 0x11 이거나 '대기' 면 null
   */
  readonly pitcherTickEnd: number | null
}
