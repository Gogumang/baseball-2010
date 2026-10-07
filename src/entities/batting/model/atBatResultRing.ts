import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * **타순 칸 기록의 오늘 타석 결과 링** — 팀 객체 + 0x34 + 타순 × 0x18 의 24바이트 앞쪽 (A 4절 · P7 A1, 확정).
 * ```
 * buf[0..9] · +0xa 머리 · +0xb 꼬리 · +0xc 개수 · +0xd 용량
 * 넣기 0xa908c: buf[꼬리] = 코드 · 꼬리 = (꼬리 + 1) % 용량 · 가득 찼으면 머리 = 꼬리 · 개수 = min(개수 + 1, 용량)
 * 읽기 0x53100(i): 개수 ≤ 0 이면 0, 아니면 buf[(머리 + i) % 용량]   ; i = 0 이 가장 오래된 것
 * ```
 * 넣는 곳은 정산 0xa8024 의 다섯 자리뿐이고 모두 공통 꼬리 게이트(`state[0x26] ∉ {4, 5}` — 견제·주자만 판은 빠진다) 안이다:
 * ```
 * a86e0~a8702  안타 가지: [sp+0x10] = 루타 1~3, 홈런 4
 * a8a14~a8a4e  아웃(안타 아님) · 삼진 수 > 0  → 7
 * a8a72~a8a84  아웃 · state[0x1f](바운드 없이 잡은 아웃) → 6
 * a8a96~a8a9e  그 밖의 아웃(땅볼·포스·태그)  → 5
 * a8b04~a8b1c  볼 > 3(볼넷) → 8   ·   a8b88~a8b9c  state[0x12](몸에 맞는 공) → 9
 * ```
 * 이 링은 기록 게이트 0xa56dc(레코드 +0x20~ 쌓기)와 상관없이 모든 모드·모든 타자(마선수 포함)에 쌓인다 — 팀 객체 칸이다.
 * 대타 확정 0xaebe4 가 24바이트째 맞바꾸므로 선수를 따라간다(`BatterGameRecord` 와 함께 움직인다).
 *
 * 용량 +0xd 를 넣는 곳은 못 찾았다. 버퍼가 10칸이고 스킬 16 이 `개수 > 3` 을 보므로 4~10 이다 —
 * 소개 판 0x44944 는 마지막 넷만 그려 그 범위 안이면 결과가 같다. 웹은 10칸을 넘으면 오래된 것부터 버린다.
 */
export const AT_BAT_RESULT_RING_SIZE = 10

/** 원본 링 코드 — 1~3 루타 · 4 홈런 · 5 그 밖의 아웃 · 6 뜬공(노바운드) 아웃 · 7 삼진 · 8 볼넷 · 9 사구 */
export function atBatResultCodeOf(outcome: AtBatOutcome): number {
  switch (outcome.kind) {
    case '안타':
      return outcome.bases
    case '홈런':
      return 4
    case '삼진':
      return 7
    case '볼넷':
      return 8
    case '사구':
      return 9
    case '아웃':
      // state[0x1f] = 바운드 없이 잡은 아웃 (0xb2774) — 뜬공·직선타는 노바운드 포구다
      return outcome.detail === '땅볼아웃' ? 5 : 6
  }
}

/** 0xa908c 넣기 — 오래된 차례 목록에 하나 더한다 */
export function withAtBatResult(results: readonly number[] | undefined, code: number): readonly number[] {
  return [...(results ?? []), code].slice(-AT_BAT_RESULT_RING_SIZE)
}
