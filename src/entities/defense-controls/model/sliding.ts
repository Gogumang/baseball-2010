/**
 * 슬라이딩 — 사람 키(OK) 와 자동 슬라이딩 (binary.mod 0x518da · 0xa96ec · 0xa9690 · 0xb030c).
 *
 * 원본에서 슬라이딩의 이득은 **딱 하나, 속도 +40/틱** 이다 (R3-field-view.md 3절 확정).
 * 태그·포스 판정 0xb36d0 은 "슬라이딩 중"(주자+0xb8)을 보지 않는다 — 도착 틱이 당겨질 뿐이다.
 *
 * 걸리는 구간도 좁다: 다음 루까지의 **진행률 71~94%** 주자만 걸린다 (0xa9690 `p − 71 ≤ 23`).
 * 70% 이하나 95% 이상이면 키를 눌러도 아무 일도 없다.
 */

/** 0xa9690 `subs r0,#0x47 ; cmp r0,#0x17` → 71 ≤ p ≤ 94 */
export const SLIDING_PROGRESS_MINIMUM = 71
export const SLIDING_PROGRESS_MAXIMUM = 94
/** 동작 바꾸기 0xa0164: 새 동작이 6(슬라이딩)이면 속도 = vt64() + 40 (`adds r1,#0x28`) */
export const SLIDING_SPEED_BONUS = 40
/** 주자 기본 속도의 상수항 cfg+0x14 = 300 (d_level.dat 파일 0x10 = `2c01`, 폴백 0xb6f3e) */
export const RUNNER_BASE_SPEED = 300
/** 주루 능력 배율 cfg+0x16 = 7 (÷100) — 0xa93ac */
export const RUNNER_RUN_NUMERATOR = 7
export const RUNNER_RUN_DENOMINATOR = 100
/** 슬라이딩 동작 번호 (야수·주자 공용 동작표, R3 5절: 6 = 슬라이딩) */
export const SLIDING_MOTION = 6
/** 효과음 번호 10 (0x518da) */
export const SLIDING_SOUND_EFFECT = 10

/**
 * 주자 틱당 이동 속도 (월드 단위) = 300 + ⌊주루 × 7 / 100⌋ + 팀 등급.
 * 팀 등급은 전역 모드 **1·2·8** 일 때만 붙는다(야수 보너스와 달리 9 가 빠진다 — 원본 그대로, 0xa93ac).
 */
export function runnerSpeedOf(run: number, teamGrade = 0): number {
  return RUNNER_BASE_SPEED + Math.trunc((run * RUNNER_RUN_NUMERATOR) / RUNNER_RUN_DENOMINATOR) + teamGrade
}

/** 슬라이딩 중 속도 (0xa0164) */
export function slidingSpeedOf(baseSpeed: number): number {
  return baseSpeed + SLIDING_SPEED_BONUS
}

/** 주자 한 명의 상태 — 이름 뒤 괄호는 원본 주자 구조체(0x9fe10, vtable 0xd771c)의 칸 */
export interface SlidingRunner {
  /** 주자 vt90 = 0xa04e8: 출발 루 → 현재 위치 거리 × 100 ÷ 출발 루 → 목표 루 거리 */
  readonly progressPercent: number
  /** 주자+0x96 — 이미 아웃 */
  readonly isOut: boolean
  /** 주자+0xba && !주자+0xbb — 아웃돼 걸어 나가는 중 (0xa03ac) */
  readonly isLeavingField: boolean
  /** 주자+0xb8 — 이미 슬라이딩 중 */
  readonly isSliding: boolean
  /** 주자+0x7c — 목표 루 (0 홈 · 1 1루 · 2 2루 · 3 3루) */
  readonly targetBase: number
  /** 0xbefec(주자) — 목표 루 도착까지 남은 틱 */
  readonly ticksToArrive: number
}

/** 0xa9690 한 주자 판정 — 아웃이 아니고 진행률이 71~94% 면 슬라이딩이 걸린다 */
export function canSlide(runner: SlidingRunner): boolean {
  if (runner.isOut) return false
  return (
    runner.progressPercent >= SLIDING_PROGRESS_MINIMUM &&
    runner.progressPercent <= SLIDING_PROGRESS_MAXIMUM
  )
}

export interface SlideKeyInput {
  /** 플레이 종류 (플레이+0x118). 2 = 볼넷 밀어내기 · 3 = (원본이 함께 막는 번호) */
  readonly playKind: number
  /**
   * 0xb68dc — **이 타구가 파울인가** (CORRECTIONS.md 2절 확정: 결과 7 = 파울,
   * 2스트라이크 번트면 11 = 아웃). 앞서 "경기 끝남" 으로 읽었던 것이 틀렸다.
   * → **원본은 파울 타구에서 슬라이딩 키가 안 먹는다.**
   */
  readonly isFoulBattedBall: boolean
  readonly runners: readonly SlidingRunner[]
  /** 0x6e575 — 효과음이 아직 울리는 중 */
  readonly isSoundPlaying: boolean
  /** 주자관리+0x31c — 이번 플레이에서 이미 슬라이딩 효과음을 냈다 */
  readonly hasPlayedSoundThisPlay: boolean
}

export interface SlideKeyResult {
  /** 이번 입력으로 슬라이딩이 걸린 주자 번호(`runners` 의 인덱스) */
  readonly slidRunnerIndexes: readonly number[]
  /** 효과음 10 을 낼지 */
  readonly playsSound: boolean
}

/**
 * 사람 키(OK → 메시지 0x585) 슬라이딩 — 0x518da.
 *
 * 원본 순서를 그대로 지킨다:
 *   플레이 종류 2·3 → 끝 / **파울 타구(0xb68dc)** → 끝 / 걸어 나가는 주자가 하나라도 있으면 → 끝
 *   → 0xa96ec 로 **여기서 실제 슬라이딩이 걸리고**
 *   → 그 뒤에야 소리 재생 중·+0x31c 잠금을 본다.
 * 즉 **두 번째 누름에서도 슬라이딩은 또 걸리고 효과음만 한 번**이다 — 버그로 보여도 원본 그대로 옮긴다.
 */
export function slideOnKey(input: SlideKeyInput): SlideKeyResult {
  const 없음: SlideKeyResult = { slidRunnerIndexes: [], playsSound: false }

  if (input.playKind === 2 || input.playKind === 3) return 없음
  if (input.isFoulBattedBall) return 없음
  if (input.runners.some((runner) => runner.isLeavingField)) return 없음

  const slidRunnerIndexes = input.runners
    .map((runner, index) => (canSlide(runner) ? index : -1))
    .filter((index) => index >= 0)
  if (slidRunnerIndexes.length === 0) return 없음

  const playsSound = !input.isSoundPlaying && !input.hasPlayedSoundThisPlay
  return { slidRunnerIndexes, playsSound }
}

/** 0xb030c 의 창: |도착 틱 − 송구 도착 틱| ≤ 9 이고 도착까지 6틱 이하 */
export const AUTO_SLIDING_TICK_TOLERANCE = 9
export const AUTO_SLIDING_MAXIMUM_TICKS = 6

export interface AutoSlideInput {
  /** 공.vt18() — 송구가 날아가는 중일 때만 돈다 */
  readonly isThrowInFlight: boolean
  /** 송구 계획[+0xf] — 송구가 향하는 루. −1 이면 목표 없음 */
  readonly throwTargetBase: number
  /** 송구 계획[+0xd] − 공+0x68 — 송구가 루에 닿기까지 남은 틱 */
  readonly throwArrivalTicks: number
  readonly runners: readonly SlidingRunner[]
}

/**
 * 자동 슬라이딩 — 제어기 vt 0x10 = 0xb030c, 매 틱 돈다 (사람/CPU 구분 없이).
 * 송구가 향하는 루로 6틱 안에 닿는 주자는 키 없이도 슬라이딩한다.
 * 사람 키 슬라이딩은 그 밖의 상황(송구가 안 오는 루, 7틱 이상 남음)에서 미리 당기는 용도다.
 */
export function autoSlideRunnerIndexes(input: AutoSlideInput): readonly number[] {
  if (!input.isThrowInFlight) return []
  if (input.throwTargetBase === -1) return []

  return input.runners
    .map((runner, index) => {
      if (runner.targetBase !== input.throwTargetBase) return -1
      if (runner.isSliding) return -1
      if (Math.abs(runner.ticksToArrive - input.throwArrivalTicks) > AUTO_SLIDING_TICK_TOLERANCE) return -1
      if (runner.ticksToArrive > AUTO_SLIDING_MAXIMUM_TICKS) return -1
      return canSlide(runner) ? index : -1
    })
    .filter((index) => index >= 0)
}
