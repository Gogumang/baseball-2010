import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * 기록달성 (binary.mod 0xa77f0 기록 추가 · 0x4ea0c 경기 끝 지급 — 누락 탐색 9차, QA 대조).
 * 기록마다 횟수를 세고, 경기가 끝나면 Σ 횟수 × 금액을 G포인트로 준다 (상한 99999). 이름은 StrGAME[id+8].
 * 금액 표는 두 벌이고 값은 같다: 경기 끝 지급이 0xcfbf8, 경기 중 누계가 0xd8158.
 *
 * **원본은 기록을 팀 단위로 센다** (0xa77f0 게이트는 "공격·수비 팀이 사람 팀인가"만 본다).
 * 웹판은 40종 중 17종만 센다 — 아래가 빠져 있고, 원본보다 G 수입이 적다:
 *   - 동료 타석 기록 (원본은 동료 8명의 3루타·홈런·연타석·사이클·볼넷도 센다)
 *   - 우리 팀 수비·투수 기록 16~27 (삼진 계열·도루 저지·병살·삼자범퇴)
 *   - 완투승 계열 28~31 (완투승·완봉승·노히트노런·퍼펙트게임)
 *   - 5 대타 홈런 · 6·7 백투백 · 8 도루 성공 · 32·33 연속 파울 · 36 필살송구 아웃
 * 상대 공격을 이닝 실점 난수로 대신하고 있어 투구·수비 사건 자체가 없다 — 원본 간이 시뮬레이터를 옮길 때 함께 채운다.
 * 경기 중 누계를 화면에 실시간으로 보여 주는 것(0xa77f0)도 아직 없다.
 */
export const RECORD_NAMES: readonly string[] = [
  '3루타', '솔로 홈런', '2점 홈런', '3점 홈런', '만루 홈런', '대타 홈런', '백투백 홈런', '백투백투백 홈런',
  '도루 성공', '연타석 히트 x3', '연타석 히트 x4', '연타석 히트 x5', '한 타자 2홈런', '한 타자 3홈런',
  '한 타자 4홈런', '사이클링 히트', '삼구 삼진', '풀카운트 삼진', '삼진 콤보 x3', '삼진 콤보 x6', '삼진 콤보 x9',
  '한 투수 10삼진', '한 투수 15삼진', '한 투수 20삼진', '도루 저지', '삼구 삼자범퇴', '더블플레이', '트리플플레이',
  '완투승', '완봉승', '노히트노런', '퍼펙트게임', '3연속 파울', '4연속 파울', '한 타자 2볼넷', '한 타자 3볼넷',
  '필살송구 아웃', '10점차 이상 승', '20점차 이상 승', '30점차 이상 승',
]

const RECORD_GAME_POINTS: readonly number[] = [
  10, 8, 10, 12, 15, 10, 20, 40, 2, 5, 15, 30, 5, 20, 40, 100, 2, 3, 5, 20,
  40, 10, 20, 40, 3, 5, 2, 100, 10, 20, 100, 120, 3, 5, 5, 8, 3, 10, 20, 40,
]

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
}

const TIERED_FROM = { consecutiveHits: 3, homeRuns: 2, walks: 2 }
const tierOf = (count: number, from: number, tiers: number) =>
  count >= from && count < from + tiers ? count - from : null

/** 사용자 타석 하나에서 달성한 기록 id (판정 함수 0xa8024 · 0xa7b90 · 0xa7b00 · 0xa7a7c) */
export function atBatRecordIdsOf(input: AtBatRecordInput): number[] {
  const ids: number[] = []
  const { outcome } = input
  if (outcome.kind === '안타' && outcome.bases === 3) ids.push(RECORD.triple)
  if (outcome.kind === '홈런') ids.push(RECORD.soloHomeRun + Math.min(Math.max(input.runsScored, 1), 4) - 1)
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const hitTier = isHit ? tierOf(input.consecutiveHits, TIERED_FROM.consecutiveHits, 3) : null
  if (hitTier !== null) ids.push(RECORD.consecutiveHits + hitTier)
  const homeRunTier = outcome.kind === '홈런' ? tierOf(input.homeRunsInGame, TIERED_FROM.homeRuns, 3) : null
  if (homeRunTier !== null) ids.push(RECORD.multipleHomeRuns + homeRunTier)
  if (input.completesCycle) ids.push(RECORD.cycle)
  const walkTier = outcome.kind === '볼넷' ? tierOf(input.walksInGame, TIERED_FROM.walks, 2) : null
  if (walkTier !== null) ids.push(RECORD.multipleWalks + walkTier)
  return ids
}

const MARGIN_STEP = 10
const MARGIN_TIERS = 3

/** 경기 끝 점수차 승 (0xa7de8) — 30 → 20 → 10 순 if/else 라 가장 큰 단계 하나만 준다 (0xa7f22 확인) */
export function gameEndRecordIdsOf(winningMargin: number): number[] {
  const tier = Math.min(MARGIN_TIERS, Math.floor(winningMargin / MARGIN_STEP))
  return tier >= 1 ? [RECORD.marginWin + tier - 1] : []
}

export function recordGamePointsOf(recordIds: readonly number[]): number {
  return recordIds.reduce((total, id) => total + (RECORD_GAME_POINTS[id] ?? 0), 0)
}
