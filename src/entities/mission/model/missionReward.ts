/**
 * 미션 클리어 보상 G (0xa52b0, Q2 1a·1b 확정).
 *
 * 등급 `d` 는 원본 레코드 byte1 에서 `(byte1 >> 1) & 7` 로 뽑는다. 원본 값 2·4·6·8·10 이
 * 그대로 d = 1·2·3·4·5 가 되고, 세 미션마다 한 등급씩 오른다.
 * 마선수 공략 5개(id 16~20)는 byte1 = 0 이라 **보상이 없다**.
 *
 * 같은 미션을 다시 깰수록 보상이 줄어든다. `n` 은 **이번 클리어를 더하기 전**의 클리어 횟수다:
 * ```
 * d <= 0            → 0
 * n <= 0 (첫 클리어) → (d*5 & 0x1f) * 100
 * n 1..4            → (d*3 & 0xf) * 100
 * n 5..9            → (d*3 & 0xf) * 200 / 3
 * n 10..19          → (d*3 & 0xf) * 100 / 3
 * n >= 20           → (d*3 & 0xf) * 100 / 6
 * ```
 * 나눗셈(0xca7b5)은 0 쪽 버림이다.
 *
 * | 등급 d | 첫 클리어 | 2~5회째 | 6~10회째 | 11~20회째 | 21회째~ |
 * |---|---|---|---|---|---|
 * | 1 | 500 | 300 | 200 | 100 | 50 |
 * | 2 | 1000 | 600 | 400 | 200 | 100 |
 * | 3 | 1500 | 900 | 600 | 300 | 150 |
 * | 4 | 2000 | 1200 | 800 | 400 | 200 |
 * | 5 | 2500 | 1500 | 1000 | 500 | 250 |
 */

/** 원본 레코드 byte1 → 보상 등급 d. 미션 데이터의 `stage` 가 그 byte1 이다 */
export function missionRewardTierOf(stage: number): number {
  return (stage >> 1) & 7
}

export function missionRewardOf(stage: number, previousClears: number): number {
  const tier = missionRewardTierOf(stage)
  if (tier <= 0) return 0
  if (previousClears <= 0) return ((tier * 5) & 0x1f) * 100

  const base = (tier * 3) & 0xf
  if (previousClears <= 4) return base * 100
  if (previousClears <= 9) return Math.trunc((base * 200) / 3)
  if (previousClears <= 19) return Math.trunc((base * 100) / 3)
  return Math.trunc((base * 100) / 6)
}
