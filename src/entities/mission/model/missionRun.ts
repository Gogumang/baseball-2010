import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { OriginalMission } from '@/shared/config/original/missions'
import { createProgress, isCleared, recordOutcome, recordSteal } from '@/entities/mission/model/missionGoal'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import { EMPTY_BASES, advanceRunners, runnerCountOf } from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { runnerFatesWithoutPlay, type RunnerFate } from '@/features/defense-play/model/runnerFates'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { missionCpuAfterRuns, startMissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import {
  MISSION_NARI_RECORD,
  battingRecordAt,
  flipMissionHalf,
  humanSideOf,
  isMissionGameOver,
  simulateMissionAutoHalf,
  startMissionGame,
  withMissionScore,
} from '@/entities/mission/model/missionGame'
import { isMissionPitcherChangeBlocked, missionAcePitcherOf } from '@/entities/mission/model/missionCpuTeam'
import type { MissionGame } from '@/entities/mission/model/missionGame'
import { lineupSlotOf, recordLineupPlay } from '@/entities/game/model/quickLineup'

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
  /**
   * 상대 CPU 팀 — 0xaa57c 가 세운 다른 칸 팀과 0xf 진입 0x3d954 의 CPU 교체가 보는 칸들 (`missionCpuTeam`).
   * 타자 미션은 CPU 수비 투수진(실점 A·B), 투수 미션은 CPU 공격 타선(타순 칸 기록)을 든다.
   */
  readonly cpu: MissionCpuTeam
  /** 경기의 이닝 · 공수 · 점수판과 자동진행 반 이닝이 쓰는 팀 (`missionGame`) */
  readonly game: MissionGame
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
    cpu: startMissionCpuTeam(mission),
    game: startMissionGame(mission),
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
 * 궤적은 타석 판정(`resolvePitch` · `simulateBatter`)이 **쏜 패턴 그대로**다 — 결과 객체에 묶여 온다(`contactOfOutcome`).
 * 안타·아웃·홈런은 판 끝 정산(0xa8024 — `playOutcome`)이 낸다. 넘겨받은 결과는 타석을 끝낸 임시 값이다.
 * ⚠️ 묶인 패턴이 없는 결과(시험·옛 호출 — 원본에 없는 길)만 결과에 맞는 패턴을 원본 표에서 고른다(`fixturePatternFor`).
 *
 * `random` 을 주면 원본 확률 굴림(펌블 0xb41d0 · 악송구 0xa1828 · 필살수비 0x66b30/0x66be4)이
 * **돌고**, 안 주면 지금까지처럼 결정론이다. 미션 화면(`app/model/useMissionSession`)이 아직
 * 난수를 넘겨 주지 않아 기본값은 "안 굴림" 이다.
 *
 * ⚠️ **수비 능력치·주루는 못 넘긴다**: 미션 레코드(`OriginalMission`)에는 팀도 타순도 없어
 * 아홉 칸을 채울 근거가 없다. 그래서 진행기 기본값(등급 3 = 500)이 그대로 쓰인다 — **근사다**.
 * 협살도 마찬가지로 수비가 CPU 인지 알 길이 없어(원본은 `state[0x31+수비측]`) 돌리지 않는다.
 */
export function missionAdvance(
  bases: BaseState,
  outs: number,
  outcome: AtBatOutcome,
  options: {
    readonly random?: RandomPort
    readonly gameMode?: number
    /**
     * **화면(상태 0x17)이 이미 틱까지 다 돌린 플레이.** 주면 여기서 다시 굴리지 않고 그 결과를
     * 그대로 쓴다 — 한 타구에 두 번 굴리면 난수 차례가 어긋난다 (`gameFlow.resolveDefensePlay` 와 같은 자리).
     */
    readonly played?: DefensePlayResult
  } = {},
): AdvanceResult {
  return missionPlay(bases, outs, outcome, options).advance
}

/** 미션 타석 하나의 결과 — 진루·아웃·득점에 **주자 목록의 운명**(정산 0xa8024 가 읽는 +0x95·+0x96)을 붙인 것 */
export interface MissionPlay {
  readonly advance: AdvanceResult
  /** 기록할 결과 — 판을 돈 타구는 판 끝 정산이 낸 것, 아니면 넘겨받은 그대로 */
  readonly outcome: AtBatOutcome
  /** 원본 목록 순서(`[타자주자?, 1루?, 2루?, 3루?]`)의 운명 — `features/defense-play/model/runnerFates` */
  readonly runnerFates: readonly RunnerFate[]
}

/**
 * `missionAdvance` 와 **같은 길·같은 굴림**으로 돌리고 주자 운명까지 내준다.
 * 인플레이 타구는 진행기 결과의 `runnerFates`, 삼진·볼넷·사구·홈런은 `runnerFatesWithoutPlay` 다.
 */
export function missionPlay(
  bases: BaseState,
  outs: number,
  outcome: AtBatOutcome,
  options: Parameters<typeof missionAdvance>[3] = {},
): MissionPlay {
  if (!isMissionPlayOutcome(outcome)) {
    return {
      advance: advanceRunners(bases, outcome, outs),
      outcome,
      runnerFates: runnerFatesWithoutPlay(bases, outcome),
    }
  }
  const played =
    options.played ??
    runDefensePlay(missionDefensePlayInputOf(bases, outs, outcome, options.random, options.gameMode))
  // 기록은 판 끝 정산 결과 — 묶인 패턴 없이 결과만 넘겨받은 호출(시험·옛 호출)만 넘겨받은 결과 그대로다
  const settled = contactOfOutcome(outcome) === undefined ? outcome : (played.outcome ?? outcome)
  return { advance: played.advance, outcome: settled, runnerFates: played.runnerFates }
}

/**
 * 이 결과가 수비 판을 도는가 — 쏜 패턴이 묶여 있으면 안타·아웃·홈런 모두(원본은 담장을 넘긴 공도 판 안에서 끝난다),
 * 묶인 패턴이 없으면(시험·옛 호출·판정 11) 예전처럼 안타·아웃만 판을 돈다.
 */
export function isMissionPlayOutcome(outcome: AtBatOutcome): boolean {
  return contactOfOutcome(outcome) !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome)
}

/**
 * 미션 인플레이 타구 하나를 수비 진행기에 넘길 꼴로 만든다 — 만드는 데 난수를 **한 톨도 쓰지 않는다**
 * (굴림은 전부 진행기 안에서 돈다). 화면이 실시간으로 돌리는 갈래(`DefensePlayback` 의 `input`)와
 * 여기서 바로 돌리는 갈래가 **같은 입력**을 쓰게 하려고 따로 뺐다.
 */
export function missionDefensePlayInputOf(
  bases: BaseState,
  outs: number,
  outcome: AtBatOutcome,
  random?: RandomPort,
  gameMode?: number,
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 **원본 기본값인 수동**이다.
   *
   * `0xae6c8` = `(경기[0x31 + 수비측] == 1) || (설정+0xf4 != 0)` 이고(ae6d4 `movs r3,#0xa`),
   * 거짓이면 CPU 송구 결정 `0xafa60` 을 아예 안 돌린다. **투수편 미션은 사람이 수비**라
   * 앞 항이 거짓이니 설정이 그대로 답이 된다. 타자편 미션은 수비가 CPU 라 앞 항이 늘 참이어서
   * 이 값과 상관이 없다 — 그래서 아래도 투수편에만 싣는다.
   */
  throwModeManual?: boolean,
): DefensePlayInput {
  // 투수편 미션은 사람이 수비다 — 공격이 CPU 라 `0xae690` 의 첫 항이 서서 늘 자동 진루이고,
  // 협살(AI 상태 8)은 `state[0x31 + 수비측] == 1` 이 아니라 안 돈다 (S8 1-4). 타자편은 그 반대다.
  const isPitcherSide = gameMode === MISSION_PITCHER_SIDE_MODE
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(contactOfOutcome(outcome)?.pattern ?? fixturePatternFor(outcome)),
    // ⚠️ 묶인 패턴이 없으면(시험·옛 호출) 기록은 넘겨받은 결과 그대로다
    outcomeIsGiven: contactOfOutcome(outcome) === undefined,
    bases,
    outs,
    random,
    // 미션 투수편 = 전역 모드 5 · 타자편 = 6.
    // 둘 다 필살수비 기준을 손대지 않는 모드라 값만 흘려 보낸다.
    gameMode: gameMode ?? MISSION_BATTER_MODE,
    defenseIsCpu: !isPitcherSide,
    offenseIsCpu: isPitcherSide,
    // 사람이 수비하는 투수편에서만 환경설정 송구가 먹는다 (0xae6c8 의 앞 항이 거짓)
    ...(isPitcherSide ? { throwMode: throwModeManual === false ? '자동' : '수동' } : {}),
  }
}

/** `pitcherRun.MISSION_PITCHER_MODE` 와 같은 값 — 고리 import 를 피하려고 여기 다시 적었다 */
const MISSION_PITCHER_SIDE_MODE = 5

/**
 * 미션 타자편 = 원본 전역 모드 **6** (투수편이 5 다).
 * 모드 5 가 XlsPITCHER_MISSION 을 올린다 — H-modes 표의 "5 타자 · 6 투수" 는 거꾸로였다
 * (Q2-mission-rewards 1-0 확정: 미션 객체가 `ldrsb [obj+0xbf]; cmp #6` 으로 편을 가르고,
 * 6 이면 행 크기 0xa8=168(타자 표), 아니면 0xa5=165(투수 표)).
 */
export const MISSION_BATTER_MODE = 6

/**
 * 공격 결과로 주자·아웃을 옮긴다. 3아웃이면 빈 루 · 0아웃이고 `inningEnded` — 반 이닝 넘김 · 자동진행은 부르는 쪽이
 * 난수로 돌린다(`runBatterMissionAutoHalves`, `missionGame` 머리글). 원본은 시작 상황을 경기 처음에만 깐다(0xaae7c aaf10).
 *
 * **득점은 3아웃이어도 그대로 낸다** — 미션 '타점'(R+0x104)의 원본 길 (직접 재역어셈):
 * - 판 끝 판정 B 0xae3e8 은 아웃 > 2 여도(ae554 → 0x18) 정산 0xa8024 를 부른다(ae5b2), 판정 0xaaa6c 는 그 뒤(ae5c4).
 * - 정산은 이 판의 사건 목록에서 이벤트 0xf 를 센다(a8098~a80a0 → `[sp+0x28]`). 0xf 는 득점 처리 0xa5c34 가 점수판
 *   1점마다 넣는다(a5c70~a5c7c) — 바로 득점(메시지 0x13)이든 보류가 풀린 득점이든. 3아웃으로 영영 안 풀린 보류 득점만 빠진다.
 * - a8946: `state[0x11]`(공을 맞혔다 — 판정 0x51108 의 5131c 가 장면 +0xfd2 를 싣는다) · 볼 4개(`state[5] > 3`) ·
 *   사구(`state[0x12]`) 중 하나면 a8994 `0xa57f8(R, 0xe, [sp+0x28])` — 타점 += 그 판 득점. 아니면(a895a → a89c8) 안 든다.
 * 그래서 2아웃 뜬공에 친 순간 뛴 3루 주자가 포구 전에 홈을 밟은 득점(0xaa16e 바로 득점)도 그 판이 3아웃으로 끝나도
 * 타점이다(원본 그대로). 예전엔 3아웃이면 0 으로 버렸다. 맞히지 않은 판(견제·도루·폭투·포일, 낫아웃)은 이 함수를 안 지난다.
 */
export function advanceSituation(
  run: Pick<MissionRun, 'mission' | 'bases' | 'outs'>,
  outcome: AtBatOutcome,
  random?: RandomPort,
  /** 화면이 이미 다 돌린 수비 플레이. 주면 여기서 다시 굴리지 않는다 */
  played?: DefensePlayResult,
): { bases: BaseState; outs: number; runsScored: number; outcome: AtBatOutcome; inningEnded: boolean } {
  const play = missionPlay(run.bases, run.outs, outcome, { random, played })
  const advance = play.advance
  const outs = run.outs + advance.outsAdded
  if (outs >= OUTS_PER_INNING) {
    return {
      bases: EMPTY_BASES,
      outs: 0,
      runsScored: advance.runsScored,
      outcome: play.outcome,
      inningEnded: true,
    }
  }
  return { bases: advance.bases, outs, runsScored: advance.runsScored, outcome: play.outcome, inningEnded: false }
}

/**
 * **지금 사람 칸 팀 타석에 미션 타자가 섰나** — 사건 기록 0xa57f8 은 코드 ≤ 0x13(안타 · 타점 · 타석 7 · 스윙 9 · 도루 0x10 …)을
 * `0xa56dc(R, 0xae89c(공격 팀), 1)` — 지금 타자가 R 의 선수(미션 타자)일 때만 R 에 넣는다(a5844~a584c). 타자 미션의 다른 타순은 사람 칸 팀
 * 마스터 줄이라 목표 · 타석 · 스윙 칸에 안 든다. 투수 미션은 늘 참(이 칸을 안 쓴다).
 */
export function isMissionBatterUp(run: Pick<MissionRun, 'mission' | 'game'>): boolean {
  if (run.mission.side !== '타자') return true
  return battingRecordAt(run.game.humanBatting) === MISSION_NARI_RECORD
}

/**
 * 사람 칸 팀 타석 하나가 끝났다 — 정산 0xa8024 가 그 타순 칸 기록을 올리고 0xaf020 이 타순을 (+1) mod 9 로 넘긴다.
 * 점수판 득점(0xa5c34)은 사람 칸 측, 3아웃이면 0x18 · 자동진행을 기다린다.
 */
function afterHumanPlateAppearance(game: MissionGame, mission: OriginalMission, outcome: AtBatOutcome | null, runs: number, inningEnded: boolean): MissionGame {
  const batting = game.humanBatting
  const scored = withMissionScore(game, humanSideOf(mission), runs)
  return {
    ...scored,
    humanBatting:
      outcome === null
        ? batting
        : { ...batting, lineup: recordLineupPlay(batting.lineup, batting.order, outcome), order: lineupSlotOf(batting.order + 1) },
    halfEnded: scored.halfEnded || inningEnded,
  }
}

/** 판 끝 판정 0xaaa6c aad20 — 경기 끝(0xb68fc)인데 아직이면 실패. `outs` 는 판정 때 state[6](3아웃 판이면 3) */
function judgedAtGameEnd<T extends MissionRun>(run: T, outs: number): T {
  if (run.status !== '진행중') return run
  return isMissionGameOver(run.game, Math.min(OUTS_PER_INNING, outs)) ? { ...run, status: '실패' } : run
}

/** 배트를 냈다 (헛스윙·파울 포함). 스윙 제한이 있는 미션만 줄어든다 — 스윙 칸(코드 9)은 미션 타자의 스윙만 센다. */
export function recordSwing<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null || !isMissionBatterUp(run)) return run
  return { ...run, remainingSwings: run.remainingSwings - 1 }
}

/** 타석이 끝나지 않았는데 스윙을 다 썼으면 실패다. */
export function checkSwingsExhausted<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null) return run
  return run.remainingSwings <= 0 ? { ...run, status: '실패' } : run
}

/**
 * 타석 하나가 끝났을 때. 목표를 채우면 즉시 성공, 제한을 넘기면 실패다.
 *
 * `random` 을 주면 수비 진행기의 원본 확률 굴림이 돈다 — 안 주면 지금까지와 같은 결정론이다.
 * `played` 를 주면 **화면(상태 0x17)이 이미 돌린** 플레이의 결과를 그대로 먹인다.
 */
export function applyOutcome(
  run: MissionRun,
  outcome: AtBatOutcome,
  isBunt = false,
  random?: RandomPort,
  played?: DefensePlayResult,
): MissionRun {
  if (run.status !== '진행중') return run

  const situation = advanceSituation(run, outcome, random, played)
  // 미션 타자가 아닌 사람 칸 타순(마스터 줄)의 타석은 목표 · 타석 칸에 안 든다 (0xa57f8 a5844 — `isMissionBatterUp`)
  const counts = isMissionBatterUp(run)
  // 목표는 판 끝 정산(0xa8024 → 미션 판정 0xaaa6c)이 낸 결과로 센다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  const progress = counts
    ? recordOutcome(run.progress, situation.outcome, situation.runsScored, isBunt, runnerCountOf(run.bases))
    : run.progress
  const advanced: MissionRun = {
    ...run,
    bases: situation.bases,
    outs: situation.outs,
    // 점수판 득점 0xa5c34 → CPU 수비 투수의 실점 A·B, 3아웃이면 이닝 교대 0xa5b00 의 A = 0
    cpu: missionCpuAfterRuns(run.cpu, situation.runsScored, situation.inningEnded),
    game: afterHumanPlateAppearance(run.game, run.mission, situation.outcome, situation.runsScored, situation.inningEnded),
  }
  const remaining =
    run.remainingPlateAppearances === null || !counts ? run.remainingPlateAppearances : run.remainingPlateAppearances - 1

  if (isCleared(run.mission, progress)) {
    return { ...advanced, progress, remainingPlateAppearances: remaining, status: '성공' }
  }
  const isOutOfChances =
    (remaining !== null && remaining <= 0) ||
    (run.remainingSwings !== null && run.remainingSwings <= 0)
  const judged: MissionRun = {
    ...advanced,
    progress,
    remainingPlateAppearances: remaining,
    status: isOutOfChances ? '실패' : '진행중',
  }
  return judgedAtGameEnd(judged, situation.inningEnded ? OUTS_PER_INNING : situation.outs)
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

/**
 * **CPU 투수의 견제 한 판**이 끝났다 — 진행기(`runPickoffPlay`)가 낸 진루·아웃만 먹인다.
 *
 * 원본은 메시지 0x10 → `0x50f28`(모드 갈림 없음) → 플레이 종류 4 · 상태 0x17 → 판 끝 `0xae3e8` 에서
 * 정산 0xa8024 와 미션 판정 0xaaa6c(0xae5c4)를 부른다. 종류 4 는 타석이 아니라(state[0x26], 0xa8d98)
 * 남은 타석·스윙은 그대로이고, 안타·타점 가지도 안 선다 — 목표 칸은 하나도 안 움직인다.
 *
 * 3아웃이면 빈 루 · 0아웃 · 자동진행 대기(타구 `advanceSituation` 과 같다). 판 끝 판정은 경기 끝(끝내기 등)이면 실패로.
 * ⚠️ 악송구로 들어온 득점은 타점이 아니라 목표에 안 들고, 화면 점수(시작 점수 + 타점)에도 안 보인다 — 웹 미션은
 *    득점 칸을 따로 들지 않는다(근사).
 */
export function applyPickoff<T extends MissionRun>(run: T, advance: AdvanceResult): T {
  if (run.status !== '진행중') return run
  const outs = run.outs + advance.outsAdded
  // 판의 득점도 점수판 득점 0xa5c34 라 CPU 수비 투수의 실점 A·B 에 든다 (타자 미션)
  const isInningOver = outs >= OUTS_PER_INNING
  const cpu = missionCpuAfterRuns(run.cpu, advance.runsScored, isInningOver)
  const game = afterHumanPlateAppearance(run.game, run.mission, null, advance.runsScored, isInningOver)
  const moved: T = isInningOver
    ? { ...run, bases: EMPTY_BASES, outs: 0, cpu, game }
    : { ...run, bases: advance.bases, outs, cpu, game }
  return judgedAtGameEnd(moved, outs)
}

/** 도루 실패 — 주자가 죽는다 */
export function failSteal(run: MissionRun): MissionRun {
  if (!canSteal(run)) return run
  const bases = { ...run.bases, first: false }
  const outs = run.outs + 1
  if (outs >= OUTS_PER_INNING) {
    return judgedAtGameEnd(
      {
        ...run,
        bases: EMPTY_BASES,
        outs: 0,
        cpu: missionCpuAfterRuns(run.cpu, 0, true),
        game: afterHumanPlateAppearance(run.game, run.mission, null, 0, true),
      },
      outs,
    )
  }
  return { ...run, bases, outs }
}

/** 반 이닝을 몇 번까지 자동으로 돌리나 — 경기 끝(연장도 결국 끝난다) 전에 멈출 일이 없게 넉넉히 */
const MAXIMUM_AUTO_HALVES = 200

/**
 * **타자 미션의 3아웃 뒤** — 0x18 → 0xc2198 → 자동진행 0x21 → … → 0xd (`missionGame` 머리글).
 *
 * 0xc1e04 모드 6(c1e6a)은 공격 타자가 육성·명예 선수가 아니면 자동이라:
 * 1. CPU 가 치는 반 이닝 통째 — 공격 CPU 타선(`cpuAutoBatting`) · 수비 사람 칸 팀 투수진(`humanPitching`).
 * 2. 사람 칸 팀 반 이닝 — 미션 타자 차례(`MISSION_NARI_RECORD`)가 오기 전까지 자동(수비 = CPU 팀 `cpu.pitching`). 오면 0x18 → 0xd —
 *    그 자리의 루 · 아웃 · 카운트 0-0 으로 미션 타자가 선다. 그 반 이닝이 미션 타자 차례 전에 3아웃이면 1 로 돌아간다.
 * 반 이닝이 끝날 때마다 c21d6 경기 끝 → 끝났으면 판정 없이 0x19(미션 객체 +0xbc 가 안 서 **실패**), 아니면 0xb6b6c · c2248 판정(목표 칸은
 * 그 사이 안 움직인다 — 사건 0xa57f8 은 지금 타자가 미션 타자일 때만 R 에 든다).
 * 미션 객체 +0xbd ∈ {3, 7}(레오니 · 발렌타인)이면 간이 엔진 0xc1ba4 도 0x66864 로 투수 교체를 건너뛴다 — 양 팀 모두.
 * 0xd 의 0xaae7c 마투수 다시 끼우기(ab006~ab06e, 모드 6 · 공격이 사람)는 웹에 남는 일이 없다: 마투수가 마운드에 있으면 안 끼우고,
 * 내려갔으면 명부 레코드 0 ↔ 8 만 바뀌고 `0xaea84(팀, 0)` 이 교체 예약(+0x290)을 지워 마운드(team[0])는 그대로다 — 0xabfcc 는
 * 마선수를 안 고르므로 그 레코드가 다시 오를 길도 없다.
 * 난수: 자동진행 반 이닝마다 간이 엔진 굴림(타석마다 0xc1ba4 대타 · 투수 교체, 0xc262c 공 · 타구).
 */
export function runBatterMissionAutoHalves(
  run: MissionRun,
  random: RandomPort,
  aceLevels?: Readonly<Record<number, number>>,
): MissionRun {
  if (!run.game.halfEnded) return run
  let game: MissionGame = { ...run.game, halfEnded: false }
  if (run.status !== '진행중' || run.mission.side !== '타자') return { ...run, game }
  const cpuBatting = game.cpuAutoBatting
  const humanPitching = game.humanPitching
  let cpuPitching = run.cpu.pitching
  if (cpuBatting === null || humanPitching === null || cpuPitching === null) return { ...run, game }
  const blocked = isMissionPitcherChangeBlocked(run.mission)
  const ace = missionAcePitcherOf(run.mission, aceLevels)
  for (let half = 0; half < MAXIMUM_AUTO_HALVES; half += 1) {
    // CPU 공격 반 이닝
    game = flipMissionHalf(game)
    const cpuHalf = simulateMissionAutoHalf(game, game.cpuAutoBatting ?? cpuBatting, game.humanPitching ?? humanPitching, random, false, {
      pitcherChangeBlocked: blocked,
    })
    game = {
      ...withMissionScore(game, game.offenseSide, cpuHalf.runs),
      cpuAutoBatting: cpuHalf.batting,
      // 이닝 교대 0xa5b00 이 A 를 0 으로
      humanPitching: { ...cpuHalf.pitching, inningRunsAllowed: 0 },
    }
    if (cpuHalf.gameEnded) return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, status: '실패' }
    // 사람 칸 팀 반 이닝 — 미션 타자 차례까지
    game = flipMissionHalf(game)
    const humanHalf = simulateMissionAutoHalf(
      game,
      game.humanBatting,
      { ...cpuPitching, inningRunsAllowed: 0 },
      random,
      true,
      { ...(ace === undefined ? {} : { ace }), pitcherChangeBlocked: blocked },
    )
    game = { ...withMissionScore(game, game.offenseSide, humanHalf.runs), humanBatting: humanHalf.batting }
    cpuPitching = {
      ...humanHalf.pitching,
      // 리드(수비 − 공격)의 우리 쪽 — 사람 칸 팀 득점
      ourRuns: humanHalf.pitching.ourRuns + humanHalf.runs,
      inningRunsAllowed: humanHalf.stoppedBeforeNari ? humanHalf.pitching.inningRunsAllowed : 0,
    }
    if (humanHalf.gameEnded) return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, status: '실패' }
    if (humanHalf.stoppedBeforeNari) {
      return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, bases: humanHalf.bases, outs: humanHalf.outs }
    }
  }
  return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching } }
}

export function giveUp(run: MissionRun): MissionRun {
  return run.status === '진행중' ? { ...run, status: '실패' } : run
}
