import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * 평판 가산 칸 누계 (0xa57f8 의 사건 코드, P7 B1·B2 확정).
 *
 * 역전·동점 득점은 원본이 **득점 처리 0xa5c34 에서 1점마다** 판정한다. 그 함수는 점수를 올리기 직전에
 * `L[측] = 올리기 전 내 점수` 를 적어 두고(0xb6a9c), 올린 뒤 아래를 본다:
 *   - 동점 득점 (G+0x110): `상대 점수 == 내 점수`
 *   - 역전 득점 (G+0x114): `L(상대) >= L(나) && 상대 점수 < 내 점수` → 정수라 `상대 점수 == 올리기 전 내 점수`
 * 타석 하나로 r 점이 들어오면 내 점수가 `before+1 … before+r` 로 차례로 오르므로, 그 구간에
 * 상대 점수가 걸리는지만 보면 같은 결과가 된다.
 *
 * 번트 안타(G+0xf4)는 정산 a8506 — 안타 갈래 안에서 번트 타구(state[0x13])일 때 코드 10 (`isBuntHit`).
 */
export function addReputationCounts(
  counts: ReputationCounts,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    isWalkOff: boolean
    ourScoreBefore: number
    opponentScore: number
    /** 번트 안타 — 코드 10(a8506)을 부르는 판 (`finishPlayerOutcome`). 안 넘기면 거짓 */
    isBuntHit?: boolean
  },
): ReputationCounts {
  const { outcome, runsBattedIn, isWalkOff, ourScoreBefore, opponentScore } = play
  const homeRunStreak = homeRunStreakAfter(outcome, counts.homeRunStreak ?? 0)
  return {
    homeRunStreak,
    ...homeRunStreakMilestonesAfter(counts, outcome, homeRunStreak),
    grandSlams: counts.grandSlams + (isGrandSlam(outcome, runsBattedIn) ? 1 : 0),
    walkOffs: counts.walkOffs + (isWalkOff && isHitOutcome(outcome) ? 1 : 0),
    buntHits: counts.buntHits + (play.isBuntHit === true ? 1 : 0),
    ...(counts.bunts === undefined ? {} : { bunts: counts.bunts }),
    // G+0xfc 는 볼넷만이다 — 사구 갈래(0xa8b90)는 코드 13 으로 G+0x100 을 올리고, 평판식은 0xfc 만 읽는다
    walks: counts.walks + (outcome.kind === '볼넷' ? 1 : 0),
    ...scoreSwingRunsAfter(counts, ourScoreBefore, opponentScore, ourScoreBefore + runsBattedIn),
  }
}

/** 만루 홈런 — 그 플레이 득점이 4 점 (0xa8696) */
const isGrandSlam = (outcome: AtBatOutcome, runsBattedIn: number): boolean => outcome.kind === '홈런' && runsBattedIn === GRAND_SLAM_RUNS

const isHitOutcome = (outcome: AtBatOutcome): boolean => outcome.kind === '안타' || outcome.kind === '홈런'

/**
 * G+0xe4 이어진 타석 홈런 — 코드 6(홈런 0xa8600) +1 · 코드 5(홈런 아닌 안타 0xa86c4 · 아웃 0xa8ac2) 0, 볼넷 · 사구는 그대로
 */
function homeRunStreakAfter(outcome: AtBatOutcome, streakBefore: number): number {
  if (outcome.kind === '홈런') return streakBefore + 1
  const breaksStreak = outcome.kind === '안타' || outcome.kind === '아웃' || outcome.kind === '삼진'
  return breaksStreak ? 0 : streakBefore
}

/** 코드 6 은 +0xe4 ≤ 3 이면 +0xd4 + 4·(+0xe4) 를 올린다 — +0xdc 2 에 닿음 · +0xe0 3 에 닿음 (경기 카운터 0xa690c 의 재료) */
function homeRunStreakMilestonesAfter(
  counts: ReputationCounts,
  outcome: AtBatOutcome,
  homeRunStreak: number,
): Pick<ReputationCounts, 'homeRunStreaksOfTwo' | 'homeRunStreaksOfThree'> {
  const reached = outcome.kind === '홈런' ? homeRunStreak : 0
  return {
    homeRunStreaksOfTwo: (counts.homeRunStreaksOfTwo ?? 0) + (reached === 2 ? 1 : 0),
    homeRunStreaksOfThree: (counts.homeRunStreaksOfThree ?? 0) + (reached === 3 ? 1 : 0),
  }
}

/** 역전(G+0x114) · 동점(G+0x110) 득점 — 내 점수가 `before+1 … after` 로 오르는 구간에 상대 점수가 걸리는가 (머리말) */
function scoreSwingRunsAfter(
  counts: ReputationCounts,
  ourScoreBefore: number,
  opponentScore: number,
  after: number,
): Pick<ReputationCounts, 'goAheadRuns' | 'tyingRuns'> {
  return {
    goAheadRuns: counts.goAheadRuns + (opponentScore >= ourScoreBefore && opponentScore <= after - 1 ? 1 : 0),
    tyingRuns: counts.tyingRuns + (opponentScore > ourScoreBefore && opponentScore <= after ? 1 : 0),
  }
}

/** 만루 홈런 — 그 플레이 득점이 4 점 (0xa8696) */
const GRAND_SLAM_RUNS = 4
