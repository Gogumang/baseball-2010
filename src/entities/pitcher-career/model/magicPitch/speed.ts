import type { RandomPort } from '@/shared/api/random/randomPort'

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
  return random.rand(row[0], row[1] + 1)
}
