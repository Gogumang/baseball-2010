import type { RandomPort } from '@/shared/api/random/randomPort'
import { abilityGradeOf } from '@/entities/fielding/model/fieldGeometry'

/**
 * 실투 판정 — 원본 0x33cbc(scene). 투구 순간 0x4dc78 이 궤적 준비(0x9e669) **뒤**에
 * 한 번 부르고(0x4dea0), 참이면 `[scene+0xf98].byte8 = 4` 를 세운다(0x4deae).
 * 그 칸을 CPU 타자 결정 0x34334 가 읽어 **표 선택을 치기로 강제**하고(0x34376~0x3438e),
 * 타이밍 0x340f8 이 **K = 10000** 으로 늘 d = 0 을 낸다(0x34156~0x34162).
 *
 * ```
 * 33cc8  if scene[+0xfc8](구질) == 22: scene[+0x19d4] = 0; return 0      ; 마구는 실투 없음 (굴림도 없다)
 * 33cfc  c = 0xb570d(ctx, 1, 투수, 1, 90, 1)                              ; 경기용 **칸 1 = 구속** (체력 인자 90 = 피로 감소 없음)
 * 33d0a  p = 8 − 0xbbe98(0x66d70(c, t)) + 0x66da8(t)                     ; t = scene[+0x17c0] 투구 등급 0~5
 *          0x66d70: t ≤ 5 면 c × 표0xd2589[t] / 100, 아니면 c 그대로
 *          0x66da8: t ≤ 5 면 표0xd257d[t], 아니면 0
 * 33d24  p = max(p, 1)
 * 33d32  r = rand(0,100)
 * 33d3e  if t == 0: p = 20                                               ; 게이지 안 누름
 * 33d52  if 타자 스킬 비트 22(압도):                p += 5
 * 33d6c  if 주자 수(0xa9889) > 1 and 투수 비트 16(안정감): p = max(p − 5, 0)
 * 33d9c  if 2루 주자(0xa97a1(_, 2)) and 투수 비트 17(새가슴): p += 10
 * 33dca  if 투수 비트 22(냉정):                     p = max(p − 10, 0)
 * 33de4  if p > r: scene[+0x19d4] = 1; return 1
 * ```
 * 스킬 비트는 0xb62b4(선수, 비트) — 투수 스킬 번호는 비트 + 16 이라 16·17·22 는 skills.json
 * 32 안정감 · 33 새가슴 · 38 냉정 이고, 타자 22 는 22 압도다.
 *
 * ⚠️ **c 는 제구가 아니라 구속이다** (원본 그대로). 0xb570c 의 둘째 인자 r1 이 칸 번호이고
 *    (`0xb6415(선수, r1, 1)` → 레코드 `+0xc + 2·칸`), 33cf8 이 `movs r1, #1` 을 넣는다. 투수 칸은
 *    0 제구 · 1 구속 · 2 변화 · 3 체력이다 (R7 3절 — 아이템 붕붕드링크가 +0xe = 구속을 올린다).
 *    같은 투구 순간의 등급 뽑기 0x4dbac 은 `movs r1, #0`(4dc26) 으로 **제구**를 본다 — 두 자리가
 *    서로 다른 칸을 본다. 배율표 0xd2589 를 거치는 0x66d70 도 구속 단계가 쓰는 함수다.
 *    Q1 문서와 bbaac91 은 이 값을 "제구" 라 적었지만 칸 번호가 1 이다 — 지어내지 않고 칸 그대로 따른다.
 * ⚠️ 원본 그대로: 36 더티볼(설명 "실투율 +5%", 투수 비트 20)은 이 함수가 **보지 않는다**.
 * ⚠️ 주자 수 0xa9889 는 "루 0~3 중 주자가 있는 칸 수" 다 (I-controls). 투구 순간에는 0(타자)
 *    칸이 비어 있어 1~3루 주자 수와 같다고 보고 부르는 쪽이 그 값을 넘긴다.
 */

/** 표 0xd2589 (s8) — 등급 t 별 능력치 배율 % (0x66d70) */
const ABILITY_PERCENT_BY_GRADE: readonly number[] = [70, 80, 90, 100, 105, 110]
/** 표 0xd257d (s8) — 등급 t 별 더하는 값 */
const MISTAKE_BONUS_BY_GRADE: readonly number[] = [10, 5, 0, 0, -1, -2]
/** 0x33d14 — 8 − 능력치 등급 */
const MISTAKE_BASE = 8
const MISTAKE_FLOOR = 1
/** 0x33d3e — 게이지를 안 누르면(t = 0) 20 */
const UNPRESSED_MISTAKE_PERCENT = 20
const INTIMIDATE_BONUS = 5
const STEADY_PENALTY = 5
const TIMID_BONUS = 10
const COOL_PENALTY = 10

export interface MistakePitchInput {
  /** 구질 22(마구)인가 — 그러면 굴림 없이 실투 아님 */
  readonly isMagicPitch: boolean
  /** 투구 등급 t 0~5 (scene+0x17c0) — 게이지면 `gaugeGradeOf`, 아니면 0x4dbac 값 */
  readonly grade: number
  /**
   * 경기용 **구속**(투수 칸 1) `0xb570d(ctx, 1, 투수, 1, 90, 1)` — 장비·스킬·컨디션 보정 뒤,
   * 체력 감소 없음. ⚠️ 제구가 아니다 (머리 주석)
   */
  readonly effectiveVelocity: number
  /** 1~3루 주자 수 (0xa9889) */
  readonly runnerCount: number
  /** 2루 주자가 있는가 (0xa97a1(_, 2)) */
  readonly hasSecondBaseRunner: boolean
  /** 타자 스킬 22 압도 (상대 투수 실투율 +5%) */
  readonly batterIntimidates: boolean
  /** 투수 스킬 32 안정감 (주자 2명 이상이면 −5%) */
  readonly pitcherIsSteady: boolean
  /** 투수 스킬 33 새가슴 (2루 주자 있으면 +10%) */
  readonly pitcherIsTimid: boolean
  /** 투수 스킬 38 냉정 (−10%) */
  readonly pitcherIsCool: boolean
}

/** 실투 확률 % p (굴림과 견주기 전) — 0x33cfc~0x33de0 */
export function mistakePercentOf(input: Omit<MistakePitchInput, 'isMagicPitch'>): number {
  const t = input.grade
  const scaled =
    t >= 0 && t <= 5 ? Math.trunc((input.effectiveVelocity * ABILITY_PERCENT_BY_GRADE[t]) / 100) : input.effectiveVelocity
  const bonus = t >= 0 && t <= 5 ? MISTAKE_BONUS_BY_GRADE[t] : 0
  let p = Math.max(MISTAKE_BASE - abilityGradeOf(scaled) + bonus, MISTAKE_FLOOR)
  if (t === 0) p = UNPRESSED_MISTAKE_PERCENT
  if (input.batterIntimidates) p += INTIMIDATE_BONUS
  if (input.runnerCount > 1 && input.pitcherIsSteady) p = Math.max(p - STEADY_PENALTY, 0)
  if (input.hasSecondBaseRunner && input.pitcherIsTimid) p += TIMID_BONUS
  if (input.pitcherIsCool) p = Math.max(p - COOL_PENALTY, 0)
  return p
}

/**
 * 이 공이 실투인가 — 원본 0x33cbc. 마구가 아니면 rand(0,100) 을 **늘 한 번** 굴린다
 * (게이지를 안 눌러 p 가 20 으로 바뀌는 것도 굴림 뒤다).
 */
export function isMistakePitch(input: MistakePitchInput, random: RandomPort): boolean {
  if (input.isMagicPitch) return false
  const p = mistakePercentOf(input)
  return p > random.rand(0, 100)
}
