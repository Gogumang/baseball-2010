import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'

/**
 * 판정이 보는 원본 모드(0x1552d10) 묶음 —
 * '나만의리그' = 모드 3·4 (투수편·타자편) · '미션' = 모드 6 (**타자** 미션) · '투수미션' = 모드 5 ·
 * '홈런더비' = 모드 7 (sp44) · '일반' = 그 밖.
 */
export type SwingMode = '일반' | '나만의리그' | '미션' | '투수미션' | '홈런더비'

export interface SwingResultInput {
  /** 공 도착점 − 기준점 + 타자 좌우 이동 (원본 픽셀, ±40 으로 자름) */
  readonly horizontalError: number
  readonly verticalError: number
  /** 0~100 (timingOf) */
  readonly timing: number
  /** 0 스윙 · 1~3 번트 종류 */
  readonly buntKind: number
  /** 제구 등급 (controlTierOf). 음수면 배율 100 */
  readonly controlTier: number
  readonly batter: { readonly hit: number; readonly power: number }
  readonly pitcher: { readonly control: number; readonly velocity: number }
  readonly mode: SwingMode
  /**
   * 타자가 **육성·명전 선수**인가 = `0xb6389` (선수 레코드 `rec[0xa]` 비트7 — 등록 타자 0xa0 · 투수 0x80, C 노트).
   * ⚠️ 마선수는 비트6 이고 비트7 이 **꺼져 있다** (rec[0xa] = 0x40~0x44 · 0x60~0x64, R3·S6 바이트 확인) —
   * 예전 이름 `isBatterAce`·`isPitcherAce` 는 이 비트를 마선수로 잘못 읽은 것이었다.
   */
  readonly isBatterOwnPlayer?: boolean
  /** 투수가 육성·명전 선수인가 (0xb6389, 같은 비트) */
  readonly isPitcherOwnPlayer?: boolean
  /**
   * **나리 연차 idx** (0 = 1년차) — 내 선수 보너스 `D[0x1d8] − D[0x1da] × 연차` 를 깎는 값.
   * ```
   * ab3e2: rec = 0x1f8d4(전역 저장 [0x1400054], (s8)state[1])   ; 모드 4 → [저장+0xbc]+0x11c (타자편)
   *                                                              ; 모드 3 → [저장+0xb8]+0x11c (투수편), 그 밖 0
   * ab3f2: aB = D[0x1d8] − D[0x1da] × u8 rec[0xb3] (음수면 0)   ; 투수 aP 는 0xab494 에서 D[0x1dc] − D[0x1de] ×
   * ```
   * `+0x11c` 레코드는 시즌 레코드(`[저장+0xb4]+0x11c`, P4 0x1f55c)와 같은 꼴이고 `+0xb3` 은 **연차 idx** 다
   * (B·P3·P5 — 연말 0x1b768 이 1 씩 올린다). 웹 커리어의 `season` 은 1 부터라 `season − 1` 이다.
   * 안 넘기면 0 = 보너스 최대(타자·투수 400).
   */
  readonly careerYearIndex?: number
  /** 공격 팀을 사람이 조작하는가 (state[0x31 + state[9]] == 0) — 모드 6 의 +100. 안 넘기면 거짓 */
  readonly isOffenseHuman?: boolean
  /** 수비 팀을 사람이 조작하는가 (state[0x31 + state[0xa]] == 0) — 모드 3·4 밖의 −10. 안 넘기면 거짓 */
  readonly isDefenseHuman?: boolean
  /** 보정 구조체 0x34d6c (필살타법·마구). 안 넘기면 0 (보통 스윙에 마구가 실리지 않은 공) */
  readonly boost?: SwingBoost
  readonly isPitcherExhausted: boolean
  readonly batterSkillIds: readonly number[]
  readonly pitcherSkillIds: readonly number[]
  readonly situation: SwingSituation
}

export type SwingResult =
  | { readonly kind: '헛스윙' }
  /** code 는 방향을 붙이기 전의 결과 코드. isSolid 는 원본 out[7] */
  | { readonly kind: '타구'; readonly code: number; readonly isSolid: boolean }

export interface SwingFactors {
  readonly contact: number
  readonly solid: number
  readonly homeRun: number
}
