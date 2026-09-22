import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 마구 (binary.mod 0xb6d2c 구질 칸 · 0x50da8 사람 고르기 · 0x344dc CPU 고르기 · 0x3de10 공에 싣기 ·
 * 0x9e944 pitch.zt1 레코드 고르기 · 0x34d6c 타격 보정 · 0xaebe4 한 경기 횟수 — H2 1-2·2·3절).
 *
 * **마구는 구질 22 하나다.** 파이어·웨이브·썬더·샤이닝·캐넌·미라지 볼은 구질 번호가 따로 없고
 * 투수 레코드 **+0x18 (1~4)** 로만 갈린다. 마투수는 +0x18 = 5~9 다.
 * 육성 투수가 볼 수 있는 이름이 **여섯 가지**인 까닭은, 번호 4 가 **폼/2** 에 따라
 * 샤이닝(폼 0·1) · 캐넌(2·3) · 미라지(4·5) 로 이름과 궤적 레코드만 갈리기 때문이다 —
 * 효과와 횟수는 셋 다 같은 "번호 4" 다.
 */

/** 마구의 구질 번호 */
export const MAGIC_PITCH_TYPE_NUMBER = 22

/** 구질 칸 6개 중 마구가 들어가는 자리 ('0' 키). 0xb6d6a 가 +0x18 != 0 일 때만 채운다 */
export const MAGIC_PITCH_SLOT = 5

/** 마구 이름 (StrCOMMON 번호). 육성·일반 투수 1~4, 마투수 5~9 */
export const MAGIC_PITCH_NAME_STRING_INDEX = {
  fire: 31,
  wave: 32,
  thunder: 33,
  /** 번호 4 는 폼/2 로 갈린다 (0x5c666 `StrCOMMON[0x22 + 폼>>1]`) */
  shining: 34,
  cannon: 35,
  mirage: 36,
  psychicStar: 95,
  tripleCrow: 96,
  hologramLaser: 97,
  darkIllusion: 98,
  breathWeapon: 99,
} as const

/** 육성 투수가 쓰는 마구 여섯 이름 (번호 4 가 폼으로 셋으로 갈린다) */
export const MAGIC_PITCH_NAMES: readonly string[] = [
  '파이어 볼',
  '웨이브 볼',
  '썬더 볼',
  '샤이닝 볼',
  '캐넌 볼',
  '미라지 볼',
]

/** 마투수 다섯 고유기 (StrCOMMON 95~99) */
export const ACE_MAGIC_PITCH_NAMES: readonly string[] = [
  '싸이킥 스타',
  '트리플 크로우',
  '홀로그램 레이저',
  '다크 일루전',
  '브레스 웨폰',
]

/**
 * 마구 이름.
 * @param number 투수 레코드 +0x18 (1~4 육성·일반, 5~9 마투수)
 * @param form 투수 폼 `0xb6e24` (육성 0~5, 마투수 6~10)
 */
export function magicPitchNameOf(number: number, form: number): string | null {
  if (number >= 5 && number <= 9) return ACE_MAGIC_PITCH_NAMES[number - 5]
  if (number < 1 || number > 4) return null
  if (number < 4) return MAGIC_PITCH_NAMES[number - 1]
  return MAGIC_PITCH_NAMES[3 + Math.min(Math.trunc(form / 2), 2)]
}

/**
 * 한 경기 마구 횟수 표 `0xd84ff` (u8, 색인 = 마구 번호).
 * 1 파이어 4 · 2 웨이브 5 · 3 썬더 6 · 4 샤이닝·캐넌·미라지 7.
 * 색인 5~9 도 7 로 채워져 있지만 **그 칸으로 가는 경로를 못 찾았다**(H2 2절) — 표 값 그대로 둔다.
 */
export const MAGIC_COUNT_BY_NUMBER: readonly number[] = [0, 4, 5, 6, 7, 7, 7, 7, 7, 7]

/** 마투수 레벨별 횟수 표 `0xd8509` (s8, Lv0~4) */
export const MAGIC_COUNT_BY_ACE_LEVEL: readonly number[] = [3, 4, 5, 6, 7]

/** 투수 스킬 23(= 이름 39 "혼신") "마구 횟수 +2" */
export const SPIRIT_SKILL_BONUS = 2

export interface MagicCountInput {
  /** 투수 레코드 +0x18. 0 이면 마구가 없다 */
  readonly number: number
  /** 마선수(마투수)인가 (`0xb633d`) */
  readonly isAce: boolean
  /** 마투수 레벨 0~4 (`u8 mgr[0x13a + 순번]` — S9 가 H2 를 정정했다) */
  readonly aceLevel: number
  /** 투수 스킬 23 혼신을 가졌는가 */
  readonly hasSpiritSkill: boolean
}

/**
 * 타석 교대·교체 처리 0xaebe4 안(0xaee9a~0xaf00a)에서 **남은 횟수가 음수일 때만** 채운다.
 * 곧 횟수는 **경기 전체에 한 번** 주어지고 이닝이 바뀌어도 다시 차지 않는다.
 * 되돌리는(−1) 곳은 대타·투수 교체·그 밖의 교체뿐이다.
 */
export function magicPitchCountOf(input: MagicCountInput): number {
  if (input.number === 0) return 0
  const base = input.isAce
    ? (MAGIC_COUNT_BY_ACE_LEVEL[Math.min(Math.max(input.aceLevel, 0), MAGIC_COUNT_BY_ACE_LEVEL.length - 1)] ?? 0)
    : (MAGIC_COUNT_BY_NUMBER[Math.min(Math.max(input.number, 0), MAGIC_COUNT_BY_NUMBER.length - 1)] ?? 0)
  return base + (input.hasSpiritSkill ? SPIRIT_SKILL_BONUS : 0)
}

/**
 * 마구 타격 보정 (0x34d6c 가 만드는 12바이트 구조체의 투수 쪽 네 칸, d_level.dat).
 *   out+4 = 투수 **구속** + 값 (히트 쪽에서 빼는 값) · out+6 = 투수 **제구** + 값 (파워 쪽)
 *   out+0xa = B(잘 맞음) += B·값/100 · out+0xb = C(홈런) += C·값/100
 */
export interface MagicPitchCorrection {
  /** out+4 */
  readonly velocityBonus: number
  /** out+6 */
  readonly controlBonus: number
  /** out+0xa (%) */
  readonly wellHitPercent: number
  /** out+0xb (%) */
  readonly homeRunPercent: number
}

/** 육성·일반 투수 마구 1~4 */
const CORRECTION_BY_NUMBER: readonly MagicPitchCorrection[] = [
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 180, controlBonus: 180, wellHitPercent: 12, homeRunPercent: 8 },
  { velocityBonus: 200, controlBonus: 200, wellHitPercent: 14, homeRunPercent: 9 },
  { velocityBonus: 220, controlBonus: 220, wellHitPercent: 15, homeRunPercent: 10 },
]

/** 마투수 Lv0~4 (다섯 명 값이 같다) */
const CORRECTION_BY_ACE_LEVEL: readonly MagicPitchCorrection[] = [
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 150, controlBonus: 150, wellHitPercent: 10, homeRunPercent: 7 },
  { velocityBonus: 180, controlBonus: 180, wellHitPercent: 12, homeRunPercent: 8 },
  { velocityBonus: 200, controlBonus: 200, wellHitPercent: 14, homeRunPercent: 9 },
  { velocityBonus: 220, controlBonus: 220, wellHitPercent: 15, homeRunPercent: 10 },
]

/** 마구 보정이 없는 공 (일반 CPU 선수는 +0x18 이 0 이라 늘 여기다) */
export const NO_MAGIC_PITCH_CORRECTION: MagicPitchCorrection = {
  velocityBonus: 0,
  controlBonus: 0,
  wellHitPercent: 0,
  homeRunPercent: 0,
}

/**
 * ⚠️ **원본 버그 그대로**: out+0xa/+0xb 는 **타자의** B·C 를 올린다(부호가 양수고 빼는 코드가 없다).
 * 마구의 실제 억제력은 out+4/+6(구속·제구 +150~220)뿐이다 — 의도는 감소였을 것으로 보이지만
 * 표 그대로가 실행값이므로 그대로 옮긴다 (H2 2절).
 */
export function magicPitchCorrectionOf(input: {
  readonly number: number
  readonly isAce: boolean
  readonly aceLevel: number
}): MagicPitchCorrection {
  if (input.number === 0) return NO_MAGIC_PITCH_CORRECTION
  if (input.isAce) {
    return CORRECTION_BY_ACE_LEVEL[Math.min(Math.max(input.aceLevel, 0), CORRECTION_BY_ACE_LEVEL.length - 1)]
  }
  const index = Math.min(Math.max(input.number, 1), CORRECTION_BY_NUMBER.length) - 1
  return CORRECTION_BY_NUMBER[index]
}

/**
 * 표시 구속 표 `0xcfda8` (u8 쌍 [하한, 상한], km/h). 일반 구질과 달리 마구만 따로 뽑는다 (0x34a24).
 * 칸 r 은 마구 번호−1 인데, **육성·일반 투수의 번호 4 만** 폼/2 로 9(캐넌)·10(미라지) 이 된다.
 */
export const MAGIC_SPEED_RANGES: readonly (readonly [number, number])[] = [
  [150, 155], // 0 파이어
  [145, 150], // 1 웨이브
  [153, 158], // 2 썬더
  [165, 170], // 3 샤이닝
  [145, 150], // 4 싸이커
  [157, 162], // 5 레오니
  [150, 155], // 6 붕붕머신
  [148, 153], // 7 발렌타인
  [155, 160], // 8 드래고나
  [157, 162], // 9 캐넌
  [155, 160], // 10 미라지
]

/** 표시 구속 칸 r */
export function magicSpeedRowOf(number: number, form: number): number {
  if (number === 4) {
    const half = Math.trunc(form / 2)
    if (half === 1) return 9
    if (half === 2) return 10
  }
  return number - 1
}

/** 표시 구속(km/h) = `rand(하한, 상한 + 1)` */
export function magicPitchDisplaySpeedOf(number: number, form: number, random: RandomPort): number {
  const row = MAGIC_SPEED_RANGES[magicSpeedRowOf(number, form)]
  if (row === undefined) return 0
  return randomIntegerBelow(random, row[0], row[1] + 1)
}

/**
 * pitch.zt1 구질 22 블록(17 레코드, 웹 `shared/config/original/pitchRecords` 의 `PITCH_RECORDS[21]`)
 * 안에서 고를 **0부터 센 레코드 번호** — 0x9e944.
 *   육성·일반(1~4): `3(m−1) + trunc(폼/2)` · 마투수(5~9): `m + 7`
 *
 * 마구는 다른 구질과 달리 **구속 단계 레코드가 없다** — 한 폼에 레코드 하나다.
 * (원본은 폼이 5 이하이고 홀수면 1 을 빼는데, trunc(폼/2) 라 결과가 같아 여기서는 생략한다.)
 */
export function magicPitchRecordIndexOf(number: number, form: number): number | null {
  if (number >= 5 && number <= 9) return number + 7
  if (number < 1 || number > 4) return null
  return 3 * (number - 1) + Math.trunc(form / 2)
}

/**
 * 사람 투수가 마구 칸을 고를 수 있는가 (0x50db8). **남은 횟수가 0 이면 고를 수 없다.**
 * 실제로 1 줄이는 때는 구질을 고른 순간이 아니라 **코스 확정(OK, 0x50e9c)** 이다.
 */
export function canSelectMagicPitch(remaining: number): boolean {
  return remaining > 0
}

/**
 * CPU 가 마구를 고르는 규칙(0x344dc)은 이미
 * `entities/pitching/model/pitchIntelligence.ts` 의 `computerPitchTypeOf` 로 옮겨져 있다
 * (주자 2명 이상 · 투 스트라이크 · 0-0 · 0-3 이면 반드시, 그 밖에는 6칸 균등 추첨).
 * 여기서 다시 만들지 않는다. 웹이 마구를 안 던지던 까닭은 `selectPitch.ts` 가 `magicCount: 0` 을
 * 넘기기 때문이었고, 위의 `magicPitchCountOf` 가 그 값을 채워 준다 —
 * 이제 `entities/pitching/model/magicPitchGame.ts` 가 그 둘을 이어 준다.
 *
 * 홈런더비(모드 7) 분기만 원본에 더 있다: 마투수가 나온 뒤로는 늘 마구다 (0x344ea).
 */
export function derbyPitchTypeOf(aceCountSoFar: number): number {
  return aceCountSoFar > 0 ? MAGIC_PITCH_TYPE_NUMBER : 1
}

/** 마구를 던질 때의 나머지 성질 (H2 3-6 · P1 3-1 · 4-1) */
export const MAGIC_PITCH_TRAITS = {
  /** 실투 판정 0x33cbc 가 곧장 "실투 아님" 으로 끝난다 */
  neverMistake: true,
  /** 게이지를 쓰지 않고 등급 t 는 늘 5 다 */
  grade: 5,
  /** 스태미나 소모는 직구와 같은 9 다 */
  staminaCost: 9,
  /**
   * 스윙 타이밍 허용이 ±2틱으로 좁다 (0x34be0).
   * 이 식은 `entities/batting/model/swingTiming.ts` 에 이미 옮겨져 있다.
   */
  narrowSwingTiming: true,
} as const

/**
 * ball.pzx 공 그림 종류 (경기+0x1080) — 색인 = 투수 레코드 +0x18(마구 번호).
 * ball.pzx 는 종류 3 × 크기 11칸이다: 000~010 보통 · 011~022 불꽃 · 023~033 날개.
 *
 * **확정 (디스어셈 재확인)**: 경기+0x1080 에 0 이 아닌 값을 쓰는 곳은 마투수 효과 그리기
 * `0x46fa8` 단 하나다 (경기+0x1080 = `0x84 << 5` 로 만들어 리터럴 검색에 안 잡힌다 —
 * 그 꼴로 만드는 곳 9군데 전수: 0x36f3a·0x3b232·0x3b362·0x3b62e 읽기, 0x3d78e·0x3d97a·0x467fe·
 * 0x4725c·0x4736e 쓰기).
 *   0x46fa8 은 상태 0x11 · 구질 22 · 경기+0x1038(ace/<이름>_effect.pzx) 이 있을 때만 돌고,
 *   `ldrb r1,[투수,#0x18]` 로 마구 번호를 읽어 **5~9(마투수)만** 점프표 0xd00c8 으로 갈린다.
 *   그 안에서 0x1080 을 쓰는 가지는 두 개뿐이다 —
 *     0x47258 `cmp r1,#8` → 0x4725c `경기+0x1080 = 2`  (마구 8 발렌타인, 다크 일루전)
 *     0x4736e                     `경기+0x1080 = 1`  (마구 9 드래고나, 브레스 웨폰)
 *   → **육성 마구 여섯(1~4)과 싸이커·레오니·붕붕머신(5·6·7)은 보통 공 그림(종류 0)이다.**
 * 되돌리기: 새 투구 준비 0x3d954 와 상태 0x13 진입 0x3d720 이 0 으로 지운다 — 공+0x10 과 달리
 * 여기엔 되돌리는 코드가 있어서 다음 공에 남지 않는다.
 */
export const MAGIC_BALL_KIND_BY_NUMBER: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 2, 1]

/** 마구 번호(투수 +0x18) → 공 그림 종류. 마구가 아니면(0) 보통 공이다 */
export function magicBallKindOf(number: number): number {
  return MAGIC_BALL_KIND_BY_NUMBER[number] ?? 0
}

/**
 * ⚠️ **원본 버그 그대로**: 공 객체 +0x10(이번 공의 마구 번호)을
 * 0 으로 되돌리는 코드가 원본에 **없다**(H2 3-4). 그래서 한 번 마구를 던지고 나면
 * 직구·변화구에도 마구 보정이 계속 붙고, 투수가 바뀌어도 값이 남는다.
 * 같은 이유로 **CPU 가 그 경기 첫 마구를 던질 때는 횟수가 줄지 않는다**(소모 조건이 `공+0x10 != 0`).
 *
 * **부재 증명 재확인 (확정)**: 경기+0xf98(공 객체)을 읽는 26곳을 전수로 훑어 그 뒤 60명령 안의
 * `+0x10` 쓰기를 찾으면 `0x3de40 str r3,[공,#0x10]` 하나뿐이다. 공 클래스 vtable `0xd73d0`
 * (메서드 0x9df54·0x9df60·0x9e004·0x9df78·0x9e0b0) 안에는 +0x10 쓰기가 없고,
 * 0x9e15a·0x9e304 는 다른 클래스 `0xd7518`(0x9e148·0x9e850) 쪽이다.
 * 새 투구 준비 0x35650 도 스윙 쪽 상태(+0x10·+0x11)만 지우고 공 객체는 건드리지 않는다.
 *
 * 이 모델은 원본 값을 그대로 돌려주기만 한다 — 실제로 어느 쪽을 쓸지는 경기 쪽에서 정한다.
 */
export function ballMagicNumberAfterPitch(
  previousBallMagicNumber: number,
  pitchTypeNumber: number,
  pitcherMagicNumber: number,
  remaining: number,
): number {
  if (pitchTypeNumber === MAGIC_PITCH_TYPE_NUMBER && remaining > 0) return pitcherMagicNumber
  // 원본에는 여기서 0 으로 되돌리는 줄이 없다 — 직전 값이 그대로 남는다
  return previousBallMagicNumber
}
