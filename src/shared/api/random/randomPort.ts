/**
 * 난수를 도메인 밖에서 주입받기 위한 포트 — **원본 난수 함수 두 개 그대로**.
 * Math.random을 직접 부르면 "파워 80이 완벽 타이밍에 치면 홈런이 나오는가"를
 * 결정론적으로 검증할 수 없어서 반드시 이 포트를 통한다.
 *
 * 원본은 씨앗 칸 하나 [0x15606d4] 를 두 함수가 함께 굴린다 — 산술은 `shared/api/random/seededRandom` 머리 주석.
 */
export interface RandomPort {
  /**
   * `0xbfa54 rand(lo, hi)` — 늘 한 번 굴린다(lo == hi 여도). lo == hi 면 lo, 아니면 `min(lo, hi) + s mod |hi − lo|`
   * (위끝 제외, 부호 없는 나머지).
   */
  rand(lo: number, hi: number): number
  /** `0x9d468 rand(n)` — n ≤ 0 이면 **굴리지 않고** 0, 아니면 `((s << 1) >>> 17) mod n` (0 ~ n−1) */
  rand9d(n: number): number
}
