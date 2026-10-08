import type { RandomPort } from '@/shared/api/random/randomPort'

/** 구장 번호가 그대로인 끝 — 기본 열 팀 0~9 (`0x78664` · `0x788d4` 의 `cmp r1, #9`) */
const LAST_STADIUM = 9
/** 9 보다 크면 고르는 구장 수 — `bfa55(0, 10)` */
export const STADIUM_ROLL_COUNT = 10

/**
 * **구장 번호 넣기** — 타석 구장 객체 `0x78664(무대, n)` 와 수비 구장 객체 `0x788d4(객체, n)` 는 같은 꼴이다(직접 떴다):
 * ```
 * 78664  n ≤ 9 → 무대+0x70 = n  /  그 밖 → 무대+0x70 = bfa55(0, 10)
 * 788d4  n ≤ 9 → 객체+0x10 = n  /  그 밖 → 객체+0x10 = bfa55(0, 10)
 * ```
 * n 은 s8 이다(부르는 쪽이 ldrsb 로 읽는다). 일반모드 n = st+0x30 = rec+0xc(구장) — 빠른실행이면 유저 팀 번호라 히든 팀(10~14)이면 굴린다.
 */
export function rollStadiumNumber(random: RandomPort, stadium: number): number {
  if (stadium <= LAST_STADIUM) return stadium
  return random.rand(0, STADIUM_ROLL_COUNT)
}
