import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * 기록달성 (binary.mod 0xa77f0 기록 추가 · 0x4ea0c 경기 끝 지급 — 누락 탐색 9차, QA 대조).
 * 기록마다 횟수를 세고, 경기가 끝나면 Σ 횟수 × 금액을 G포인트로 준다 (상한 99999). 이름은 StrGAME[id+8].
 * 금액 표는 두 벌이고 값은 같다: 경기 끝 지급이 0xcfbf8, 경기 중 누계가 0xd8158.
 *
 * **원본은 기록을 팀 단위로 센다** (0xa77f0 게이트는 "공격·수비 팀이 사람 팀인가"만 본다).
 * 동료 여덟 타순의 기록도 여기로 들어온다 — `batterGameLog.ts` 가 타순별로 따로 세고,
 * 사용자 타석과 같은 `recordBatterAtBat` 을 쓴다.
 * 완투 계열 28~31 도 들어왔다 (`completeGameRecordIdsOf`) — 상대 공격이 실제 타석으로 돌아가
 * 피안타·실점을 셀 수 있게 되면서 가능해졌다.
 * 아직 빠진 것은 투구 사건 쪽이고, 그만큼 원본보다 G 수입이 적다:
 *   - 우리 팀 수비·투수 기록 16~27 (삼진 계열·도루 저지·병살·삼자범퇴)
 *   - 5 대타 홈런 · 6·7 백투백 · 8 도루 성공 · 32·33 연속 파울 · 36 필살송구 아웃
 * 상대 공격은 이제 원본 간이 타석(0xc11f0)으로 돌지만 아직 타격 결과만 만든다 —
 * 삼진 콤보·병살·삼자범퇴 같은 투구·수비 사건을 세려면 수비 쪽 상태(state+0x88~0x8a)를 더 옮겨야 한다.
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

const RECORD_GAME_POINTS: readonly number[] = BALANCE.recordGamePoints

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

const COMPLETE_GAME = { completeGame: 28, shutout: 29, noHitter: 30, perfect: 31 } as const
/** 퍼펙트게임은 아웃이 28 미만일 때만 인정된다 — 연장에 가면 안 된다 (0xa7de8) */
const PERFECT_GAME_OUT_LIMIT = 28
const OUTS_PER_INNING = 3

export interface CompleteGameInput {
  /** 우리 투수가 잡은 아웃 수 */
  readonly outsRecorded: number
  /** 정규 이닝 수 (보통 9) */
  readonly regulationInnings: number
  readonly hitsAllowed: number
  readonly walksAllowed: number
  readonly runsAllowed: number
}

/**
 * 완투 계열 기록 (0xa7de8). 아웃카운트가 정규 이닝을 다 채웠을 때만 본다:
 *   출루·피안타·실점이 모두 0 이고 아웃 < 28 → 퍼펙트게임(31)
 *   피안타·실점이 0 → 노히트노런(30)
 *   실점이 0 → 완봉승(29)
 *   그 밖 → 완투승(28)
 * 이 넷은 마스크 0xe0f 에 들어 있어 **팀 조건조차 없이 항상 집계된다**.
 *
 * **주의**: 웹판 간이 타석(0xc11f0)에는 볼 카운트가 없어 볼넷이 나오지 않는다.
 * 그래서 `walksAllowed` 는 늘 0 이고 퍼펙트게임이 원본보다 자주 나온다 — 투구 판정을 옮기면 풀린다.
 */
export function completeGameRecordIdsOf(input: CompleteGameInput): number[] {
  if (input.outsRecorded < input.regulationInnings * OUTS_PER_INNING) return []
  if (
    input.hitsAllowed === 0 &&
    input.walksAllowed === 0 &&
    input.runsAllowed === 0 &&
    input.outsRecorded < PERFECT_GAME_OUT_LIMIT
  ) {
    return [COMPLETE_GAME.perfect]
  }
  if (input.hitsAllowed === 0 && input.runsAllowed === 0) return [COMPLETE_GAME.noHitter]
  if (input.runsAllowed === 0) return [COMPLETE_GAME.shutout]
  return [COMPLETE_GAME.completeGame]
}

export function recordGamePointsOf(recordIds: readonly number[]): number {
  return recordIds.reduce((total, id) => total + (RECORD_GAME_POINTS[id] ?? 0), 0)
}
