import type { AtBatOutcome } from '@/entities/game/model/gameRecords/otherSlices'

const RECORD = {
  triple: 0,
  soloHomeRun: 1,
  consecutiveHits: 9,
  multipleHomeRuns: 12,
  cycle: 15,
  multipleWalks: 34,
  marginWin: 37,
} as const

export interface AtBatRecordInput {
  readonly outcome: AtBatOutcome
  /** 이 플레이로 들어온 점수 — 홈런이면 1~4 */
  readonly runsScored: number
  /** 이 타석까지 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  /** 이 타석까지 이 경기 홈런 수 */
  readonly homeRunsInGame: number
  /** 이 타석까지 이 경기 볼넷 수 */
  readonly walksInGame: number
  /** 이 타석으로 사이클링 히트가 완성되었는가 */
  readonly completesCycle: boolean
  /**
   * 정산 0xa8024 의 홈런 수 [sp+0x24] > 0 — 홈런 갈래(a85be~a86b4 · 기록 1~4)와 0xa7b00(12~14)에 드는가. 안 넘기면 홈런이면 참.
   * 담장을 넘긴 사건 8 은 게이트 없이 세지만 장내 홈런 state[0x25] 는 a84d6 이 타자 게이트 sp+0x34 가 참일 때만 더한다 —
   * 거짓이면(포스트시즌 · 국가대항전) 루타 4 안타로만 적혀 이 기록들을 건너뛴다. 연타석(9~11) · 사이클(15)은 결과 링(코드 4)을
   * 보므로 그대로다.
   */
  readonly homeRunCounted?: boolean
}

const TIERED_FROM = { consecutiveHits: 3, homeRuns: 2, walks: 2 }
/** 홈런 갈래의 단계 — 솔로 · 2점 · 3점 · 만루 (1~4점) */
const MAX_HOME_RUN_RUNS = 4
/** 연속 단계 칸 — from 부터 tiers 개 (그 밖은 없음) */
const tierOf = (count: number, from: number, tiers: number) => (count >= from && count < from + tiers ? count - from : null)
/** 단계가 있으면 그 기록 번호 하나 */
const tieredIds = (base: number, tier: number | null) => (tier === null ? [] : [base + tier])

/** 정산 0xa8024 의 홈런 갈래(a85be~a86b4 · 기록 1~4)와 0xa7b00(12~14)에 드는 홈런인가 */
const isCountedHomeRun = (input: AtBatRecordInput) => input.outcome.kind === '홈런' && input.homeRunCounted !== false

/** 홈런 점수 단계 — 솔로 · 2점 · 3점 · 만루 (기록 1~4, 점수는 1~4 로 자른다) */
function homeRunRecordIdsOf(input: AtBatRecordInput): number[] {
  const runs = Math.min(Math.max(input.runsScored, 1), MAX_HOME_RUN_RUNS)
  return [RECORD.soloHomeRun + runs - 1]
}

/** 연타석 안타 x3 · x4 · x5 (9~11) — 안타 · 홈런 타석의 결과 링(코드 4)을 본다 */
function consecutiveHitIdsOf(input: AtBatRecordInput): number[] {
  const isHit = input.outcome.kind === '안타' || input.outcome.kind === '홈런'
  if (!isHit) return []
  return tieredIds(RECORD.consecutiveHits, tierOf(input.consecutiveHits, TIERED_FROM.consecutiveHits, 3))
}

/** 한 타자 2 · 3 · 4홈런 (12~14, 0xa7b00) */
function multipleHomeRunIdsOf(input: AtBatRecordInput): number[] {
  if (!isCountedHomeRun(input)) return []
  return tieredIds(RECORD.multipleHomeRuns, tierOf(input.homeRunsInGame, TIERED_FROM.homeRuns, 3))
}

/** 한 타자 2 · 3볼넷 (34 · 35) */
function multipleWalkIdsOf(input: AtBatRecordInput): number[] {
  if (input.outcome.kind !== '볼넷') return []
  return tieredIds(RECORD.multipleWalks, tierOf(input.walksInGame, TIERED_FROM.walks, 2))
}

/** 사용자 타석 하나에서 달성한 기록 id (판정 함수 0xa8024 · 0xa7b90 · 0xa7b00 · 0xa7a7c) — 3루타 · 홈런 · 연타석 · 다홈런 · 사이클 · 다볼넷 차례 */
export function atBatRecordIdsOf(input: AtBatRecordInput): number[] {
  const { outcome } = input
  return [
    ...(outcome.kind === '안타' && outcome.bases === 3 ? [RECORD.triple] : []),
    ...(isCountedHomeRun(input) ? homeRunRecordIdsOf(input) : []),
    ...consecutiveHitIdsOf(input),
    ...multipleHomeRunIdsOf(input),
    ...(input.completesCycle ? [RECORD.cycle] : []),
    ...multipleWalkIdsOf(input),
  ]
}

const MARGIN_STEP = 10
const MARGIN_TIERS = 3

/** 경기 끝 점수차 승 (0xa7de8) — 30 → 20 → 10 순 if/else 라 가장 큰 단계 하나만 준다 (0xa7f22 확인) */
export function gameEndRecordIdsOf(winningMargin: number): number[] {
  const tier = Math.min(MARGIN_TIERS, Math.floor(winningMargin / MARGIN_STEP))
  return tier >= 1 ? [RECORD.marginWin + tier - 1] : []
}
