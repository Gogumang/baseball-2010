import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { OriginalMission } from '@/shared/config/original/missions'
import {
  createProgress,
  inningGoalOf,
  isCleared,
  OUTS_PER_INNING,
  recordPitcherOutcome,
} from '@/entities/mission/model/missionGoal'
import { EMPTY_BASES, runnerCountOf } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
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
  /** 허용한 실점·피안타·볼넷(사구 제외)·출루 허용 — 레코드 실패 한도와 비교한다 (0xaac76~0xaaccc) */
  readonly allowed: {
    readonly runs: number
    readonly hits: number
    readonly walks: number
    /**
     * R+0x130 — **누계가 아니라 방금 정산한 플레이 하나의 값**(0/1). 정산 0xa8c86 이
     * `0xa57f8(R, 0x17, r5)` 로 넣고 점프표 0xd8218[0x17] = 0xa591c 가 `strb (r5 != 0)` 로 **덮어쓴다**.
     * 판정 0xaaa6c 은 정산 바로 뒤에 돌고(0xae24c: 0xae36a → 0xae382 · 0xae3e8: 0xae5b0 → 0xae5c4)
     * 실패(2)는 다음 판정부터 맨 앞(0xaaa8e)에서 돌아가 버려 그대로 남는다.
     */
    readonly baserunner: number
  }
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
    allowed: { runs: 0, hits: 0, walks: 0, baserunner: 0 },
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

/**
 * 한도에 닿으면 깨지는 조건 이름 — 실점 → 무실점, 피안타 → 무안타, 볼넷 → 무사사구, 출루 허용 → 무출루.
 *
 * 원본 판정 0xaac76~0xaacd6 은 레코드 바이트(행+0xa0)의 니블을 투수 기록 R 칸과 견준다
 * (`0xaa940`: 한도 > 0 이고 칸 ≥ 한도면 실패 2):
 *   +0xa1 아래 ↔ R+0x128(실점) · +0xa2 위 ↔ **R+0x144(볼넷)** · +0xa2 아래 ↔ R+0x12c(피안타) · +0xa3 ↔ R+0x130(출루 허용, u8)
 * "무사사구" 한도가 보는 R+0x144 는 **볼넷만**이다 — 코드 0x1c 는 볼 카운트 state[5] > 3 일 때뿐(0xa8e04~0xa8e0e)이고
 * 사구는 R+0x148(코드 0x1d, 0xa8e2a)로 따로 간다. 그래서 사구는 이 한도를 채우지 않는다 (이름과 달리 — 원본 그대로).
 *
 * 넷째 한도 +0xa3(s8, `0xaacca ldrsb`) ↔ R+0x130 (`0xaacc6 ldrb [r6,#0xc]`, r6 = R+0x124) — `0xaaccc bl 0xaa940` — 투수 13·14 번만 1 이다.
 *   R+0x130 은 `baserunnerAllowedOf` 가 옮겼다. 볼넷·사구 타자도 주자 목록에 들므로 **노히트노런(13번)도
 *   볼넷·사구 하나로 실패**다 — 원본 그대로.
 *
 * ⚠️ R+0x128(실점)은 P1 5-1 에 따르면 쓰는 곳이 없어 원본에선 늘 0 일 수 있다(유력) — 웹은 실점을 센다.
 */
function brokenConditionsOf(mission: OriginalMission, allowed: PitcherRun['allowed']): string[] {
  const limits = mission.failLimits
  const reached = (count: number, limit: number) => limit > 0 && count >= limit
  return [
    reached(allowed.runs, limits.runs) ? '무실점' : null,
    reached(allowed.hits, limits.hits) ? '무안타' : null,
    reached(allowed.walks, limits.walks) ? '무사사구' : null,
    reached(allowed.baserunner, limits.baserunners) ? '무출루' : null,
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
    /** 3아웃으로 비우기 **전**의 루 — 정산(0xa8024)이 보는 주자 목록은 이닝 정리보다 앞이다 */
    basesAfterPlay: advance.bases,
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
    // R+0x144 = 볼넷만 (사구는 R+0x148 — `brokenConditionsOf` 머리글)
    walks: run.allowed.walks + (outcome.kind === '볼넷' ? 1 : 0),
    // R+0x130 = 이번 플레이 하나의 값 (덮어쓴다)
    baserunner: baserunnerAllowedOf(run.bases, outcome, defense.basesAfterPlay, defense.runsScored) ? 1 : 0,
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

/**
 * R+0x130 "출루 허용" — 정산 0xa8024 안 0xa8c2e~0xa8c86 (R15 11-1 · P7 A1-1, 직접 다시 뜸).
 *
 * ```
 * a8c5c  for i in 0 .. 0xa9598(주자관리)−1:          ; 주자 목록 = [타자주자?, 1루, 2루, 3루 중 찬 루] 오름차순
 * a8c66    r3 = 0xa9564(관리, i)+0x96                ; 아웃 표시 (득점해도 0xa9520 이 같은 칸을 세운다)
 * a8c6a    r5 = 0 ; if r3 == 0 → r5 = 1             ; ⚠️ 루프 안에서 0 으로 되돌린다 → **마지막 원소 하나만** 본다
 * a8c86  0xa57f8(R, 0x17, r5)                       ; R+0x130 = (r5 != 0)
 * ```
 * 목록(I 3b-1): 투구 전 `0xa9a10` 이 찬 루를 **3 → 2 → 1 루 순서로 맨 앞에 끼워** `[1루, 2루, 3루]` 오름차순을 만들고,
 * 상태 0x17 진입 `0x46418` 이 타자주자를 `0xa93ac` 로 **맨 앞에** 하나 더 끼운다. 그 조건은 0x464a8~0x464cc:
 * `state[0x11] != 0 || 플레이 종류 ∈ {2, 3} || state[0x1a]`, 그리고 종류 ≠ 8. 볼넷(판정 3, 0x3e1ae)·사구(판정 4,
 * 0x3e1b4)는 **둘 다 종류 2**(0x3e1cc `movs r1,#2` → 0xb0cb8)라 타자주자가 목록에 든다. 삼진은 상태 0x17 을 안 거친다
 * (0xae24c 가 판정 5 를 바로 정산 0xa8024 로 보낸다, 0xae360) → 타자주자 없음.
 * 그래서 **마지막 원소 = 투구 때 맨 앞 주자(가장 높은 루), 주자가 없으면 타자주자**다.
 *
 * - 주자가 없었다: 마지막 = 타자주자. 살아서 루에 남았는가 = 플레이 뒤 루가 비지 않았는가
 *   (타자주자 말고는 루에 설 사람이 없다). 홈런·그라운드 홈런은 득점해 +0x96 이 서므로 0 이다(원본 그대로).
 * - 주자가 있었다: 마지막 = 그때의 맨 앞 주자. 그 주자가 살아 루에 남았는가.
 *   ⚠️ **근사**: 웹 진행기는 주자 하나하나의 운명(+0x95·+0x96)을 밖으로 내주지 않는다(`DefensePlayResult`).
 *   그래서 "득점이 없고, 플레이 뒤 가장 높은 찬 루가 그 주자의 출발 루 이상" 으로 본다 — 앞 주자가 잡히고
 *   뒤 주자가 그 루 이상까지 간 플레이는 잘못 1 이 된다. 이 한도(+0xa3)가 서 있는 13·14 번은 **빈 루로 시작**하고
 *   첫 출루가 곧 이 한도로 실패이므로, 주자가 있는 채로 이 갈래에 닿는 일은 진행 중인 미션에선 없다.
 */
export function baserunnerAllowedOf(
  basesBefore: BaseState,
  outcome: AtBatOutcome,
  basesAfterPlay: BaseState,
  runsScored: number,
): boolean {
  const leadBase = basesBefore.third ? 3 : basesBefore.second ? 2 : basesBefore.first ? 1 : 0
  if (leadBase === 0) {
    // 타자주자가 목록에 드는 플레이: 볼넷·사구(종류 2)·타구. 삼진은 목록이 빈 채로 정산된다.
    if (outcome.kind === '삼진') return false
    return runnerCountOf(basesAfterPlay) > 0
  }
  if (runsScored > 0) return false
  const highestAfter = basesAfterPlay.third ? 3 : basesAfterPlay.second ? 2 : basesAfterPlay.first ? 1 : 0
  return highestAfter >= leadBase
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
