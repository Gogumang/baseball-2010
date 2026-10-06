import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { isFreePass } from '@/entities/at-bat/model/atBatOutcome'
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

/**
 * **목표 글에 이름이 없는 목표 칸** — 판정은 이것도 본다 (직접 재역어셈).
 *
 * 판 끝 판정 0xaaa6c 는 레코드의 목표 글(+0xe, 32바이트 `goals`)을 읽지 않는다. 행+0xa0.. 의 목표 칸을 **모두**
 * `0xaa928(미션, 칸, 한도)`(한도 > 0 이고 칸 < 한도면 상태 1 = 아직)로 차례로 견줄 뿐이라, 0 이 아닌 칸은 글에 없어도 목표다:
 * - 타자(모드 6, aaade~aab56): 안타 합 R+0xb4..0xc0 ↔ +0xa6 · 단타 R+0xb4 ↔ +0xa1 아래 · 2루타 R+0xb8 ↔ +0xa0 위 ·
 *   3루타 R+0xbc ↔ +0xa0 아래 · 홈런 R+0xc0 ↔ +0xa3 아래 · 만루홈런 R+0xc8 ↔ +0xa2 위 · 그라운드홈런 R+0xcc ↔ +0xa2 아래 ·
 *   번트 R+0xf4 ↔ +0xa4 위 · 타점 R+0x104 ↔ +0xa5 · 도루 R+0x10c ↔ +0xa4 아래.
 * - 투수(모드 5, aac76~aacd6): 탈삼진 R+0x134 ↔ +0xa0 위 · 삼진콤보 R+0x14c ↔ +0xa0 아래 · MAX게이지 R+0x158 ↔ +0xa1 위 ·
 *   아웃 R+0x13c ↔ +0xa4.
 * `goalCounts` 가 바로 이 칸들(0 인 칸은 빠짐)이라, 목표 글에 없는 이름을 여기서 골라 판정에 더한다. 원본 표에서 걸리는 것은
 * 투수 9 "투혼의 삼진 행진"의 아웃 1 과 타자 14 "폭주!! 사이클링 히트"의 타점 1 · 안타 2(사이클을 채우면 늘 함께 찬다) 뿐이다.
 * 사이클링히트는 네 안타 칸(`CYCLE_HIT_PARTS`)을 글 하나로 묶은 것이라 그 넷은 이미 든 것으로 본다.
 * ⚠️ 화면 목표 막대(`goalsOf`)는 목표 글만 보인다 — 원본 화면이 칸을 어떻게 보이는지는 안 읽었다(미해결).
 */
export function unlistedGoalNamesOf(mission: OriginalMission): string[] {
  const covered = mission.goals.includes(CYCLE_HIT_GOAL) ? [...mission.goals, ...CYCLE_HIT_PARTS] : mission.goals
  return Object.entries(mission.goalCounts)
    .filter(([name, count]) => count > 0 && !covered.includes(name))
    .map(([name]) => name)
}

/** 판정이 보는 목표 전부 — 목표 글의 목표(`goalsOf`)에 글에 없는 목표 칸(`unlistedGoalNamesOf`)을 더한 것 */
export function judgedGoalsOf(mission: OriginalMission, progress: MissionProgress): MissionGoal[] {
  const unlisted = unlistedGoalNamesOf(mission).map((name) => ({
    name,
    required: mission.goalCounts[name] ?? 0,
    achieved: progress.counts[name] ?? 0,
  }))
  return [...goalsOf(mission, progress), ...unlisted]
}

export function isCleared(mission: OriginalMission, progress: MissionProgress): boolean {
  return judgedGoalsOf(mission, progress).every((goal) => goal.achieved >= goal.required)
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

  // 번트는 **번트 안타만** 센다 (직접 재역어셈). 판정 0xaaa6c 모드 6 갈래는 '번트' 를 0xaa928(R+0xf4, 행+0xa4 위)
  // (aab36)로 재고, R+0xf4(사건 코드 0xa, 핸들러 0xa58da `+= 1`)를 올리는 곳은 정산 0xa8024 의 a8506 하나뿐이다 —
  // 안타 갈래(a8490 `[sp+0x14]` = 안타 표시가 서야 들어간다) 안에서 게임+0x13(번트 타구 표시)이 켜졌을 때.
  // 희생번트처럼 아웃으로 끝난 번트는 안 든다 (번트 시도 수는 스윙 0xa5fac 의 코드 0xb → R+0xf8 로 따로 간다).
  if (isBunt && outcome.kind === '안타') names.push('번트')

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
  const counts = { ...progress.counts }

  for (const name of pitcherGoalNamesFor(outcome, '')) {
    if (name === '아웃') continue
    counts[name] = (counts[name] ?? 0) + 1
  }
  if (outsRecorded > 0) counts['아웃'] = (counts['아웃'] ?? 0) + outsRecorded
  if (perfectGauges > 0) {
    counts['MAX게이지'] = (counts['MAX게이지'] ?? 0) + perfectGauges
  }

  // 삼진콤보 — 연속 삼진만 센다
  const combo = outcome.kind === '삼진' ? (progress.counts['삼진콤보'] ?? 0) + 1 : 0
  counts['삼진콤보'] = combo

  // 노히트노런·퍼펙트게임은 허용하는 순간 0 으로 돌아가고, 그 전까지는 잡은 아웃 수만큼 쌓인다
  // (목표가 이닝×3 아웃이다). 볼넷·사구는 노히트노런을 깨지 않지만 아웃도 아니다.
  // 퍼펙트는 **사구도** 깬다 — 원본 퍼펙트 판정은 볼넷 R+0x144 와 함께 사구 R+0x148 이 0 이어야 한다
  // (미션 0xaabfc~0xaac12 `R+0x128·0x12c·0x144·0x148·0x130 모두 0` · 선발형 인기도 0xa6b0a 도 같다).
  const isHitAllowed = outcome.kind === '안타' || outcome.kind === '홈런'
  const isRunnerAllowed = isHitAllowed || isFreePass(outcome)
  const outGained = outsRecorded
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
