import { countsAsAtBat, type AtBatOutcome } from '@/entities/mission/model/missionGoal/otherSlices'
import type { MissionProgress } from '@/entities/mission/model/missionGoal/goals'

/** 만루홈런 — 정산 0xa8024 의 득점 switch(a8622)에서 그 판 득점 [sp+0x28] 이 4 인 칸 */
const GRAND_SLAM_RUNS = 4

/** 안타 칸 수 → 목표 이름 */
const HIT_GOAL_OF_BASES: Readonly<Record<number, string>> = { 1: '단타', 2: '2루타', 3: '3루타' }

/**
 * 홈런 — 안타 · 홈런, 그리고:
 * **그라운드홈런(R+0xcc)은 판 안 홈인만** 센다 (직접 재역어셈): 주자 틱 0xaa0a8 aa1e2~aa1fe 가 홈에 닿은 주자가 이번
 * 타자(+0x98)이고 담장 홈런 state[0x1d](코드 8) · 폴 홈런 state[0xf](코드 12)가 둘 다 0 일 때만 state[0x25] = 1,
 * 정산 a84cc~a84e8 이 그때만 0xa57f8(R, 4) — 담장을 넘긴 홈런은 안 든다. 예전 웹은 모든 홈런을 셌다.
 * **만루홈런(R+0xc8)은 그 판 득점이 4 일 때** — 정산 a85be 홈런 수 [sp+0x24] > 0 이면 a8622 득점 [sp+0x28](사건 0xf 수)
 * switch 의 4번 칸 a8690 이 0xa57f8(R, 3). 투구 전 주자 수가 아니라 점수판에 오른 득점을 본다 (원본 그대로)
 */
function homeRunGoalNamesOf(runsBattedIn: number, groundHomeRun: boolean): string[] {
  const names = ['안타', '홈런']
  if (groundHomeRun) names.push('그라운드홈런')
  if (runsBattedIn === GRAND_SLAM_RUNS) names.push('만루홈런')
  return names
}

/** 안타 · 홈런 결과의 목표 이름 — 그 밖 결과는 없다 */
function hitGoalNamesOf(outcome: AtBatOutcome, runsBattedIn: number, groundHomeRun: boolean): string[] {
  if (outcome.kind === '홈런') return homeRunGoalNamesOf(runsBattedIn, groundHomeRun)
  if (outcome.kind !== '안타') return []
  const extraBase = HIT_GOAL_OF_BASES[outcome.bases]
  return extraBase === undefined ? ['안타'] : ['안타', extraBase]
}

/**
 * 타석 결과가 어떤 목표에 해당하는지. 원본 목표 이름을 그대로 쓴다.
 *
 * `groundHomeRun` — 판 안 그라운드 홈런 state[0x25] (진행기 `DefensePlayResult.groundHomeRun`, 0xaa1e2).
 */
export function goalNamesFor(outcome: AtBatOutcome, runsBattedIn: number, isBunt = false, groundHomeRun = false): string[] {
  // 번트는 **번트 안타만** 센다 (직접 재역어셈). 판정 0xaaa6c 모드 6 갈래는 '번트' 를 0xaa928(R+0xf4, 행+0xa4 위)
  // (aab36)로 재고, R+0xf4(사건 코드 0xa, 핸들러 0xa58da `+= 1`)를 올리는 곳은 정산 0xa8024 의 a8506 하나뿐이다 —
  // 안타 갈래(a8490 `[sp+0x14]` = 안타 표시가 서야 들어간다) 안에서 게임+0x13(번트 타구 표시)이 켜졌을 때.
  // 희생번트처럼 아웃으로 끝난 번트는 안 든다 (번트 시도 수는 스윙 0xa5fac 의 코드 0xb → R+0xf8 로 따로 간다).
  const buntNames = isBunt && outcome.kind === '안타' ? ['번트'] : []
  const runNames = runsBattedIn > 0 ? ['타점'] : []
  return [...buntNames, ...hitGoalNamesOf(outcome, runsBattedIn, groundHomeRun), ...runNames]
}

/** 도루 성공을 기록한다. 타석과는 별개로 일어난다. */
export function recordSteal(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    counts: { ...progress.counts, 도루: (progress.counts['도루'] ?? 0) + 1 },
  }
}

export function recordOutcome(
  progress: MissionProgress,
  outcome: AtBatOutcome,
  runsBattedIn: number,
  isBunt = false,
  groundHomeRun = false,
): MissionProgress {
  const counts = { ...progress.counts }
  for (const name of goalNamesFor(outcome, runsBattedIn, isBunt, groundHomeRun)) {
    counts[name] = (counts[name] ?? 0) + (name === '타점' ? runsBattedIn : 1)
  }
  return {
    ...progress,
    counts,
    plateAppearances: progress.plateAppearances + 1,
    atBats: (progress.atBats ?? 0) + (countsAsAtBat(outcome) ? 1 : 0),
  }
}
