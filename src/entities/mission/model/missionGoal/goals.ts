import type { OriginalMission } from '@/shared/config/original/missions'

export interface MissionProgress {
  /** 목표 이름 → 지금까지 달성한 수 */
  readonly counts: Readonly<Record<string, number>>
  readonly plateAppearances: number
  /**
   * 미션 타자의 이 경기 **타수** — 정산 0xa8024 가 기록 게이트 0xa56dc(모드 5 · 6 갈래 0xa5764: 나리 · 명예 선수만 참)가 열린 타석에
   * 레코드 +0x20 을 올리는 칸(a887e, `countsAsAtBat`). 목표 칸이 아니라 소개 판 0x44944 의 타율 분모다. 안 센 판(옛 판)은 없다
   */
  readonly atBats?: number
  /** 이미 깨진 조건 목표 (무실점·무안타) */
  readonly brokenConditions: readonly string[]
}

export interface MissionGoal {
  readonly name: string
  readonly required: number
  readonly achieved: number
}

export function createProgress(): MissionProgress {
  return { counts: {}, plateAppearances: 0, brokenConditions: [] }
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
    return CYCLE_HIT_PARTS.filter((part) => (progress.counts[part] ?? 0) >= (mission.goalCounts[part] ?? 1)).length
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
 * 미션 HUD 목표 줄(`pages/mission-play/ui/MissionHud`)은 목표 글 +0xe 의 줄만 하나씩 보인다 — 원본 0x36714 도 칸 값·진행 수를 그리지 않아
 * 글에 없는 칸은 화면에 안 나온다(원본 그대로, `goalTicker` 주석).
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
