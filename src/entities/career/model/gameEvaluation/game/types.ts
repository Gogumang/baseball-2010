import type { GameResult } from '@/entities/career/model/gameEvaluation/otherSlices'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

/**
 * 평판 가산 칸 (0xa57f8 의 사건 코드 → G+오프셋, P7 B1·B2 확정).
 */
export interface ReputationCounts {
  /** G+0xc8 — 만루 홈런 (+2) */
  readonly grandSlams: number
  /** G+0xc4 — 끝내기 안타·홈런 (+3) */
  readonly walkOffs: number
  /**
   * G+0xf4 — 번트 안타 (+1). 정산 0xa8024 의 a8506 하나가 올린다 — 안타 갈래([sp+0x14] — 장내 홈런 · 홈런 포함)에서 번트
   * 타구(state[0x13] ≠ 0)면 0xa57f8(코드 10). 코드 ≤ 0x13 이라 지금 타자 0xa56dc(R, 타자, 1) 게이트 안이다(포스트시즌 ·
   * 국가대항전 거짓). 희생번트(아웃)는 안 센다. 웹은 경기 흐름 `finishPlayerOutcome` 이 판 결과 `buntBall` 로 센다
   */
  readonly buntHits: number
  /** G+0xfc — 볼넷 (2개 이상이면 +1) */
  readonly walks: number
  /** G+0x114 — 앞서가는(역전) 득점 (+2) */
  readonly goAheadRuns: number
  /** G+0x110 — 동점 득점 (+2) */
  readonly tyingRuns: number
  /**
   * G+0xe4 — 이어진 타석 홈런 수. 0xa57f8 코드 6(홈런 가지 0xa8600)이 +1, 코드 5(홈런 아닌 안타 0xa86c4 · 아웃 0xa8ac2)가 0.
   * 볼넷 · 사구는 건드리지 않는다. 평판식은 안 읽는다 — 경기 카운터(0xa690c → S+0x1f0) 재료다. 없으면 0
   */
  readonly homeRunStreak?: number
  /** G+0xdc — 이어진 홈런이 2 에 닿은 횟수 (코드 6: +0xe4 ≤ 3 이면 +0xd4 + 4·(+0xe4) 를 +1) */
  readonly homeRunStreaksOfTwo?: number
  /** G+0xe0 — 이어진 홈런이 3 에 닿은 횟수 */
  readonly homeRunStreaksOfThree?: number
  /**
   * G+0xf8 — 번트 수. 스윙 시작 0xa5fac 이 state[0x13](번트 종류) ≠ 0 이면 0xa57f8(코드 11) → +0xf8 (표 0xd8218[11] = 0xa58e0).
   * 사람 장면에서 0xa5fac 를 번트로 부르는 길은 0x4e1f8 하나 — 번트 자세(S+8)가 공 틱 N − 1 까지 서서 판정을 받은 공이다
   * (4e15c r7). 코드 ≤ 0x13 이라 지금 타자 0xa56dc(R, 타자, 1) 게이트 안이다. 평판식은 안 읽는다 — 경기 카운터 [5] 재료. 없으면 0
   */
  readonly bunts?: number
}

export const EMPTY_REPUTATION_COUNTS: ReputationCounts = {
  grandSlams: 0,
  walkOffs: 0,
  buntHits: 0,
  walks: 0,
  goAheadRuns: 0,
  tyingRuns: 0,
}

export interface GameEvaluationInput {
  readonly result: GameResult
  readonly stats: SeasonStats
  readonly popularityPoints: number
  /** 이 경기에서 사용자가 친 병살 수 */
  readonly doublePlays: number
  /** 2루 주자를 두고 아웃된 타석 수 (atBatPenaltyCounts) */
  readonly scoringPositionOuts: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 평판 가산 칸 (0xa57f8). 없으면 전부 0 으로 본다 */
  readonly reputationCounts?: ReputationCounts
}

export interface GameEvaluation {
  readonly popularityChange: number
  readonly reputationChange: number
  readonly moraleChange: number
  readonly commentIndex: number
}
