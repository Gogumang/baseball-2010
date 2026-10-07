import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory, carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 결과만 알고 **어느 패턴이었는지 모를 때** 쓰는 대표 패턴 고르기 — ⚠️ **웹 전용 다리다. 원본에 같은 것이 없다.**
 *
 * 원본은 결과에서 패턴을 거꾸로 고르지 않는다. 타구 시작(메시지 0x11 → 0x50faa)이 결과 코드의 패턴 덱(0xb0b00 · 0xb0ab8 ·
 * 0xb0a50, 웹 `createPatternDeck` · `drawPattern`)에서 **뽑은 패턴 그대로**를 쏘고(51188 공.vt44), 안타·아웃은 그 궤적과
 * 수비가 정한다. 그래서 이 함수의 목표 비거리 표(`TARGET_CARRY`)와 "그 비거리에 가장 가까운 패턴" 규칙은 **지어낸 값 · 근사**다.
 *
 * 쓰는 곳(2026-10-07): 투수편 `pitcherGameFlow.defensePlayInputOf` · 팀 경기 `teamGameFlow`(2529, 그리고 패턴을 못 받은
 * 2067) · 타자편 `gameFlow.applyPlayerOutcome`(패턴을 못 받으면) · 미션 `missionRun` · 홈런 그림 `homeRunPlayback`(패턴을
 * 못 받으면). 원본대로 하려면 그 자리들이 타석 판정에서 뽑은 패턴(`resolvePitch` 가 이미 뽑는다)을 넘겨야 한다 — 그러면
 * 이 파일은 안 쓰인다. 그때까지 진행기가 궤적을 만들 수 있도록 **원본 패턴 표 안에서** `outcomeOfPattern` 이 같은
 * 결과로 판정하는 항목만 고른다(값을 새로 짓지 않는다).
 * 대표 패턴은 원본 패턴의 플래그까지 그대로라, 고른 것에 비트 1(+0x127 — 낙구 지점 달리기)이 있으면 그 동작도 따라온다
 * (대표 2루타 [67, 1350, 650, 2]).
 */

/** 패턴 고르기에만 쓰는 고정 난수 — 같은 결과에 늘 같은 패턴이 나오게 한다 */
const FIXED_RANDOM: RandomPort = {
  next: () => 0.5,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
}

function sameOutcome(left: AtBatOutcome, right: AtBatOutcome): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === '안타' && right.kind === '안타') return left.bases === right.bases
  if (left.kind === '아웃' && right.kind === '아웃') return left.detail === right.detail
  return true
}

const CACHE = new Map<string, BattedBallPattern>()

const keyOf = (outcome: AtBatOutcome) =>
  outcome.kind === '안타'
    ? `안타${outcome.bases}`
    : outcome.kind === '아웃'
      ? `아웃${outcome.detail}`
      : outcome.kind

/**
 * 결과마다 "이쯤 날아간 타구" 로 볼 비거리(홈에서 낙구 지점까지, 월드 단위). **지어낸 값이다 — 원본 근거 없음.**
 * 같은 결과를 내는 패턴이 수십 개라 그중 하나를 골라야 하는데, 아무거나 집으면
 * 2루타인데 3루수 앞 땅볼 궤적이 걸리는 식이 된다. 그래서 결과에 어울리는 비거리에
 * 가장 가까운 패턴을 고른다. (외야수 기본 자리가 홈에서 20200~21400 이다.)
 */
const TARGET_CARRY: Readonly<Record<string, number>> = {
  '아웃땅볼아웃': 4_000,
  '아웃뜬공아웃': 19_000,
  '아웃직선타아웃': 12_000,
  '안타1': 15_000,
  '안타2': 21_000,
  '안타3': 24_000,
  홈런: 27_000,
}

/**
 * 이 결과를 내는 원본 패턴 하나 — 표 전체에서 `outcomeOfPattern` 판정이 같고
 * 비거리가 위 표에 가장 가까운 항목을 고른다. 값을 새로 짓지 않고 원본 표에서만 고른다.
 * 못 찾으면 코드 0 의 첫 항목으로 둔다 — 궤적이 없으면 진행기가 못 돈다.
 */
export function representativePatternOf(outcome: AtBatOutcome): BattedBallPattern {
  const key = keyOf(outcome)
  const cached = CACHE.get(key)
  if (cached !== undefined) return cached

  const target = TARGET_CARRY[key] ?? 15_000
  let best: BattedBallPattern | null = null
  let bestGap = Number.POSITIVE_INFINITY
  const codes = Object.keys(BATTED_BALL_PATTERNS)
    .map(Number)
    .sort((left, right) => left - right)
  for (const code of codes) {
    for (const pattern of BATTED_BALL_PATTERNS[code]) {
      const result = outcomeOfPattern(code, pattern, FIXED_RANDOM)
      if (result.kind !== '타구') continue
      if (!sameOutcome(result.outcome, outcome)) continue
      const gap = Math.abs(carryDistanceOf(battedBallTrajectory(pattern)) - target)
      if (gap >= bestGap) continue
      bestGap = gap
      best = pattern
    }
  }
  const chosen = best ?? BATTED_BALL_PATTERNS[0][0]
  CACHE.set(key, chosen)
  return chosen
}
