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
export const MAGIC_PITCH_NAMES: readonly string[] = ['파이어 볼', '웨이브 볼', '썬더 볼', '샤이닝 볼', '캐넌 볼', '미라지 볼']

/** 마투수 다섯 고유기 (StrCOMMON 95~99) */
export const ACE_MAGIC_PITCH_NAMES: readonly string[] = ['싸이킥 스타', '트리플 크로우', '홀로그램 레이저', '다크 일루전', '브레스 웨폰']

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
