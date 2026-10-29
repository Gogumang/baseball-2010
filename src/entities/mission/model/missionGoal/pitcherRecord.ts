import { isFreePass, type AtBatOutcome } from '@/entities/mission/model/missionGoal/otherSlices'
import type { MissionProgress } from '@/entities/mission/model/missionGoal/goals'

/**
 * 투수편 목표 이름. 원본 레코드에 있는 그대로다:
 * 아웃 · 탈삼진 · MAX게이지 · 삼진콤보 · 무실점 · 노히트노런 · 퍼펙트게임
 */
export function pitcherGoalNamesFor(outcome: AtBatOutcome, gauge: string): string[] {
  const names: string[] = []

  if (outcome.kind === '삼진') names.push('탈삼진', '아웃')
  if (outcome.kind === '아웃') names.push('아웃')
  if (gauge === 'PERFECT') names.push('MAX게이지')

  return names
}

/**
 * 그 타석 결과 하나가 원본에서 내는 아웃 콜 수의 기본값 — 플레이 결과(진행기의 아웃 수)를 모를 때만 쓴다.
 * 삼진 1(0xa7c4c) · 아웃 1 · 그 밖 0. 병살·주자 아웃은 `recordPitcherOutcome` 의 `outsRecorded` 로 넘겨야 원본과 같다.
 */
function defaultOutsOf(outcome: AtBatOutcome): number {
  return outcome.kind === '삼진' || outcome.kind === '아웃' ? 1 : 0
}

/**
 * **잡은 아웃 수 칸**(원본 R+0x13c, 사건 코드 0x1a)이 드는 목표 — '아웃' 과, 웹이 같은 아웃 수를 쌓아 막대로 보이는
 * 이닝 목표 칸(노히트노런·퍼펙트게임). 이닝 목표의 판정 자체는 `PitcherRun.totalOuts` 가 한다.
 */
export const OUT_CALL_GOALS: readonly string[] = ['아웃', '노히트노런', '퍼펙트게임']

/**
 * 잡은 아웃 수 칸에 `delta` 를 더한다 — 아웃 콜(0xa7d0c a7d52 · 삼진 0xa7c4c a7cc4)마다 +1, 낫아웃 보정(0xa8cfc)은 −1.
 * 이닝 목표 칸은 피안타·출루 허용으로 0 이 된 뒤에도 같은 수만큼 쌓는다(`recordPitcherOutcome` 과 같은 규칙).
 */
export function withOutCalls(progress: MissionProgress, delta: number): MissionProgress {
  if (delta === 0) return progress
  const counts = { ...progress.counts }
  for (const name of OUT_CALL_GOALS) counts[name] = (counts[name] ?? 0) + delta
  return { ...progress, counts }
}

type GoalCounts = Record<string, number>

/** 탈삼진 +1 · 아웃 콜 수 · MAX게이지 수 — 아웃은 결과 하나당 1 이 아니라 콜 수만큼 */
function addPitchCounts(counts: GoalCounts, outcome: AtBatOutcome, perfectGauges: number, outsRecorded: number): void {
  for (const name of pitcherGoalNamesFor(outcome, '')) if (name !== '아웃') counts[name] = (counts[name] ?? 0) + 1
  if (outsRecorded > 0) counts['아웃'] = (counts['아웃'] ?? 0) + outsRecorded
  if (perfectGauges > 0) counts['MAX게이지'] = (counts['MAX게이지'] ?? 0) + perfectGauges
}

/**
 * 노히트노런·퍼펙트게임은 허용하는 순간 0 으로 돌아가고, 그 전까지는 잡은 아웃 수만큼 쌓인다
 * (목표가 이닝×3 아웃이다). 볼넷·사구는 노히트노런을 깨지 않지만 아웃도 아니다.
 * 퍼펙트는 **사구도** 깬다 — 원본 퍼펙트 판정은 볼넷 R+0x144 와 함께 사구 R+0x148 이 0 이어야 한다
 * (미션 0xaabfc~0xaac12 `R+0x128·0x12c·0x144·0x148·0x130 모두 0` · 선발형 인기도 0xa6b0a 도 같다).
 */
function setInningGoalCounts(counts: GoalCounts, previous: MissionProgress['counts'], outcome: AtBatOutcome, outsRecorded: number): void {
  const isHitAllowed = outcome.kind === '안타' || outcome.kind === '홈런'
  const isRunnerAllowed = isHitAllowed || isFreePass(outcome)
  counts['노히트노런'] = isHitAllowed ? 0 : (previous['노히트노런'] ?? 0) + outsRecorded
  counts['퍼펙트게임'] = isRunnerAllowed ? 0 : (previous['퍼펙트게임'] ?? 0) + outsRecorded
}

/**
 * 투수편 한 타석을 기록한다. 삼진 콤보는 연속이 끊기면 0으로 돌아간다.
 *
 * **'아웃'(R+0x13c)은 결과 하나당 1 이 아니라 아웃 콜마다 1 이다** (직접 재역어셈) — 사건 코드 0x1a 를 올리는 곳은
 * 삼진 0xa7c4c(a7cc4 `0xa57f8(R, 0x1a, 1)`) · 아웃 콜 0xa7d0c(a7d52, 플레이 판정 0x51408 의 결과 11·13 이 아웃 하나마다
 * 부른다) · 정산 0xa8024 의 낫아웃 보정(a8ce8 `0xb6c3c` = state[0x1a] 이면 a8cfc `0xa57f8(R, 0x1a, −1)`) 셋뿐이다.
 * 그래서 병살이면 2, 삼중살이면 3, 안타 판에서 주자가 잡혀도 1 이 든다. 판 하나는 셋째 아웃에서 끝나 콜이 더 없다.
 * `outsRecorded` 는 그 판의 아웃 콜 수(진행기 `advance.outsAdded`, 셋째 아웃까지)다 — 안 주면 결과 종류로 1/0 을 센다.
 */
export function recordPitcherOutcome(
  progress: MissionProgress,
  outcome: AtBatOutcome,
  perfectGauges: number,
  brokenConditions: readonly string[] = [],
  outsRecorded: number = defaultOutsOf(outcome),
): MissionProgress {
  const counts: GoalCounts = { ...progress.counts }
  addPitchCounts(counts, outcome, perfectGauges, outsRecorded)
  // 삼진콤보 — 연속 삼진만 센다
  counts['삼진콤보'] = outcome.kind === '삼진' ? (progress.counts['삼진콤보'] ?? 0) + 1 : 0
  setInningGoalCounts(counts, progress.counts, outcome, outsRecorded)

  const newlyBroken = brokenConditions.filter((condition) => !progress.brokenConditions.includes(condition))

  return {
    counts,
    plateAppearances: progress.plateAppearances + 1,
    brokenConditions: [...progress.brokenConditions, ...newlyBroken],
  }
}
