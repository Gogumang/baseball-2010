import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { OriginalMission } from '@/shared/config/original/missions'
import { MISSIONS } from '@/shared/config/original/missions'

/**
 * 미션 모드 목표 판정.
 *
 * 원작 설명서: "타자편, 투수편으로 나누어지며 총 28개의 미션이 준비되어 있습니다.
 * 육성 선수 혹은 팀을 조작하여 제한 조건 내에서 게임 내 목표를..."
 *
 * 목표 이름과 필요 개수는 모두 원본 레코드에 있다 (goalCounts — 레코드 뒤쪽 칸).
 * 설명문의 숫자("2안타와 1타점을 올리자!")와 전부 일치하고, 설명문에 숫자가 없는
 * 목표(투수 1번 아웃 3)도 레코드에는 있다.
 */

export interface MissionProgress {
  /** 목표 이름 → 지금까지 달성한 수 */
  readonly counts: Readonly<Record<string, number>>
  readonly plateAppearances: number
  /** 이미 깨진 조건 목표 (무실점·무안타) */
  readonly brokenConditions: readonly string[]
}

export interface MissionGoal {
  readonly name: string
  readonly required: number
  readonly achieved: number
}

/**
 * 미션 목록 — StrHOWTO[27] "총 28개의 미션". 원본 레코드 38개 중 단계(stage) 0 인 "OO 공략" 10개는
 * 마선수 대결용 레코드라 목록에 올리지 않는다 (ACE_CHALLENGE_MISSIONS 로 따로 둔다).
 */
const isListedMission = (mission: OriginalMission) => mission.stage > 0

export const BATTER_MISSIONS: readonly OriginalMission[] = MISSIONS.filter(
  (mission) => mission.side === '타자' && isListedMission(mission),
)

export const PITCHER_MISSIONS: readonly OriginalMission[] = MISSIONS.filter(
  (mission) => mission.side === '투수' && isListedMission(mission),
)

export const ACE_CHALLENGE_MISSIONS: readonly OriginalMission[] = MISSIONS.filter(
  (mission) => !isListedMission(mission),
)

export function createProgress(): MissionProgress {
  return { counts: {}, plateAppearances: 0, brokenConditions: [] }
}

/** 클리어 기록 키. 타자편·투수편의 미션 번호가 겹치므로 편을 함께 적는다. */
export function missionKeyOf(mission: OriginalMission): string {
  return `${mission.side}:${mission.id}`
}

/** 사이클링 히트는 단타·2루타·3루타·홈런을 하나씩 친다 (설명문 원문) */
export const CYCLE_HIT_PARTS: readonly string[] = ['단타', '2루타', '3루타', '홈런']
const CYCLE_HIT_GOAL = '사이클링히트'

/**
 * 조건 목표 — 개수가 아니라 "허용하지 않는다"는 조건이다. 원본 레코드의 실패 한도(failLimits)에 닿으면 깨진다
 * (실점 → 무실점, 피안타 → 무안타, 볼넷 → 무사사구). 목표 칸에 이름이 있는 것은 투수 7번 무실점뿐이다.
 */
export const CONDITION_GOALS: readonly string[] = ['무실점', '무안타', '무사사구']

/** 한 이닝은 3아웃이다. 노히트노런·퍼펙트게임 미션이 이닝으로 목표를 잰다. */
export const OUTS_PER_INNING = 3
const INNING_GOALS: readonly string[] = ['노히트노런', '퍼펙트게임']

/** 마지막 이닝 — 이닝 목표는 시작 이닝부터 9회까지다 ((9 − 시작 이닝) × 3 아웃, 0xaa940) */
const LAST_INNING = 9

/** 이닝으로 목표를 재는 미션의 이닝 수. 투수 13번은 5회 시작 → 5이닝, 14번은 4회 → 6이닝 */
export function inningGoalOf(mission: OriginalMission): number | null {
  if (!mission.goals.some((goal) => INNING_GOALS.includes(goal))) return null
  return LAST_INNING - mission.start.inning + 1
}

/**
 * 목표 개수 — 원본 레코드 뒤쪽 칸(goalCounts)이다. 설명문에 숫자가 없는 목표도 여기에는 있다
 * (투수 1번 "경기를 마무리" = 아웃 3). 사이클링히트는 네 가지 안타를 하나씩,
 * 노히트노런·퍼펙트게임은 이닝×3 아웃이다.
 */
export function requiredCountOf(mission: OriginalMission, goal: string): number {
  if (goal === CYCLE_HIT_GOAL) return CYCLE_HIT_PARTS.length
  if (INNING_GOALS.includes(goal)) return (inningGoalOf(mission) ?? 1) * OUTS_PER_INNING
  return mission.goalCounts[goal] ?? 1
}

function achievedCountOf(mission: OriginalMission, goal: string, progress: MissionProgress): number {
  if (goal === CYCLE_HIT_GOAL) {
    return CYCLE_HIT_PARTS.filter(
      (part) => (progress.counts[part] ?? 0) >= (mission.goalCounts[part] ?? 1),
    ).length
  }
  return progress.counts[goal] ?? 0
}

/** 조건 목표(무실점)는 개수로 재지 않는다 — 깨지지 않았으면 채운 것으로 본다. */
export function goalsOf(mission: OriginalMission, progress: MissionProgress): MissionGoal[] {
  return mission.goals.map((name) => {
    if (CONDITION_GOALS.includes(name)) {
      return { name, required: 1, achieved: progress.brokenConditions.includes(name) ? 0 : 1 }
    }
    return {
      name,
      required: requiredCountOf(mission, name),
      achieved: achievedCountOf(mission, name, progress),
    }
  })
}

export function isCleared(mission: OriginalMission, progress: MissionProgress): boolean {
  return goalsOf(mission, progress).every((goal) => goal.achieved >= goal.required)
}

const FULL_BASES = 3

/** 타석 결과가 어떤 목표에 해당하는지. 원본 목표 이름을 그대로 쓴다. */
export function goalNamesFor(
  outcome: AtBatOutcome,
  runsBattedIn: number,
  isBunt = false,
  runnersBefore = 0,
): string[] {
  const names: string[] = []

  // 번트는 인플레이 타구가 되면 성공으로 본다.
  if (isBunt && (outcome.kind === '안타' || outcome.kind === '아웃')) names.push('번트')

  if (outcome.kind === '안타') {
    names.push('안타')
    if (outcome.bases === 1) names.push('단타')
    if (outcome.bases === 2) names.push('2루타')
    if (outcome.bases === 3) names.push('3루타')
  }
  if (outcome.kind === '홈런') {
    names.push('안타', '홈런')
    // 원본은 타자주자가 **플레이 중 홈에 닿으면** 홈런으로 세고 그라운드홈런 수도 함께 올린다
    // (0xaa0a8 → state+0x25, E-8 확정). 웹 타구 근사에는 장내 홈런을 만들 길이 없어
    // 수비 시뮬레이션이 들어올 때까지는 **담장 넘긴 홈런도 그라운드홈런으로 친다** —
    // 앞서 3루타를 그라운드홈런으로 세던 것보다 원본에 가깝다(원본은 3루타를 절대 안 센다).
    names.push('그라운드홈런')
    if (runnersBefore === FULL_BASES) names.push('만루홈런')
  }
  if (runsBattedIn > 0) names.push('타점')

  return names
}

/**
 * 투수편 목표 이름. 원본 레코드에 있는 그대로다:
 * 아웃 · 탈삼진 · MAX게이지 · 삼진콤보 · 무실점 · 노히트노런 · 퍼펙트게임
 */
export function pitcherGoalNamesFor(
  outcome: AtBatOutcome,
  gauge: string,
): string[] {
  const names: string[] = []

  if (outcome.kind === '삼진') names.push('탈삼진', '아웃')
  if (outcome.kind === '아웃') names.push('아웃')
  if (gauge === 'PERFECT') names.push('MAX게이지')

  return names
}

/** 투수편 한 타석을 기록한다. 삼진 콤보는 연속이 끊기면 0으로 돌아간다. */
export function recordPitcherOutcome(
  progress: MissionProgress,
  outcome: AtBatOutcome,
  perfectGauges: number,
  brokenConditions: readonly string[] = [],
): MissionProgress {
  const counts = { ...progress.counts }

  for (const name of pitcherGoalNamesFor(outcome, '')) {
    counts[name] = (counts[name] ?? 0) + 1
  }
  if (perfectGauges > 0) {
    counts['MAX게이지'] = (counts['MAX게이지'] ?? 0) + perfectGauges
  }

  // 삼진콤보 — 연속 삼진만 센다
  const combo = outcome.kind === '삼진' ? (progress.counts['삼진콤보'] ?? 0) + 1 : 0
  counts['삼진콤보'] = combo

  // 노히트노런·퍼펙트게임은 허용하는 순간 0 으로 돌아가고, 그 전까지는 잡은 아웃 수만큼 쌓인다
  // (목표가 이닝×3 아웃이다). 볼넷은 노히트노런을 깨지 않지만 아웃도 아니다.
  const isHitAllowed = outcome.kind === '안타' || outcome.kind === '홈런'
  const isRunnerAllowed = isHitAllowed || outcome.kind === '볼넷'
  const outGained = outcome.kind === '삼진' || outcome.kind === '아웃' ? 1 : 0
  counts['노히트노런'] = isHitAllowed ? 0 : (progress.counts['노히트노런'] ?? 0) + outGained
  counts['퍼펙트게임'] = isRunnerAllowed ? 0 : (progress.counts['퍼펙트게임'] ?? 0) + outGained

  const newlyBroken = brokenConditions.filter((condition) => !progress.brokenConditions.includes(condition))

  return {
    counts,
    plateAppearances: progress.plateAppearances + 1,
    brokenConditions: [...progress.brokenConditions, ...newlyBroken],
  }
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
  runnersBefore = 0,
): MissionProgress {
  const counts = { ...progress.counts }
  for (const name of goalNamesFor(outcome, runsBattedIn, isBunt, runnersBefore)) {
    counts[name] = (counts[name] ?? 0) + (name === '타점' ? runsBattedIn : 1)
  }
  return { ...progress, counts, plateAppearances: progress.plateAppearances + 1 }
}

/** 선택 목록의 미션(타자·투수 28개)을 모두 깼는가 — 히든 오픈 조건 (0xa5184) */
export function isEveryMissionCleared(clearedKeys: readonly string[]): boolean {
  return [...BATTER_MISSIONS, ...PITCHER_MISSIONS].every((mission) => clearedKeys.includes(missionKeyOf(mission)))
}
