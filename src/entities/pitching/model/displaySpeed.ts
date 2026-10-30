import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER, magicPitchDisplaySpeedOf } from '@/entities/pitcher-career/model/magicPitch'
import { pitchSpeedRankOf } from '@/entities/pitching/model/pitchSpeedStage'
import type { PitchingStats } from '@/entities/pitching/model/pitchSpeedStage'

/**
 * **표시 구속(km/h) `경기+0x19a0`** — 공을 놓을 때마다 한 번 굴린다 (2026-10-08 직접 뜸).
 *
 * 놓기 0x4dc78 은 사람·CPU 를 가르지 않고 제구 등급 0x4dbac(4dcba, 게이지면 건너뜀) **뒤**, 흩어짐 rand(0,100)(4dcf6) **앞**에
 * 0x34968(4dcc2) 를 부른다. 0x34968 은 경기용 능력치 0xb570c(…, 체력%) 셋을 등급 배율 0x66d70(+0x17c0)로 늘려 999 로 자르고
 * rank = 0x66d54(구질, a0, a1, a2) 를 얻은 뒤:
 * ```
 * 34a24  구질 [+0xfc8] ≠ 0x16 → [+0x19a0] = 0x66dc0(구질, rank)
 * 34a36  구질 == 0x16(마구)   → 표 0xcfda8 칸 r = 투수 +0x18 − 1 (육성 · 일반 투수 0xb633d 거짓이고 r == 3 이면 폼/2 가 1 → 9 · 2 → 10)
 *                               [+0x19a0] = rand(하한, 상한 + 1)               (`magicPitchDisplaySpeedOf`)
 * 34ab2  rank / 2 를 돌려준다 (구속 단계)
 * ```
 * 부르는 곳은 0x4dcc2 하나다(xref). 홈런더비(모드 7)도 0x4dcce 의 모드 7 갈래보다 앞이라 늘 굴린다.
 */

/** 표 0xd2568 — 구질 1~21 의 s8 보정 */
const SPEED_BASE_OFFSETS = [0, -5, 1, -22, -8, -14, -20, -14, -24, -5, 3, -6, -6, -6, -28, -8, -24, 6, -6, -6, -28]
/** 66de0 · 66de2 — 하한 = 보정 + 0x86, 상한 = 보정 + 0x8b */
const SPEED_LOW_BASE = 0x86
const SPEED_HIGH_BASE = 0x8b
/** 구질 21(KNUCKLE)만 rank 를 거꾸로 센다 (66de4 cmp #0x15) */
const KNUCKLE_TYPE_NUMBER = 21
const KNUCKLE_TOP_STEP = 6

/**
 * **0x66dc0(구질, rank)** — 일반 구질의 표시 구속:
 * ```
 * 66dc8  구질 − 1 > 20 → 0 (굴림 없음)
 * 66dd0  b = s8 표 0xd2568[구질 − 1] ; lo = b + 134 ; hi = b + 139
 * 66de4  구질 == 21: hi −= 1 ; i = 6 ; rank ≤ 6 이면 i 가 rank 까지 내려가며
 *                    lo += (i 홀수 ? 3 : 2) ; hi = lo + (i 홀수 ? 4 : 5)
 * 66e0c  아니면    : i = 1 부터 rank 까지 올라가며 lo += (i 홀수 ? 3 : 2) ; hi = lo + (i 홀수 ? 5 : 4)
 * 66e2c  rand(lo, hi + 1)
 * ```
 * 구질 21 은 rank 가 낮을수록 빨라진다 — 원본 그대로 둔다.
 */
export function displaySpeedKmhOf(typeNumber: number, rank: number, random: RandomPort): number {
  const offset = SPEED_BASE_OFFSETS[typeNumber - 1]
  if (offset === undefined) return 0
  const [low, high] = typeNumber === KNUCKLE_TYPE_NUMBER ? knuckleSpeedRangeOf(offset, rank) : plainSpeedRangeOf(offset, rank)
  return random.rand(low, high + 1)
}

/** 66e0c — i = 1 부터 rank 까지 올라가며 lo += (i 홀수 ? 3 : 2) ; hi = lo + (i 홀수 ? 5 : 4) */
function plainSpeedRangeOf(offset: number, rank: number): readonly [number, number] {
  let low = offset + SPEED_LOW_BASE
  let high = offset + SPEED_HIGH_BASE
  for (let step = 1; step <= rank; step += 1) {
    const isOdd = (step & 1) === 1
    low += isOdd ? 3 : 2
    high = low + (isOdd ? 5 : 4)
  }
  return [low, high]
}

/** 66de4 — 구질 21: hi −= 1 ; i = 6 에서 rank 까지 내려가며 lo += (i 홀수 ? 3 : 2) ; hi = lo + (i 홀수 ? 4 : 5) (rank > 6 이면 고리가 돌지 않는다) */
function knuckleSpeedRangeOf(offset: number, rank: number): readonly [number, number] {
  let low = offset + SPEED_LOW_BASE
  let high = offset + SPEED_HIGH_BASE - 1
  for (let step = KNUCKLE_TOP_STEP; step >= rank; step -= 1) {
    const isOdd = (step & 1) === 1
    low += isOdd ? 3 : 2
    high = low + (isOdd ? 4 : 5)
  }
  return [low, high]
}

export interface DisplaySpeedInput {
  /** 구질 번호 1~22 (`경기+0xfc8`) */
  readonly typeNumber: number
  /** 경기용 능력치 — 0xb570c(…, 체력%) 의 제구 · 구속 · 변화 (피로까지 먹인 값) */
  readonly stats: PitchingStats
  /** 이번 공의 등급 t (`경기+0x17c0`) — 0x66d70 배율 */
  readonly controlTier: number
  /** 투수 레코드 +0x18 (마구 번호 1~4 · 마선수 5~9) */
  readonly magicNumber: number
  /** 투수 폼 0xb6e24 */
  readonly form: number
}

/** **0x34968 의 표시 구속 굴림** — 공마다 rand 한 번 (구질 번호가 1~22 밖이면 0, 굴림 없음) */
export function rollDisplaySpeedKmh(input: DisplaySpeedInput, random: RandomPort): number {
  if (input.typeNumber === MAGIC_PITCH_TYPE_NUMBER) return magicPitchDisplaySpeedOf(input.magicNumber, input.form, random)
  const rank = pitchSpeedRankOf(input.typeNumber - 1, input.stats, input.controlTier)
  return displaySpeedKmhOf(input.typeNumber, rank, random)
}
