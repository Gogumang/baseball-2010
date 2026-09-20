import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * 타석 결과비트 (타석 결과 객체 +0x188, 읽기 0xa7748, 켜기 0xa599c — K 4절 1-5 + P7 K1 절).
 *
 * 돌발미션 판정(0x8f414)은 오직 이 12비트만 본다. 켜는 자리는 모두 타석 결과 처리 0xa8024 안이고,
 * `0xa599c(field, 비트)` 는 **플레이 종류가 4·5 가 아닐 때만** `+0x188 |= 비트` 한다.
 *
 * | 비트 | 값 | 켜는 곳 | 뜻 |
 * |---|---|---|---|
 * | B0 | 0x001 | 0xa86ae | 홈런 |
 * | B1 | 0x002 | 0xa87b6 (진루 수 == 2) | 2루타 |
 * | B2 | 0x004 | 0xa87b6 (진루 수 == 3) | 3루타 |
 * | B3 | 0x008 | 0xa87b6 (그 밖) | 단타 |
 * | B4 | 0x010 | 0xa89c4 (득점 > 0) | 타점 |
 * | B5 | 0x020 | 0xa882a | 타자 출루이고 **이닝이 안 끝남** |
 * | B6 | 0x040 | 0xa88f8 | 번트로 주자 진루·득점 (희생번트·스퀴즈 성공) |
 * | B7 | 0x080 | 0xa87ac | 번트 뒤 2·3루에 주자가 남음 |
 * | B8 | 0x100 | 0xa8e44 (이번 플레이 아웃 ≥ 1) | 아웃 |
 * | B9 | 0x200 | 0xa8fdc | 보통 삼진 |
 * | B10 | 0x400 | 0xa8e54 (이번 플레이 아웃 ≥ 2) | 병살 |
 * | B11 | 0x800 | 0xa8b7a·0xa8bf4 | 볼넷(사구 포함) |
 */
export const BURST_RESULT_BIT = {
  홈런: 0x001,
  '2루타': 0x002,
  '3루타': 0x004,
  단타: 0x008,
  타점: 0x010,
  출루: 0x020,
  번트진루: 0x040,
  번트득점권: 0x080,
  아웃: 0x100,
  삼진: 0x200,
  병살: 0x400,
  볼넷: 0x800,
} as const

/**
 * ⚠️ **원본 그대로** — 사람 팀 승리로 경기가 끝나면 0xa89f0 이 **홈런 + 볼넷 비트를 함께** 켠다
 * (`0xb68fc`(경기 끝) && 앞선 쪽이 사람 조작 팀, P7 K1 확정).
 * 그 바람에 실제 타석이 무엇이었든 공격 목표(안타·장타·홈런·타점·고의사구)가 **성공으로 뒤집힌다**.
 * 뜻은 아직 미해결이지만 실행값이 이러하므로 그대로 옮긴다.
 */
export const HUMAN_WIN_END_BITS = BURST_RESULT_BIT.홈런 | BURST_RESULT_BIT.볼넷 // 0x801

export const hasBit = (bits: number, bit: number): boolean => (bits & bit) !== 0

/** 한 타석이 끝났을 때 원본이 보는 값들. 웹 타석 결과에서 만들 수 있는 것만 모았다 */
export interface BurstResultBitsInput {
  readonly outcome: AtBatOutcome
  /** 이 타석으로 들어온 점수 (0xa89c4 의 sp+0x28) */
  readonly runsBattedIn: number
  /** 번트를 댔는가 (state[0x13] — 번트 타구 플래그) */
  readonly isBunt?: boolean
  /** 플레이 전 아웃 수 (state[6]) */
  readonly outsBefore: number
  /** 이 플레이로 늘어난 아웃 수 */
  readonly outsAdded: number
  /** 타자주자가 살아남았는가 (0xa87ba~0xa87fa 의 r5) */
  readonly batterRunnerSafe?: boolean
  /** 이 플레이로 1~3루 주자가 하나라도 진루했는가 (0xa83f2~0xa848e 의 [sp+8]) */
  readonly runnersAdvanced?: boolean
  /** 플레이가 끝난 뒤 2루나 3루에 (아웃되지 않은) 주자가 있는가 — B7 의 루프 0xa88fc */
  readonly runnerInScoringPositionAfter?: boolean
  /** 이 플레이로 이닝·경기가 끝났는가 (0xb68dc) */
  readonly inningEnded?: boolean
  /** 이 플레이로 **사람 팀 승리**로 경기가 끝났는가 (0xa89f0) */
  readonly humanTeamWalkOff?: boolean
}

const MAXIMUM_OUTS_PER_INNING = 3

/**
 * 타석 결과 → 결과비트.
 *
 * **근사한 곳** (원본은 수비 플레이 상태를 직접 보고, 웹에는 아직 없는 값들이다):
 *   - B5 의 "볼 4개 || 사구" 는 웹의 볼넷 결과 하나로 합쳤다 (웹에 데드볼 구분이 없다).
 *   - B9 는 원본이 `state[0x1a] == 0`(주자 플레이로 이어지지 않은 삼진)까지 본다. 웹에는
 *     낫아웃·주자 플레이가 없으므로 삼진이면 늘 켠다.
 *   - B3 는 원본이 "진루 수가 2·3 이 아닌 나머지" 라 1루타 말고도 떨어질 수 있는데,
 *     웹 타석 결과에는 1·2·3루타밖에 없어 단타로만 켠다.
 */
export function burstResultBitsOf(input: BurstResultBitsInput): number {
  const { outcome } = input
  let bits = 0

  if (outcome.kind === '홈런') bits |= BURST_RESULT_BIT.홈런
  if (outcome.kind === '안타') {
    if (outcome.bases === 2) bits |= BURST_RESULT_BIT['2루타']
    else if (outcome.bases === 3) bits |= BURST_RESULT_BIT['3루타']
    else bits |= BURST_RESULT_BIT.단타
  }
  if (input.runsBattedIn > 0) bits |= BURST_RESULT_BIT.타점

  // B5 — 타자가 출루했고 **이 플레이로 이닝이 끝나지 않았다** (0xa882a: 플레이 전 아웃 + 이번 아웃 ≤ 2).
  // 이 비트가 "안타 목표에서 단타도 성공" 을 만든다 (CORRECTIONS.md 1절, P7 → K 정정).
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const reachedBase = isHit || outcome.kind === '볼넷' || (input.batterRunnerSafe ?? false)
  if (reachedBase && input.outsBefore + input.outsAdded <= MAXIMUM_OUTS_PER_INNING - 1) {
    bits |= BURST_RESULT_BIT.출루
  }

  const isBunt = input.isBunt ?? false
  // B6 — 번트 타구로 주자가 나가거나 점수가 났다
  if (isBunt && ((input.runnersAdvanced ?? false) || input.runsBattedIn > 0)) {
    bits |= BURST_RESULT_BIT.번트진루
  }
  // B7 — 번트 뒤 2·3루에 주자가 남았다 (이닝·경기가 끝나지 않았을 때만 본다)
  if (isBunt && !(input.inningEnded ?? false) && (input.runnerInScoringPositionAfter ?? false)) {
    bits |= BURST_RESULT_BIT.번트득점권
  }

  if (input.outsAdded >= 1) bits |= BURST_RESULT_BIT.아웃
  if (input.outsAdded >= 2) bits |= BURST_RESULT_BIT.병살
  if (outcome.kind === '삼진') bits |= BURST_RESULT_BIT.삼진
  if (outcome.kind === '볼넷') bits |= BURST_RESULT_BIT.볼넷

  if (input.humanTeamWalkOff ?? false) bits |= HUMAN_WIN_END_BITS

  return bits
}
