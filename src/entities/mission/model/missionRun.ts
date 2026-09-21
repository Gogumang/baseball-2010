import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { OriginalMission } from '@/shared/config/original/missions'
import { createProgress, isCleared, recordOutcome, recordSteal } from '@/entities/mission/model/missionGoal'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import { advanceRunners, runnerCountOf } from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'

/**
 * 미션 한 판의 진행 상태.
 *
 * 원작 미션은 "제한 조건 내에서 목표 달성"이다 (StrHOWTO[27]).
 * 제한은 원본 레코드에 숫자로 들어 있다 — 제한 시간, 타석 수, 스윙 수.
 * 설명문("3타석 내에", "3번의 스윙으로")과 모두 일치한다.
 * 시작 상황(주자·아웃)도 레코드에 있어 타점은 주자 진루 규칙으로 센다 (예전에는 홈런만 타점이었다).
 */

export type MissionStatus = '진행중' | '성공' | '실패'

export interface MissionRun {
  readonly mission: OriginalMission
  readonly progress: MissionProgress
  readonly status: MissionStatus
  /** 남은 시간(초). 제한이 없으면 null. */
  readonly remainingSeconds: number | null
  /** 남은 타석 수. 제한이 없으면 null. */
  readonly remainingPlateAppearances: number | null
  /** 남은 스윙 수. 제한이 없으면 null. */
  readonly remainingSwings: number | null
  /** 누상 주자 */
  readonly bases: BaseState
  /** 현재 아웃 */
  readonly outs: number
}

const OUTS_PER_INNING = 3

/** 원본 레코드는 0 으로 "제한 없음"을 나타낸다. */
export function limitOrNull(limit: number): number | null {
  return limit > 0 ? limit : null
}

export function startMission(mission: OriginalMission): MissionRun {
  return {
    mission,
    progress: createProgress(),
    status: '진행중',
    remainingSeconds: limitOrNull(mission.timeLimitSeconds),
    remainingPlateAppearances: limitOrNull(mission.plateAppearanceLimit),
    remainingSwings: limitOrNull(mission.swingLimit),
    bases: mission.start.runners,
    outs: mission.start.outs,
  }
}

/**
 * 미션 타석 하나의 주자·아웃·득점을 정한다.
 *
 * 미션도 **사람이 치는 타석**이라 원본은 간이 엔진(0xc11f0)이 아니라 수비 시뮬레이션을 돌린다
 * (0xae24c·0xae3e8). 그래서 인플레이 타구는 타자편·팀경기·투수편과 **같은 진행기**
 * `features/defense-play/runDefensePlay` 로 넘긴다 — 태그업 0xa9620 으로 모든 주자의 요구 루가
 * 원래 루가 되고, 자동 진루 0xaf918 이 **수비 송구보다 2틱 이상 빠를 때만** 다음 루로 보내며,
 * 2아웃 득점 보류(메시지 0x13)까지 그 안에서 돈다 (P2 7절 · U-02).
 *
 * 그래서 `baseState` 의 두 근사 — "3루 주자 + 2아웃 전 뜬공이면 무조건 1점"(희생플라이 보장)과
 * "안타 진루 고정" — 은 미션에서도 더 이상 쓰이지 않는다. 삼진·볼넷·홈런은 수비가 개입할 것이
 * 없어 예전 길 그대로다.
 *
 * ⚠️ 어느 원본 패턴이었는지는 미션 타석 쪽이 아직 안 넘겨 주므로 `representativePatternOf` 로
 * 같은 결과를 내는 원본 패턴 하나를 골라 궤적을 만든다 — **고르는 규칙은 근사다**
 * (타자편 `applyPlayerOutcome` 도 패턴을 못 받으면 같은 길을 쓴다).
 * 난수는 넘기지 않는다 — 펌블·악송구·필살수비 굴림을 돌리지 않아 결정론이고, 미션의
 * 기존 씨앗 순서도 건드리지 않는다.
 */
export function missionAdvance(bases: BaseState, outs: number, outcome: AtBatOutcome): AdvanceResult {
  if (!isBattedBallInPlay(outcome)) return advanceRunners(bases, outcome, outs)
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(representativePatternOf(outcome)),
    bases,
    outs,
  }).advance
}

/**
 * 공격 결과로 주자·아웃을 옮긴다. 3아웃이 되면 미션 시작 상황으로 되돌린다 —
 * 미션은 한 이닝을 넘기지 않는 것으로 본다 (추정).
 */
export function advanceSituation(
  run: Pick<MissionRun, 'mission' | 'bases' | 'outs'>,
  outcome: AtBatOutcome,
): { bases: BaseState; outs: number; runsScored: number } {
  const advance = missionAdvance(run.bases, run.outs, outcome)
  const outs = run.outs + advance.outsAdded
  if (outs >= OUTS_PER_INNING) {
    return { bases: run.mission.start.runners, outs: run.mission.start.outs, runsScored: 0 }
  }
  return { bases: advance.bases, outs, runsScored: advance.runsScored }
}

/** 배트를 냈다 (헛스윙·파울 포함). 스윙 제한이 있는 미션만 줄어든다. */
export function recordSwing<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null) return run
  return { ...run, remainingSwings: run.remainingSwings - 1 }
}

/** 타석이 끝나지 않았는데 스윙을 다 썼으면 실패다. */
export function checkSwingsExhausted<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null) return run
  return run.remainingSwings <= 0 ? { ...run, status: '실패' } : run
}

/** 타석 하나가 끝났을 때. 목표를 채우면 즉시 성공, 제한을 넘기면 실패다. */
export function applyOutcome(run: MissionRun, outcome: AtBatOutcome, isBunt = false): MissionRun {
  if (run.status !== '진행중') return run

  const situation = advanceSituation(run, outcome)
  const progress = recordOutcome(
    run.progress,
    outcome,
    situation.runsScored,
    isBunt,
    runnerCountOf(run.bases),
  )
  const advanced: MissionRun = { ...run, bases: situation.bases, outs: situation.outs }
  const remaining =
    run.remainingPlateAppearances === null ? null : run.remainingPlateAppearances - 1

  if (isCleared(run.mission, progress)) {
    return { ...advanced, progress, remainingPlateAppearances: remaining, status: '성공' }
  }
  const isOutOfChances =
    (remaining !== null && remaining <= 0) ||
    (run.remainingSwings !== null && run.remainingSwings <= 0)
  return {
    ...advanced,
    progress,
    remainingPlateAppearances: remaining,
    status: isOutOfChances ? '실패' : '진행중',
  }
}

/** 시간을 흘린다. 0이 되면 실패다. 투수편도 같은 규칙이다. */
export function tick<T extends MissionRun>(run: T, elapsedSeconds: number): T {
  if (run.status !== '진행중' || run.remainingSeconds === null) return run

  const remaining = Math.max(0, run.remainingSeconds - elapsedSeconds)
  return {
    ...run,
    remainingSeconds: remaining,
    status: remaining <= 0 ? '실패' : '진행중',
  }
}

/** 도루할 수 있는가 — 1루 주자가 있고 2루가 비어 있어야 한다 (StrHOWTO[2] 1루→2루) */
export function canSteal(run: MissionRun): boolean {
  return run.status === '진행중' && run.bases.first && !run.bases.second
}

/** 도루 성공 — 주자가 2루로 간다. 목표를 채우면 그 자리에서 성공이다. */
export function applySteal(run: MissionRun): MissionRun {
  if (!canSteal(run)) return run

  const progress = recordSteal(run.progress)
  const bases = { ...run.bases, first: false, second: true }
  return { ...run, bases, progress, status: isCleared(run.mission, progress) ? '성공' : '진행중' }
}

/** 도루 실패 — 주자가 죽는다 */
export function failSteal(run: MissionRun): MissionRun {
  if (!canSteal(run)) return run
  const bases = { ...run.bases, first: false }
  const outs = run.outs + 1
  if (outs >= OUTS_PER_INNING) {
    return { ...run, bases: run.mission.start.runners, outs: run.mission.start.outs }
  }
  return { ...run, bases, outs }
}

export function giveUp(run: MissionRun): MissionRun {
  return run.status === '진행중' ? { ...run, status: '실패' } : run
}
