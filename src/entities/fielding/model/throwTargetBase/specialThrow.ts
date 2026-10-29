import { BASE_POSITIONS, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'

/**
 * CPU 송구 결정 0xafa60 — 점수식이 **홈(0)** 을 골랐을 때만 rand(0,100) 을 한 번 굴려 ≤ 19(20%)면 **특수**다
 * (afad2: 홈이 아니면 굴림 자체가 없다). 난수는 바깥에서 주입하고, 부르는 곳은 `features/defense-play` 의
 * `runDefensePlay` 한 곳이다.
 *
 * **특수라고 늘 효과가 나는 것은 아니다.** 값은 0xb2c90 → 송구 계획 0xb3444 → 0xa1620 으로 가는데,
 * 계획 [1] = **외야수 && 특수 && 송구틱 > 17** 일 때만 켜진다 (b368a). 켜지면:
 * - 송구 속도 130% (+0xd8 = +0xd4 × 130/100, 0xa1620 a16dc) · 중계 없음 (b3528)
 * - 거리 > 20400 이면 원바운드 — 악송구 굴림 대신 rand(0,2) 한 번 (a16be · a17fc), 아니면 악송구 기준 +100 (a1828)
 *
 * **내야수 홈 송구는 특수로 뽑혀도 효과가 없다** — 굴림(난수 한 칸)만 먹는다. 효과 쪽은 `cpuSpecialThrowOf` 참고.
 */
export const HOME_SPECIAL_THROW_PERCENT = 20

export function isSpecialThrow(base: number, roll: number): boolean {
  return base === 0 && roll < HOME_SPECIAL_THROW_PERCENT
}

/** 루 좌표에 정확히 서 있는 루 번호 — 0xb1268. 없으면 −1 */
export function baseAtPoint(point: { x: number; y: number; z: number }): number {
  const index = BASE_POSITIONS.findIndex((base) => isSamePoint(base, point))
  return index < 0 ? NONE : index
}
