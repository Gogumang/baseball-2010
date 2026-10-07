import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * **결과만 들고 들어온 호출(시험·옛 화면 호환)에 줄 패턴** — ⚠️ 웹 전용 다리다. 원본에는 결과에서 패턴을 거꾸로
 * 고르는 길이 아예 없다.
 *
 * 원본은 타구 시작(메시지 0x11 → 0x50faa)이 덱에서 **뽑은 패턴 그대로**를 쏘고(51188 공.vt44), 안타·아웃은 그 공이 도는
 * 수비 판의 끝 정산(0xa8024)이 낸다. 웹 실제 타석(`resolvePitch` · `simulateBatter`)도 그렇게 한다 — 쏜 패턴을 결과 객체에
 * 묶어 보내고(`battedContact`) 진행기가 그 패턴으로 판을 돌린다. 그래서 **실제 경기에서는 이 함수가 불리지 않는다.**
 *
 * 패턴 없이 결과(`{ kind: '안타', bases: 2 }` 같은)만 넘기는 호출 — 시험 코드와 결과를 직접 고르는 옛 화면 동작 — 이
 * 판을 돌릴 수 있도록, **원본 패턴 표를 훑어 빈 루 · 무사 · 기본 능력치 · CPU 수비 · 굴림 없이 판을 돌렸을 때
 * 정산이 그 결과를 내는 첫 패턴**을 고른다. 훑는 차례는 결과와 이름이 맞는 결과 코드 묶음(땅볼 아웃 3~5 · 뜬공 아웃 0~2 ·
 * 단타 강타 18~20 뒤 직선타 15~17 — 시험들이 기대는 "외야로 빠진 단타" · 2·3루타 18~20 · 홈런 24~26)이 먼저, 나머지는
 * 코드 · 칸 차례다. 값을 짓지 않고(예전의 목표 비거리 표 `TARGET_CARRY` 는 지어낸 값이라
 * 걷었다), 고른 패턴도 판을 실제로 돌려 확인한 것이다. 다른 루 상황·굴림에서는 판이 다른 결과를 낼 수 있다 —
 * 그때 기록은 판 결과를 따른다(넘겨받은 결과가 아니다).
 *
 * `직선타아웃` 은 정산이 내지 않는 웹 갈래라(원본은 뜬공·땅볼을 가르지 않는다) `뜬공아웃` 패턴을 준다.
 * 홈런은 판을 안 돌리고 날아가는 그림만 만드는 옛 길(`homeRunPlayback`)이 받으므로 여기서는 담장을 먼저 넘는 첫 패턴이다.
 */
export function fixturePatternFor(outcome: AtBatOutcome): BattedBallPattern {
  const key = keyOf(outcome)
  const cached = CACHE.get(key)
  if (cached !== undefined) return cached
  const chosen = findPattern(key, (settled) => keyOf(settled) === key) ?? BATTED_BALL_PATTERNS[0][0]
  CACHE.set(key, chosen)
  return chosen
}

/** @deprecated 이름만 남긴 별칭 — `fixturePatternFor` 를 써라 */
export const representativePatternOf = fixturePatternFor

const CACHE = new Map<string, BattedBallPattern>()

function keyOf(outcome: AtBatOutcome): string {
  if (outcome.kind === '안타') return `안타${outcome.bases}`
  if (outcome.kind === '아웃') return outcome.detail === '땅볼아웃' ? '땅볼아웃' : '뜬공아웃'
  return outcome.kind
}

/**
 * 먼저 훑을 결과 코드 묶음 — 스윙 판정 0xab214 가 내는 코드의 갈래 이름 그대로다(0 뜬공 · 3 땅볼 · 15 직선타 · 18 강타 ·
 * 24 홈런, `swingResult`). 그 묶음을 먼저 보고 나머지는 코드 차례로 본다.
 */
const FIRST_CODES: Readonly<Record<string, readonly number[]>> = {
  땅볼아웃: [3, 4, 5],
  뜬공아웃: [0, 1, 2],
  안타1: [18, 19, 20, 15, 16, 17],
  안타2: [18, 19, 20],
  안타3: [18, 19, 20],
  홈런: [24, 25, 26],
}

function findPattern(key: string, matches: (settled: AtBatOutcome) => boolean): BattedBallPattern | null {
  const first = FIRST_CODES[key] ?? []
  const rest = Object.keys(BATTED_BALL_PATTERNS)
    .map(Number)
    .filter((code) => !first.includes(code))
    .sort((left, right) => left - right)
  for (const code of [...first, ...rest]) {
    for (const pattern of BATTED_BALL_PATTERNS[code]) {
      if (!isFairAngle(pattern[0])) continue
      const played = runDefensePlay({
        outcome: { kind: '아웃', detail: '땅볼아웃' },
        trajectory: battedBallTrajectory(pattern),
        bases: EMPTY_BASES,
        outs: 0,
        // 결과만 들고 오는 호출은 대부분 사람 타석(수비 CPU)이다 — CPU 송구 결정 0xafa60 이 돈다
        defenseIsCpu: true,
      })
      if (played.outcome !== undefined && matches(played.outcome)) return pattern
    }
  }
  return null
}
