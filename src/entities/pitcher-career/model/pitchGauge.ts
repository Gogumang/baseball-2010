import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 사용자 투구 게이지 (binary.mod 0x3f500 게이지를 쓰는가 · 0x4d2ac 그리기·커서 · 0x50e08 누름 ·
 * 0x4dbac 게이지 없을 때의 등급 · 0x4dcf0 흩어짐 등급 — P1 4절, S5 U-15 확정).
 *
 * 게이지 결과는 **등급 t(0~5) 하나**다. t 가 쓰이는 곳은 두 군데뿐이다.
 *   ① 능력치 배율 70~110% (0x66d70 → 구속 단계. 웹 `entities/pitching/model/pitchSpeedStage` 가 이미 같은 표를 쓴다)
 *   ② 목표점 흩어짐 등급 k (표 0xcfd60 → 배율 [12, 20, 25, 30])
 *
 * ⚠️ **원본에는 PERFECT/GOOD/BAD 같은 결과 글자가 없다** (S5 U-15 확정).
 * 화면에 나오는 것은 `ui/slt_pitch.pzx` 프레임 0x3a~0x43 = 가운데로 작아지며
 * 빨강 → 분홍 → 노랑으로 밝아지는 **원 한 장**뿐이다. "PERFECT" 는 설명서 StrHOWTO[3] 에만 있는 말이다.
 * 그러니 결과 글자를 만들지 않는다. (기존 `entities/pitching/model/pitchCommand.ts` 의
 * `GaugeResult`·PERFECT_WINDOW 0.06·GOOD_WINDOW 0.2·제구 +25/+5/−20 은 모두 원본에 없는 값이다.)
 */

/** 커서가 지나가는 칸 수. 칸 9 가 마지막이고 그 뒤는 커서 그림이 사라진다 (0x4d420 `cmp #8; bgt`) */
export const GAUGE_LAST_CELL = 9

/** 마구는 게이지를 쓰지 않고 늘 최고 등급이다 (0x3f500 의 `구질 != 22` 조건, 0x4dbae) */
export const MAGIC_PITCH_GRADE = 5

/** slt_pitch.pzx 프레임 — 첫 칸 0x3a, 바깥 테두리 0x3b, 가장 작은 원 0x43 */
export const GAUGE_FRAME = { first: 0x3a, outer: 0x3b, smallest: 0x43 } as const

export interface GaugeUsageInput {
  /** 수비측이 사람인가 (`0xb6c20(state, state[0xa]) == 0`) */
  readonly defenseIsHuman: boolean
  /** 환경설정 "투구 게이지" 가 켜져 있는가 (설정 +0x2d, **기본값은 꺼짐**) */
  readonly gaugeSettingOn: boolean
  /** 이번 구질 번호 (`scene+0xfc8`) */
  readonly pitchTypeNumber: number
}

/** `0x3f500(scene)` — 이번 투구에 게이지를 쓰는가 */
export function usesGauge(input: GaugeUsageInput): boolean {
  return input.defenseIsHuman && input.gaugeSettingOn && input.pitchTypeNumber !== 22
}

/** 커서 칸 `scene+0x17bc` — 투구 동작 중 그리기 함수가 **틱마다 +1** 한다 (0x4d708). 0 에서 시작한다 */
export function gaugeCursorAt(tick: number): number {
  return Math.max(0, Math.trunc(tick))
}

/** 칸 g 를 그릴 프레임 = `min(0x3b + g, 0x43)` (0x4d496 · 0x4d6c0) */
export function gaugeFrameOf(cell: number): number {
  if (cell <= 0) return GAUGE_FRAME.first
  return Math.min(GAUGE_FRAME.outer + cell, GAUGE_FRAME.smallest)
}

/**
 * 누른 칸 g → 등급 t (0x50e08~0x50e34).
 *   g 가 1~9 가 아니면 **무시**(= 안 누른 것과 같다) → t = 0
 *   그 밖에는 `t = max(g − 4, 1)`
 *
 * | g | 1~5 | 6 | 7 | 8 | 9 | 안 누름 |
 * |---|---|---|---|---|---|---|
 * | t | 1 | 2 | 3 | 4 | 5 | 0 |
 *
 * ⚠️ 칸 8 과 9 는 **화면에서 구별되지 않는다**(둘 다 프레임 0x43). 게다가 커서 그림은 칸이 8 을 넘으면
 * 사라지므로 가장 좋은 t=5(칸 9)는 원이 사라진 바로 그 한 틱이다 (S5 U-15 4절, 원본 그대로).
 */
export function gaugeGradeOf(cell: number): number {
  if (cell < 1 || cell > GAUGE_LAST_CELL) return 0
  return Math.max(cell - 4, 1)
}

/**
 * 목표점 흩어짐 등급 표 `0xcfd60` — s8, 행 = 등급 t(0~5), 값은 **누적 %**, 칸 = 등급 k(0~3).
 * t 가 높을수록 k=0(가장 덜 흩어짐)이 잘 나온다.
 */
export const SCATTER_TABLE: readonly (readonly number[])[] = [
  /* t=0 */ [10, 35, 80, 100],
  /* t=1 */ [40, 65, 90, 100],
  /* t=2 */ [50, 73, 93, 100],
  /* t=3 */ [60, 80, 95, 100],
  /* t=4 */ [72, 87, 97, 100],
  /* t=5 */ [84, 94, 99, 100],
]

/** 흩어짐 등급 k 가 고르는 배율 표 `0xd0410` */
export const SCATTER_MULTIPLIERS: readonly number[] = [12, 20, 25, 30]

/** `r = rand(0,100)` 으로 흩어짐 등급 k 를 뽑는다 (0x4dcf0~0x4dd6c) */
export function scatterRankOf(grade: number, random: RandomPort): number {
  const row = SCATTER_TABLE[Math.min(Math.max(grade, 0), SCATTER_TABLE.length - 1)]
  const roll = randomIntegerBelow(random, 0, 100)
  const rank = row.findIndex((cumulative) => roll < cumulative)
  return rank < 0 ? SCATTER_MULTIPLIERS.length - 1 : rank
}

/** 등급 k → 배율 */
export function scatterMultiplierOf(rank: number): number {
  return SCATTER_MULTIPLIERS[Math.min(Math.max(rank, 0), SCATTER_MULTIPLIERS.length - 1)]
}

/**
 * **아직 못 채운 것**: 배율을 실제 목표점 이동으로 바꾸는 식이다.
 * 원본은 무작위 각도(`rand(1,361)`)와 반지름(결과 그림 폭/2 + `rand(-2,3)`)에 배율을 곱하고 `>>16` 한다.
 * 그 뒤 좌표계는 **투구 궤적 코드(0x4dc78 이후)** 라 이 저장소에서 해독하지 않는 주제다.
 * 채우려면 ① 결과 그림 폭 ② 궤적 좌표계의 단위가 필요하다.
 */
export interface AimScatter {
  readonly rank: number
  readonly multiplier: number
  /** 1~360 */
  readonly angleDegrees: number
  /** 결과 그림 폭/2 + rand(-2, 3) — 그림 폭을 모르면 반지름도 모른다 */
  readonly radius: number | null
}

export function aimScatterOf(grade: number, resultImageWidth: number | null, random: RandomPort): AimScatter {
  const rank = scatterRankOf(grade, random)
  const angleDegrees = randomIntegerBelow(random, 1, 361)
  const jitter = randomIntegerBelow(random, -2, 3)
  return {
    rank,
    multiplier: scatterMultiplierOf(rank),
    angleDegrees,
    radius: resultImageWidth === null ? null : Math.trunc(resultImageWidth / 2) + jitter,
  }
}

/**
 * 게이지를 **끄고** 던질 때의 등급은 제구·체력 확률표(0xd896c)로 뽑는다 — 0x4dbac.
 * 그 표와 식은 이미 `entities/pitching/model/controlTier.ts` 의 `controlTierOf` 로 옮겨져 있다
 * (제구 250 단위 행, `체력 0% 면 한 칸이 아니라 두 칸 내려간다`까지 같다). 여기서 다시 만들지 않는다.
 *
 * 마구만은 표를 거치지 않고 곧장 t=5 다.
 */
export function gradeForMagicPitch(): number {
  return MAGIC_PITCH_GRADE
}
