import type { RandomPort } from '@/shared/api/random/randomPort'
import { SEASON_RECORD_CODE } from '@/entities/season-mode/model/seasonReputation'

/**
 * **벤치 클리어링** — 몸에 맞는 공 뒤 20% 로 들어가는 경기 장면 상태 0x1e (R10 6절, 디스어셈 대조).
 *
 * ## 들어가는 길 — 상태 0x12 갱신 `0x4e6d4` 의 끝 (0x4e72c~0x4e776)
 * ```
 * 4e72c: 대기 틱(경기+0x2c) ≥ 31 (st[0xb] ∈ {3,4,5} 면 31, 아니면 15) 일 때만
 * 4e740: 플레이 종류 [[+0x200]+0x118] == 8(홈런더비)      → 보통 길 (굴리지 않는다)
 * 4e748: st[0xb] ≠ 4(사구)                               → 보통 길 (굴리지 않는다)
 * 4e74c: r = rand(0, 0x63)  ; 0xbfa54 — [0, 99)           ★ 사구면 늘 한 번 굴린다
 * 4e756: r > 0x13(19)                                     → 보통 길
 * 4e75e: 돌발 객체(+0xf28) 있고 0x8eb94(진행 중 돌발, +0xc ≠ −1) 참 → 보통 길
 * 4e774: 돌아올 곳 +0x1b6c = 0x1e                         ; 벤치 클리어링
 * ```
 * 굴림이 돌발 검사보다 **앞**이라 돌발이 진행 중이어도 난수는 한 번 쓴다. 성공 확률은 20/99 다
 * (`rand(0, 99)` 는 0~98).
 *
 * ## 상태를 바꾸는 것 — 진입 `0x3a5f0` 의 꼬리 (0x3ab4a~0x3aba6)
 * ```
 * 3ab4a: 수비 팀이 사람(st[0x31 + st[0xa]] == 0)이면
 * 3ab7c:     0xaeab0(수비 팀, 1000)   ; 지금 투수 레코드 +0x2c(스태미나) −= 1000, [0, 10000] 로 자름
 *        아니면(수비 CPU)
 * 3ab82:     수비 팀 +0x27c += 10     ; 이번 투수 투구 수 (상한 없음)
 * 3ab92: 0xa755c(ctx, 1)              ; 시즌 평판 S[1] 벤치클리어링 — 게이트상 내 팀이 수비일 때만 남는다
 * 3aba4: 배경음 44 예약
 * ```
 * 사기·평판(경기 뒤 0xa690c)·주자·볼카운트는 건드리지 않는다. 출구(갱신 0x405b0 틱 > 100, 키 0x40628 OK/'5')는
 * 보통 길과 같은 `0xae24c` 로 가므로 그 뒤(밀어내기 주루 0x17 → 정산 0xa8024)는 사구와 같다.
 *
 * ## 미해결
 * - **연출 화면**: 양 팀 18명이 더그아웃(표 0xcfaf8)에서 투수판(0xcfa8c)으로 몰려나와 틱 10·30·60·70·80 에
 *   동작을 바꾸고 틱 100 에 화면 전환(그리기 0x43228 = 수비 배경 + 두 팀 선수, 글·효과음 없음). 웹엔 없다.
 * - **연출이 쓰는 난수**: 진입 0x3a5f0 이 `rand` 를 일곱 자리(선수마다 도는 루프 안)에서 부르고, 틱 10 의
 *   목표점 고르기(0xa21bc 주변)도 굴린다. 같은 전역 난수라 원본은 그만큼 뒤 판정의 난수 차례가 밀리지만
 *   OK 로 건너뛰는 틱에 따라 수가 달라 웹은 옮기지 않았다 — 여기서는 들어가기 굴림 한 번만 쓴다.
 */

/** `rand(0, 0x63)` — [0, 99) */
const ROLL_RANGE = 99
/** `cmp r0, #0x13 ; bgt` — 0~19 면 들어간다 */
const ROLL_LIMIT = 19
/** `0xaeab0(팀, 1000)` (0x3ab74: movs r1,#0xfa ; lsls r1,#2) */
export const BENCH_CLEARING_STAMINA_LOSS = 1000
/** `+0x27c += 10` (0x3ab8c) */
export const BENCH_CLEARING_PITCH_COUNT_GAIN = 10
/** 스태미나 칸 `+0x2c` 의 범위 — 0xaeab0 이 [0, 0x2710] 로 자른다 */
const MAXIMUM_STAMINA = 10_000

export interface BenchClearingGate {
  /** 이 공이 몸에 맞는 공이었나 — st[0xb] == 4 */
  readonly isHitByPitch: boolean
  /** 홈런더비(플레이 종류 8)인가 */
  readonly isHomeRunDerby: boolean
  /** 진행 중인 돌발이 있는가 — 0x8eb94 (`burst.current !== null`) */
  readonly burstInProgress: boolean
}

/**
 * 벤치 클리어링에 들어가는가 — 사구(홈런더비 아님)면 **늘 한 번** 굴린다.
 * 사구가 아니거나 홈런더비면 굴리지 않는다(난수 차례 그대로).
 */
export function rollsIntoBenchClearing(gate: BenchClearingGate, random: RandomPort): boolean {
  if (gate.isHomeRunDerby || !gate.isHitByPitch) return false
  const rolled = random.rand(0, ROLL_RANGE)
  if (rolled > ROLL_LIMIT) return false
  return !gate.burstInProgress
}

/** 벤치 클리어링이 바꾸는 것 — 수비 팀 마운드 한 칸과 시즌 평판 기록 코드 */
export interface BenchClearingEffect {
  /** 수비 팀이 사람일 때 지금 투수 스태미나 감소량 (아니면 0) */
  readonly defenseStaminaLoss: number
  /** 수비 팀이 CPU 일 때 지금 투수 투구 수 증가량 (아니면 0) */
  readonly defensePitchCountGain: number
  /**
   * `0xa755c(ctx, 1)` 의 기록 코드 — `recordSeasonGameEvent(칸, 코드, 내 쪽)` 로 넘긴다.
   * 코드 1 은 게이트상 **내 팀이 수비**일 때만 S[1] 을 올린다 (내 투수가 맞혔다).
   */
  readonly seasonRecordCode: number
}

/** 0x3ab4a~0x3ab92 — 수비 팀이 사람인지에 따라 두 갈래 중 하나 */
export function benchClearingEffectOf(defenseIsHuman: boolean): BenchClearingEffect {
  return {
    defenseStaminaLoss: defenseIsHuman ? BENCH_CLEARING_STAMINA_LOSS : 0,
    defensePitchCountGain: defenseIsHuman ? 0 : BENCH_CLEARING_PITCH_COUNT_GAIN,
    seasonRecordCode: SEASON_RECORD_CODE.벤치클리어링,
  }
}

/** `0xaeab0` — 스태미나 −= n, [0, 10000] 로 자른다 */
export function staminaAfterBenchClearing(stamina: number, loss: number): number {
  return Math.min(MAXIMUM_STAMINA, Math.max(0, stamina - loss))
}
