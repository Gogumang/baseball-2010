import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { withOutCalls } from '@/entities/mission/model/missionGoal'
import { cpuSideOf, withMissionScore } from '@/entities/mission/model/missionGame'
import { missionRunnersAfterPlay } from '@/entities/mission/model/missionRunners'
import { applyPitcherOutcome, withHalfEnd, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { baserunnerAllowedOfFates, chargedRunsOfFates, survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { arrivalPlaySettles } from '@/features/defense-play/model/settlementEvents'
import { MISSION_OUTS_PER_INNING } from '@/app/model/missionSession/constants/missionConstants'
import { judgedAfterRunnerPlay, outCallsOf } from '@/app/model/missionSession/runnerPlay/pitcherRunnerJudge'

/** 판의 아웃 · 루 · 신원 · 점수 칸 — 3아웃이면 다음 이닝(빈 루 · 0아웃)으로, 득점은 점수판 CPU 측 (견제 · 도루 · 폭투 · 낫아웃 판이 같다) */
function movedByRunnerPlay(run: PitcherRun, result: DefensePlayResult) {
  const advance = result.advance
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= MISSION_OUTS_PER_INNING
  return {
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    // 판의 살아남은 주자로 CPU 타선 신원을 민다 (주자만 움직인 판 — 타순은 그대로)
    runners: missionRunnersAfterPlay(
      run,
      { bases: advance.bases, inningOver: isInningOver },
      {
        batterReached: false,
        runsScored: advance.runsScored,
        survivorsFromBase: survivorsFromBaseOfFates(result.runnerFates),
      },
    ),
    outs: isInningOver ? 0 : outs,
    totalOuts: run.totalOuts + advance.outsAdded,
    // 판의 득점도 점수판 득점 0xa5c34 — CPU 측. 3아웃이면 0x18 · 자동진행을 기다린다
    game: withHalfEnd(withMissionScore(run.game, cpuSideOf(run.mission), advance.runsScored), isInningOver),
  }
}

/** 판정에 넘기는 아웃 — 판은 셋째 아웃에서 끝난다 */
const judgedOutsOf = (run: PitcherRun, result: DefensePlayResult) => Math.min(MISSION_OUTS_PER_INNING, run.outs + result.advance.outsAdded)

/**
 * 주자만 움직인 판 하나(견제 종류 4 · 도루 5 · 폭투·포일 9)의 결과를 투수 미션에 먹인다.
 * `settles` — 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부르는가 (견제·도루는 늘, 폭투·포일은 삼진이 선 판만).
 */
export function withPitcherMissionRunnerResult(run: PitcherRun, result: DefensePlayResult, settles: boolean): PitcherRun {
  if (run.status !== '진행중') return run
  const outs = judgedOutsOf(run, result)
  const charged = settles ? chargedRunsOfFates(result.runnerFates, outs) : 0
  return judgedAfterRunnerPlay(
    {
      ...run,
      progress: withOutCalls(run.progress, outCallsOf(run, result.advance.outsAdded)),
      ...movedByRunnerPlay(run, result),
      allowed: {
        ...run.allowed,
        runs: run.allowed.runs + charged,
        // R+0x130 — 정산하는 판이면 그 판 주자 목록 마지막 원소로 덮어쓴다 (a8c5c~a8c86)
        ...(settles ? { baserunner: baserunnerAllowedOfFates(result.runnerFates) ? 1 : 0 } : {}),
      },
    },
    outs,
  )
}

/**
 * **투수 미션의 주자 판**(종류 5 도루 · 9 폭투·포일)을 먹인다 — 3아웃이면 다음 이닝(빈 루 · 0아웃, `advanceDefense` 와 같다).
 * 잡은 아웃은 이닝 목표(`totalOuts`)에 든다.
 * - 실점 R+0x128: 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부를 때만 주자 운명으로 센다 — 도루(5)는 늘, 폭투·포일(9)은
 *   삼진이 그대로 선 판만(ae596 → ae5a6). 아니면 정산을 건너뛰어(ae5a2 → ae5b6) 실점 칸에 안 든다.
 * - 판정 0xaaa6c 는 판 끝(0xae5c4, 모드 5·6)에서 돈다 — 정산을 건너뛴 폭투·포일 판(ae5a2 → ae5b6)도 판정은 돈다.
 *   웹 판정(`pitcherRun.judgeStatus`)은 미션 엔티티 안에 있어 여기서는 `judgedAfterRunnerPlay` 가 같은 순서로 본다.
 * - 주자 판에서 잡은 아웃(견제사·도루사·진루 중 아웃)은 '아웃' 목표에도 든다 — `outCallsOf` 머리글.
 * - R+0x130(출루 허용): 정산 a8c80 `0xa57f8(R, 0x17, r5)` 은 판 종류를 안 거른다(직접 떴다 — a8c2e~a8c86 사이에 state[0x26] 읽기
 *   없음) → 정산하는 주자 판(견제 · 도루 · 삼진 선 폭투)도 그 판 주자 목록 마지막 원소로 **덮어쓴다**. 정산을 건너뛰는 판은 그대로.
 * - 견제 정산은 같은 투구 틈 앞 판의 사건까지 세지만 미션이 보는 칸(R+0x128 · R+0x130 · R+0x13c)은 사건 목록을 안 쓴다 —
 *   R+0x128 · R+0x130 은 주자 목록, R+0x13c 는 아웃 콜이다.
 */
export function withPitcherMissionRunnerPlay(run: PitcherRun, play: PitchArrivalPlay): PitcherRun {
  const halfOrGameEnded = run.outs + play.result.advance.outsAdded >= MISSION_OUTS_PER_INNING
  return withPitcherMissionRunnerResult(run, play.result, arrivalPlaySettles(play, { halfOrGameEnded }))
}

/**
 * **투수 미션 낫아웃** — 삼진 타석은 보통 길(`applyPitcherOutcome`: 삼진 목표·타석 수)로 세고, 루·아웃·이닝 아웃·
 * 실점은 폭투·포일 판의 결과(타자주자 포함)로 바꾼다. 판정 B 가 state[0xc] == 5 라 정산 0xa8024 를 부른다(ae5a6).
 *
 * '아웃' 칸(R+0x13c)은 원본대로 고친다 (직접 재역어셈): 낫아웃 갈래 0x3e09e~0x3e0e0 이 삼진 0xa7c4c 를 불러 +1(a7cc4)
 * 하고 state[0x1a] = 1 을 세운다 → 판에서 잡은 아웃(타자주자 1루 아웃 등)은 아웃 콜 0xa7d0c 마다 +1(a7d52) →
 * 정산 0xa8ce8 이 `0xb6c3c`(state[0x1a]) 면 a8cfc `0xa57f8(R, 0x1a, −1)`. 그래서 판정이 보는 값은 "판의 아웃 수" 다
 * (타자주자가 살면 0). 판정 0xaaa6c 는 정산 **뒤**(ae5c4)에 한 번 돌므로, 보통 길이 삼진 +1 로 미리 낸 판정은
 * 버리고 고친 칸으로 다시 잰다 — 실점 한도(`judgedAfterRunnerPlay`) → 실패 한도·목표·남은 기회(`judgePitcherRun`).
 * 이닝 목표 표시 칸(노히트노런·퍼펙트게임)도 같은 수로 고친다(`withOutCalls`).
 */
export function withPitcherNotOut(run: PitcherRun, outcome: AtBatOutcome, play: PitchArrivalPlay): PitcherRun {
  if (run.status !== '진행중') return run
  const struck = applyPitcherOutcome(run, outcome)
  const outs = judgedOutsOf(run, play.result)
  const charged = chargedRunsOfFates(play.result.runnerFates, outs)
  // 삼진 0xa7c4c +1 을 낫아웃 보정 −1 로 빼고, 판의 아웃 콜 수를 더한다
  const struckOuts = (struck.progress.counts['아웃'] ?? 0) - (run.progress.counts['아웃'] ?? 0)
  const moved: PitcherRun = {
    ...struck,
    status: '진행중',
    progress: withOutCalls(struck.progress, outCallsOf(run, play.result.advance.outsAdded) - struckOuts),
    // 낫아웃 판의 살아남은 주자(타자주자 0 포함)로 신원을 민다 — 지금 타자 칸은 판 앞 타순
    ...movedByRunnerPlay(run, play.result),
    allowed: { ...struck.allowed, runs: run.allowed.runs + charged },
  }
  return judgedAfterRunnerPlay(moved, outs)
}
