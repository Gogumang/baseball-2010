import { runnersOfGame } from '@/entities/game/model/gameState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import type { BaseState, AdvanceResult } from '@/entities/game/model/baseState'
import { type RunnerPitcherSettlement, settleRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { baserunnerAllowedOfFates, chargedFromBasesOfFates, survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { addInningRuns, applyOpponentRunnerPlay, clearInningRuns, type OpponentAtBatResult } from '@/features/play-pitcher-game/model/pitcherGameState'
import { decisionAfterRunsOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { pitcherLinesChargedOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerSettlement'
import { MY_PITCHER_SLOT, OUTS_PER_INNING } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { isHalfInningChanged } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/halfInning'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord, recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/**
 * **주자만 움직인 판**(견제 종류 4 · 도루 종류 5 · 폭투·포일 종류 9)을 경기 상태에 먹인다 — 내가 던지는 타석이라
 * 수비는 나다. 타순 커서는 그대로(`applyOpponentRunnerPlay`), 재생 칸(`lastDefensePlay`)에 판을 넣는다.
 *
 * - 득점마다 0xa5c34 가 승·패·세이브 칸을 고친다(`applyRunScoredFor`) · 이닝 실점 · 팀 실점.
 * - `settles` — 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부르는가. 부르면 들어온 주자를 주자 운명으로 내 투수
 *   R+0x128 · +0x22 에 센다(`chargedRunsOfFates`). 견제(4)·도루(5)는 0xd·0xf 어느 쪽이든 0xae5a8 에서 부르고,
 *   폭투·포일(9)은 `state[0xc] == 5`(삼진) 일 때만 0xd 로 가며 부른다 — 아니면 ae5a2 → ae5b6 으로 **건너뛴다**.
 * - 반 이닝이 넘어갔으면 이닝 칸·삼자범퇴 표시·반 이닝 투구 수·볼카운트·타석 준비를 내린다 — 다음 타석은 `advance` 가 세운다.
 *
 * - 판에서 잡은 아웃은 아웃 콜 0xa7d0c 가 하나마다 센다(정산과 무관) — R+0x13c · 셋째 아웃이면 25 삼구 삼자범퇴 · R+0x154.
 *   정산 0xa8024 의 종류 4·5 갈래는 타석 칸(R+0x138 · R+0x134 · 타석 +0x14 …)을 건너뛰어 여기서 더 셀 것이 없다
 *   (삼진 + 도루 판의 삼진 타석은 `applyDefensivePlay` 의 `stealPlaySettlement`).
 * 주자 판 끝의 돌발 판정(0x8f414 — 0x17 끝 52a8e)은 판정이 없다: 결과비트 ctx+0x188 은 타석 초기화 0xa5bcc(a5be0)만 지우고
 * 0xa599c 는 종류 4·5 면 안 켜 이어지는 타석 안에서 늘 0 이다(8f41e 에서 돌아간다). 정산하는 폭투·포일 판(삼진 · 3아웃)은
 * 타석 · 반 이닝을 끝내는 판이라 타석 결과 쪽이 판정한다.
 * `settles` 가 거짓인 판은 state[0x8a](`teamRunsAllowed`) · R[3]/+0x20(`settledOutsExtra`)도 안 센다.
 */
export function withMyRunnerPlay(
  progress: PitcherGameProgress,
  result: DefensePlayResult,
  settles: boolean,
  /** 화면이 실시간으로 이미 보여 준 판 — 재생 칸에 다시 안 넣는다 */
  shownLive = false,
): { readonly progress: PitcherGameProgress; readonly changed: boolean } {
  const shown = withRunnerPlayShown(progress, result, settles, shownLive)
  if (!isRunnerPlayChanged(progress.game.bases, result.advance)) return { progress: shown, changed: false }
  const facts = runnerPlayFactsOf(progress, result, settles)
  const settled = withRunnerPlaySettlement(shown, progress, facts)
  return { progress: facts.halfChanged ? withRunnerPlayHalfClosed(settled, facts.applied.game.inning) : settled, changed: true }
}

/** 판이 아웃 · 득점을 냈거나 루를 바꿨는가 — 아니면 재생 칸만 갈아 끼운다 */
function isRunnerPlayChanged(bases: BaseState, advance: AdvanceResult): boolean {
  if (advance.outsAdded > 0 || advance.runsScored > 0) return true
  return advance.bases.first !== bases.first || advance.bases.second !== bases.second || advance.bases.third !== bases.third
}

function withRunnerPlayShown(progress: PitcherGameProgress, result: DefensePlayResult, settles: boolean, shownLive: boolean): PitcherGameProgress {
  return {
    ...progress,
    lastDefensePlay: shownLive ? progress.lastDefensePlay : result,
    defenseScene: result.scene,
    // state[0x88] — 정산 a8c5c 는 판 종류를 안 거른다: 정산하는 판이면 그 판 주자 목록의 마지막 원소가 안 끝났을 때 선다
    // (아무도 안 움직인 견제 판도 산 주자가 남아 선다 — 원본 그대로)
    teamBaserunnerAllowed: progress.teamBaserunnerAllowed || (settles && baserunnerAllowedOfFates(result.runnerFates)),
  }
}

interface RunnerPlayFacts {
  readonly applied: OpponentAtBatResult
  readonly settles: boolean
  readonly halfChanged: boolean
  readonly inningEnded: boolean
  readonly runnerSettlement: RunnerPitcherSettlement
  /** 내 투수 R+0x128 · +0x22 에 매길 실점 — 포스트시즌이면 0xa56dc 가 거짓이라 0 (`countsMyPitcherRecord`) */
  readonly chargedToMe: number
}

function runnerPlayFactsOf(progress: PitcherGameProgress, result: DefensePlayResult, settles: boolean): RunnerPlayFacts {
  const before = progress.game
  const advance = result.advance
  const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advance, { survivorsFromBase: survivorsFromBaseOfFates(result.runnerFates) })
  const halfChanged = isHalfInningChanged(before, applied.game)
  // 들어온 주자마다 그 주자를 내보낸 투수(주자+0x30)에게 — 정산을 지나는 판만(a8ea4). 루별 책임 투수 장부는 정산과 무관하게 판 뒤로 옮긴다
  const runnerSettlement = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersOfGame(before, progress.opponentOrderIndex),
    after: halfChanged ? EMPTY_BASE_RUNNERS : runnersOfGame(applied.game, applied.opponentOrderIndex),
    batter: null,
    pitcher: progress.ourMound.pitcherSlot,
    scoredFromBases: settles ? chargedFromBasesOfFates(result.runnerFates, before.outs + advance.outsAdded) : [],
  })
  return {
    applied,
    settles,
    halfChanged,
    inningEnded: before.outs + applied.outsAdded >= OUTS_PER_INNING,
    runnerSettlement,
    chargedToMe: countsMyPitcherRecord(progress) ? runnerSettlement.charged.filter((pitcher) => pitcher === MY_PITCHER_SLOT).length : 0,
  }
}

/**
 * 판에서 잡은 아웃(견제사 · 도루사 · 주루 아웃)은 콜 62/20 → 결과 13 → 아웃 콜 0xa7d0c 가 하나마다 센다 — 정산과 무관하다:
 * ```
 * a7d52  R+0x13c += 1 (코드 0x1a — 0xa57f8 게이트: 수비 지금 투수가 R 의 선수, `countsMyPitcherRecord`)
 * a7d78  ctx+0x16c(반 이닝 투구 수) == 3 && 아웃 == 3 → 25 삼구 삼자범퇴 (수비가 사람일 때 — 투수편은 늘)
 * a7d8e  아웃 == 3 && R+0x184(삼자범퇴 표시) → R+0x154 (코드 0x20 — 게이트 밖)
 * ```
 */
function withRunnerPlaySettlement(shown: PitcherGameProgress, progress: PitcherGameProgress, facts: RunnerPlayFacts): PitcherGameProgress {
  const { applied, settles, inningEnded, chargedToMe } = facts
  const threePitchInning = inningEnded ? threePitchInningRecordIdsOf(progress.halfInningPitches, OUTS_PER_INNING) : []
  return {
    ...shown,
    game: applied.game,
    decision: decisionAfterRunsOf(progress, applied.runsScored, true),
    inningRuns: addInningRuns(progress.inningRuns, progress.game.inning, applied.runsScored),
    runsAllowedByMe: progress.runsAllowedByMe + chargedToMe,
    runnerPitchers: facts.runnerSettlement.tags,
    // 동료가 내보낸 주자의 실점은 그 동료 줄에 (내 줄은 커리어가 센다)
    pitcherLines: pitcherLinesChargedOf(progress, facts.runnerSettlement.charged),
    record: {
      ...progress.record,
      runsAllowedField: progress.record.runsAllowedField + chargedToMe,
      outsRecorded: progress.record.outsRecorded + (countsMyPitcherRecord(progress) ? applied.outsAdded : 0),
      perfectInnings: progress.record.perfectInnings + (inningEnded && progress.perfectInningFlag ? 1 : 0),
    },
    // state[0x8a] — 정산 a8dd0 이 이 판 득점을 더한다. 정산을 건너뛰는 판은 안 센다
    teamRunsAllowed: progress.teamRunsAllowed + (settles ? applied.runsScored : 0),
    // R[3] · +0x20 은 정산이 센다 — 정산을 건너뛰는 판의 아웃은 아웃 콜(R+0x13c)에만 든다
    ...(settles || applied.outsAdded === 0 ? {} : { settledOutsExtra: (progress.settledOutsExtra ?? 0) - applied.outsAdded }),
    ...(threePitchInning.length > 0 && recordsAllowed(progress) ? { recordIds: [...progress.recordIds, ...threePitchInning] } : {}),
  }
}

/** 판에서 반 이닝이 넘어갔다 — 이닝 칸 · 삼자범퇴 표시 · 반 이닝 투구 수 · 볼카운트 · 타석 준비를 내린다 */
function withRunnerPlayHalfClosed(progress: PitcherGameProgress, inning: number): PitcherGameProgress {
  return {
    ...progress,
    inningRuns: clearInningRuns(progress.inningRuns, inning),
    perfectInningFlag: true,
    halfInningPitches: 0,
    atBat: createAtBat(),
    atBatPitches: 0,
    atBatPrepared: false,
    endedInningIndex: inning - 1,
  }
}
