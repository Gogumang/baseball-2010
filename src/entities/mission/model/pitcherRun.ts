import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { OriginalMission } from '@/shared/config/original/missions'
import {
  createProgress,
  inningGoalOf,
  isCleared,
  OUTS_PER_INNING,
  recordPitcherOutcome,
} from '@/entities/mission/model/missionGoal'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { isHit } from '@/entities/at-bat/model/atBatOutcome'
import { limitOrNull, missionAdvance } from '@/entities/mission/model/missionRun'
import type { MissionRun, MissionStatus } from '@/entities/mission/model/missionRun'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 투수편 미션 진행.
 *
 * 타자편과 제한 규칙은 같지만("제한 조건 내에서 목표 달성"),
 * 제한이 타석이 아니라 **투구 수**인 미션이 있다 — 원본 레코드의 투구 수 제한
 * ("10개의 공으로 2삼진을 잡아라!", "6개의 공으로 삼진을 잡아라!").
 */

export interface PitcherRun extends MissionRun {
  /** 남은 투구 수. 제한이 없으면 null. */
  readonly remainingPitches: number | null
  /** 이번 타석에서 나온 PERFECT 게이지 수 */
  readonly perfectGauges: number
  /** 지금까지 잡은 아웃 수 (이닝 목표 계산용) */
  readonly totalOuts: number
  /** 허용한 실점·피안타·볼넷 — 레코드 실패 한도와 비교한다 (0xaac76~0xaacd6) */
  readonly allowed: { readonly runs: number; readonly hits: number; readonly walks: number }
}

export { inningGoalOf, OUTS_PER_INNING } from '@/entities/mission/model/missionGoal'

export function startPitcherMission(mission: OriginalMission): PitcherRun {
  return {
    mission,
    progress: createProgress(),
    status: '진행중',
    remainingSeconds: limitOrNull(mission.timeLimitSeconds),
    remainingPlateAppearances: limitOrNull(mission.plateAppearanceLimit),
    remainingSwings: null,
    remainingPitches: limitOrNull(mission.pitchLimit),
    perfectGauges: 0,
    bases: mission.start.runners,
    outs: mission.start.outs,
    totalOuts: 0,
    allowed: { runs: 0, hits: 0, walks: 0 },
  }
}

/** 공 하나를 던졌다. 아직 타석이 끝나지 않은 경우에도 투구 수는 줄어든다. */
export function recordPitch(run: PitcherRun, wasPerfectGauge: boolean): PitcherRun {
  if (run.status !== '진행중') return run

  const remaining = run.remainingPitches === null ? null : run.remainingPitches - 1
  return {
    ...run,
    remainingPitches: remaining,
    perfectGauges: run.perfectGauges + (wasPerfectGauge ? 1 : 0),
  }
}

/** 한도에 닿으면 깨지는 조건 이름 — 실점 → 무실점, 피안타 → 무안타, 볼넷 → 무사사구 */
function brokenConditionsOf(mission: OriginalMission, allowed: PitcherRun['allowed']): string[] {
  const limits = mission.failLimits
  const reached = (count: number, limit: number) => limit > 0 && count >= limit
  return [
    reached(allowed.runs, limits.runs) ? '무실점' : null,
    reached(allowed.hits, limits.hits) ? '무안타' : null,
    reached(allowed.walks, limits.walks) ? '무사사구' : null,
  ].filter((name): name is string => name !== null)
}

/**
 * 수비 쪽에서 주자·아웃을 옮긴다. 3아웃이면 다음 이닝(주자 없음, 0아웃).
 *
 * 인플레이 타구는 타자편 미션과 **같은** `missionAdvance` 로 간다 — 원본 수비 시뮬레이션
 * (태그업 0xa9620 + 자동 진루 0xaf918 "송구보다 2틱 이상 빠를 때만" + 2아웃 득점 보류)이다.
 * 실점(`allowed.runs`)·이닝 목표(`totalOuts`)가 이 결과를 그대로 받는다 (P2 7절 · U-02).
 */
function advanceDefense(run: PitcherRun, outcome: AtBatOutcome, options: PitcherOutcomeOptions) {
  const advance = missionAdvance(run.bases, run.outs, outcome, {
    random: options.random,
    played: options.played,
    gameMode: MISSION_PITCHER_MODE,
  })
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= OUTS_PER_INNING
  return {
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    outs: isInningOver ? 0 : outs,
    runsScored: advance.runsScored,
    outsAdded: advance.outsAdded,
  }
}

/** 미션 투수편 = 원본 전역 모드 **5** (타자편이 6 다 — Q2-mission-rewards 1-0 확정) */
export const MISSION_PITCHER_MODE = 5

export interface PitcherOutcomeOptions {
  /** 주면 수비 진행기의 원본 확률 굴림(펌블·악송구·필살수비)이 돈다 */
  readonly random?: RandomPort
  /** 화면(상태 0x17)이 이미 다 돌린 수비 플레이. 주면 여기서 또 굴리지 않는다 */
  readonly played?: DefensePlayResult
}

/** 타석이 끝났다. 목표를 채우면 성공, 한도·제한에 닿으면 실패다. */
export function applyPitcherOutcome(
  run: PitcherRun,
  outcome: AtBatOutcome,
  options: PitcherOutcomeOptions = {},
): PitcherRun {
  if (run.status !== '진행중') return run

  const defense = advanceDefense(run, outcome, options)
  const allowed = {
    runs: run.allowed.runs + defense.runsScored,
    hits: run.allowed.hits + (isHit(outcome) ? 1 : 0),
    walks: run.allowed.walks + (outcome.kind === '볼넷' ? 1 : 0),
  }
  const progress = recordPitcherOutcome(
    run.progress,
    outcome,
    run.perfectGauges,
    brokenConditionsOf(run.mission, allowed),
  )
  const remainingPlate =
    run.remainingPlateAppearances === null ? null : run.remainingPlateAppearances - 1
  const totalOuts = run.totalOuts + defense.outsAdded

  const next: PitcherRun = {
    ...run,
    progress,
    remainingPlateAppearances: remainingPlate,
    perfectGauges: 0,
    bases: defense.bases,
    outs: defense.outs,
    totalOuts,
    allowed,
  }
  return { ...next, status: judgeStatus(next) }
}

/** 이닝으로 목표를 재는 미션(노히트노런·퍼펙트게임)은 (9 − 시작 이닝 + 1) × 3 아웃을 잡으면 성공이다. */
function judgeStatus(run: PitcherRun): MissionStatus {
  if (run.progress.brokenConditions.length > 0) return '실패'

  const inningGoal = inningGoalOf(run.mission)
  const isDone =
    inningGoal !== null ? run.totalOuts >= inningGoal * OUTS_PER_INNING : isCleared(run.mission, run.progress)
  if (isDone) return '성공'
  return isOutOfChances(run.remainingPlateAppearances, run.remainingPitches) ? '실패' : '진행중'
}

function isOutOfChances(remainingPlate: number | null, remainingPitches: number | null): boolean {
  if (remainingPlate !== null && remainingPlate <= 0) return true
  return remainingPitches !== null && remainingPitches <= 0
}

/** 투구 수를 다 쓰면 타석 도중이라도 실패다. */
export function checkPitchExhausted(run: PitcherRun): PitcherRun {
  if (run.status !== '진행중' || run.remainingPitches === null) return run
  return run.remainingPitches <= 0 ? { ...run, status: '실패' } : run
}
