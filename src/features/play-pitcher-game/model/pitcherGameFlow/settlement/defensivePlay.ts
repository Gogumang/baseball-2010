import type { BaseRunners } from '@/entities/game/model/baseRunners'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { type AtBatOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { type AdvanceResult, advanceRunners } from '@/entities/game/model/baseState'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { addInningRuns, applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import type { PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import { resolveBurstFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstResult'
import { closeDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/closeDefensivePlay'
import {
  opponentLineupAfterPlayOf,
  pitcherRecordAfterPlay,
  playedRecordOf,
  playRecordIdsOf,
  teamBaserunnerAllowedAfterPlayOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayRecords'
import { withLeaguePlateAppearance } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { applyRunScoredFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { pitcherLinesChargedOf, runnerSettlementOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerSettlement'
import { MY_PITCHER_SLOT, OUTS_PER_INNING } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord, recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/* ── 수비 타석 하나 ───────────────────────────────────────────────────────────── */

/**
 * 상대 타석 하나를 경기에 반영한다.
 * `mine` 이 참이면 내가 던진 타석이라 투수 기록·돌발 판정까지 함께 한다.
 *
 * `balls` 는 타석이 끝났을 때의 볼 카운트 (풀카운트 삼진 17 판정).
 * `progress.atBatPitches`·`progress.halfInningPitches` 는 부르는 쪽이 이미 올려 두었다.
 *
 * ⚠️ 난수를 받지 않는다 — 수비 시뮬레이션 굴림은 부르는 쪽이 이미 다 돌린 뒤라 여기서는
 * 그 결과를 먹이기만 한다.
 */
export function applyDefensivePlay(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  balls: number,
  /**
   * **이미 돌린** 수비 시뮬레이션 결과 (`features/defense-play`).
   *
   * 내가 던진 타석의 인플레이 타구만 갖는다 — 투수편도 원본에서는 사람 경기(0xae24c·0xae3e8)라
   * 간이 엔진이 아니라 수비 AI 가 돈다. 그래서 `baseState` 의 두 근사("희생플라이 보장"·
   * "고정 진루표")가 여기서는 쓰이지 않고, 태그업(0xa9620) → 자동 추가 진루(0xaf918, 송구보다
   * 2틱 넘게 빠를 때만) → 2아웃 득점 보류 순서가 그대로 돈다 (P2 7절 · E-defense-rules).
   *
   * 내가 마운드에 없는 타석(구원 대기·강판 뒤)은 원본도 간이 엔진(0xc262c)이라 null 이다.
   */
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
  /**
   * 간이 엔진 타석(`playQuickPlateAppearance`)이 먹인 주자 — 볼넷 모든 주자 +1(c1918) · 도루(c1982) · 땅볼 진루(0xc15b8)까지.
   * 있으면 이 타석은 간이 엔진 타석이다(결과 링 아웃 = 5).
   */
  quickAdvance?: AdvanceResult,
  /** 간이 엔진 타석이 민 주자 신원(상대 타순 칸) — `quickAdvance` 와 함께 */
  quickRunners?: BaseRunners,
  /**
   * **삼진 + 도루 판(종류 5)** 의 정산 — 판정 B 0xae3e8 이 state[0xc] == 5 && 종류 5 면 0xd 로 가며 0xa8024 를 종류 5 로 한 번
   * 부른다(ae586 · ae5a8). 삼진 콜 0xa7c4c(R+0x13c +1 · 16/17 · 0xb8cec R[0]·R[1])는 공 도착 0x3dfac 가 이미 했고, 정산 안에서
   * state[0x26] ∈ {4, 5} 가 막는 칸은 건너뛴다:
   * ```
   * a8856  상대 타자 리그 기록(+0x20 타수 …)          — 건너뜀
   * a8a04  아웃 코드 · 결과 링                      — 건너뜀
   * a8ac8  코드 7 · 타순 칸 타석 +0x14              — 건너뜀
   * a8d38  R+0x134 탈삼진(코드 0x18, R+0x14c 콤보) · 0xa7998(18~23) — 건너뜀
   * a8d98  R+0x138 타자 수(코드 0x19)                — 건너뜀
   * a8fb6  0xb8cec R[1] 끊기 · 결과비트 0x200       — 건너뜀
   * a8cb0  투수 레코드 +0x20(아웃) · a8d00 +0x26(삼진) — 판 종류를 안 본다 (`stealPlayStrikeouts`)
   * ```
   */
  stealPlaySettlement = false,
  /**
   * 이 삼진과 한 정산인 주자 판(도루 종류 5 · 삼진 그대로인 폭투·포일 종류 9)의 결과 — 판의 진루는 `applyPitcherArrival` 가 먼저
   * 먹였다. 정산 [sp+0x30] 에 그 판의 아웃 사건이 들고(a8e58 26/27), 필살송구 표시 state[0x8b] 도 그 판의 것이다(a80f8)
   */
  settledRunnerPlay?: DefensePlayResult,
): PitcherGameProgress {
  const before = progress.game
  const advanceResult =
    defensePlay?.advance ??
    quickAdvance ??
    // 간이 엔진이 돌린 타석 — **원본 간이 엔진에는 희생플라이가 없다** (E-2 확정)
    advanceRunners(before.bases, outcome, before.outs, { quickEngine: true })
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    advanceResult,
    defensePlay !== null
      ? { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) }
      : quickRunners === undefined
        ? undefined
        : { runners: quickRunners },
  )
  const slot = progress.opponentOrderIndex
  // 정산 홈런 수 [sp+0x24] > 0 — 장내 홈런 state[0x25] 는 a84d6 이 타자 게이트 [sp+0x34] = 0xa56dc(ctx, 지금 타자, 0)
  // (모드 3 갈래 0xa571c: 포스트시즌 · 국가대항전 아님 && 마선수 아님)가 참일 때만 더한다. 거짓이면 루타 4 안타로만 적혀
  // 홈런 갈래(B0)와 a8728 의 타순 칸 홈런 +0x13 을 건너뛴다. 담장 사건 8 은 게이트 없이 센다
  const batterGate = countsMyPitcherRecord(progress) && rosterSlotAt(progress.opponentLineup, slot) !== ACE_BATTER_ROSTER_SLOT
  const homeRunCounted = outcome.kind === '홈런' && !(defensePlay?.groundHomeRun === true && !batterGate)
  const hit = isHit(outcome)
  const walk = outcome.kind === '볼넷'
  // 출루 허용 state[0x88]·투수 +0x2a·삼자범퇴 칸 ctx+0x184 는 볼넷·사구를 함께 본다
  // (0xa8caa — 사구 플레이는 아웃이 없어 마지막 주자가 늘 살아 있다 · 0xa8e12/0xa8e36)
  const freePass = isFreePass(outcome)
  const hitByPitch = outcome.kind === '사구'
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING
  // **낫아웃(state[0x1a])** — 공 도착 0x3dfac 의 종류 9 갈래 0x3e09e~0x3e0e0 이 삼진 콜 0xa7c4c(사건 5 · R+0x13c +1 · R[0]·R[1])를
  // 부르고 state[0x1a] = 1 을 세운 뒤 타자주자를 끼운 판(0x46418)을 돈다. 판 운명을 진루로 먹이는 삼진은 이 갈래뿐이다
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null

  let decision = progress.decision
  for (let run = 1; run <= applied.runsScored; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, mine)
  }

  // R+0x184 — 안타·볼넷·사구가 나면 이 이닝은 더 이상 삼자범퇴가 아니다 (0xa80b4·0xa8e12)
  const perfectInningFlag = progress.perfectInningFlag && !hit && !freePass && applied.runsScored === 0

  const runnerSettlement = runnerSettlementOf(progress, before, applied, outcome, mine, defensePlay)
  const chargedToMe = runnerSettlement.charged.filter((pitcher: number) => pitcher === MY_PITCHER_SLOT).length

  const counts = countsMyPitcherRecord(progress)
  const playedRecord = playedRecordOf(progress, {
    mine,
    counts,
    hit,
    walk,
    outcome,
    outsAdded: applied.outsAdded,
    inningEnded,
    perfectInningFlag,
    stealPlaySettlement,
  })
  const chargedCounted = counts ? chargedToMe : 0
  const record: PitcherEvaluationRecord =
    chargedCounted > 0 ? { ...playedRecord, runsAllowedField: playedRecord.runsAllowedField + chargedCounted } : playedRecord

  // 0xb8cec — 지금 마운드에 선 우리 투수의 경기 기록 R[0](삼진)·R[1](연속 삼진).
  // 삼진 아닌 결과로 끝난 타석마다 콤보가 끊긴다 (R8 5-5).
  const strikeout = outcome.kind === '삼진'
  const moundStrikeouts = progress.moundStrikeouts + (strikeout ? 1 : 0)
  // 삼진 콜 0xa7c4c 가 올린 R[1] — 18~23 판정 0xa7998(a8d5a)은 이 값을 본다
  const strikeoutComboAtCall = strikeout ? progress.moundStrikeoutCombo + 1 : 0
  // 정산 끝 a8fb2~a8ff8 이 `!([sp+0x20] > 0 && !state[0x1a])` 면 R[1] = 0 — 낫아웃 삼진도 판정 뒤 콤보를 끊는다(종류 4·5 는 건너뜀)
  const moundStrikeoutCombo = droppedThirdStrike ? 0 : strikeoutComboAtCall

  // 36 필살송구 아웃 — 정산 0xa8024(a80f8~a8116)은 모드를 안 가리고, 게이트 0xa77f0 은 수비 팀이 사람이면 36 을 들인다.
  // 표시 state[0x8b] 는 수비 화면 결과 판 0x46844 가 레이저 연출 뒤 코드 13 결과 판에서 세운다(`DefensePlayResult.laserOutFlag`)
  // 이 정산의 아웃 [sp+0x30] — 삼진 사건 5 와 함께 선 주자 판의 아웃 사건 0xd 까지
  // 낫아웃 판은 삼진 콜이 넣은 사건 5 가 판의 아웃 사건 앞에 하나 더 든다(판의 아웃은 아웃 콜 0xa7d0c 의 0xd)
  const settledOuts = applied.outsAdded + (settledRunnerPlay?.advance.outsAdded ?? 0) + (droppedThirdStrike ? 1 : 0)
  const laserPlay = defensePlay ?? settledRunnerPlay
  const newRecordIds = playRecordIdsOf(progress, {
    strikeout,
    stealPlaySettlement,
    balls,
    strikeoutComboAtCall,
    moundStrikeouts,
    laserPlay,
    settledOuts,
    droppedThirdStrike,
    inningEnded,
    outsAfterPlay: before.outs + applied.outsAdded,
  })

  const next: PitcherGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    decision,
    moundStrikeouts,
    moundStrikeoutCombo,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    defenseScene: defensePlay?.scene ?? progress.defenseScene,
    atBatPitches: 0,
    recordIds: recordsAllowed(progress) ? [...progress.recordIds, ...newRecordIds] : progress.recordIds,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    record,
    // 종류 5 정산은 a8d98 이 R+0x138(타자 수)을 건너뛴다 — 사구는 종류 5 와 겹치지 않는다(밀어내기 종류 2 로 덮인다)
    pitcherRecord: mine && counts && !stealPlaySettlement ? pitcherRecordAfterPlay(progress.pitcherRecord, hitByPitch) : progress.pitcherRecord,
    // 시즌 탈삼진 +0x26 — 판 종류를 안 보는 a8d00 몫 (`stealPlayStrikeouts`)
    ...(stealPlaySettlement && strikeout && mine && counts ? { stealPlayStrikeouts: (progress.stealPlayStrikeouts ?? 0) + 1 } : {}),
    runsAllowedByMe: progress.runsAllowedByMe + chargedCounted,
    runnerPitchers: runnerSettlement.tags,
    // 동료 투수가 내보낸 주자의 실점은 그 동료 줄(+0x22)에 — 내 줄(`MY_PITCHER_SLOT`)은 커리어가 센다
    pitcherLines: pitcherLinesChargedOf(progress, runnerSettlement.charged),
    // 낫아웃 — a8cb0 +0x20 += [sp+0x30](삼진 사건 포함), 보정 −1 은 R+0x13c · R[3] 에만 (`seasonOutsExtra`)
    ...(droppedThirdStrike && mine && counts ? { seasonOutsExtra: (progress.seasonOutsExtra ?? 0) + 1 } : {}),
    // 레코드 +0x2a — 게이트 없이 마운드의 내 투수에게 (a8b58 · a8bd2)
    freePassesByMe: progress.freePassesByMe + (mine && freePass ? 1 : 0),
    teamHitsAllowed: progress.teamHitsAllowed + (hit ? 1 : 0),
    // state[0x88] — 이 정산의 주자 목록 마지막 원소가 안 끝났으면 (a8c5c). 삼진과 한 정산인 주자 판은 그 판의 목록이다
    teamBaserunnerAllowed: teamBaserunnerAllowedAfterPlayOf(progress, before, outcome, mine, defensePlay, quickAdvance, settledRunnerPlay),
    teamRunsAllowed: progress.teamRunsAllowed + applied.runsScored,
    perfectInningFlag,
    ...opponentLineupAfterPlayOf(progress, slot, outcome, { stealPlaySettlement, quickAdvance, homeRunCounted, hit }),
    atBat: createAtBat(),
    atBatPrepared: false,
    endedInningIndex: applied.game.inning - 1,
    // 정산 0xa8024 — 0xa56dc(ctx, 지금 타자, 0) 이면 상대 타자 레코드 +0x20~+0x2a (마타자 칸은 거짓)
    // 종류 5 정산은 a8856 이 상대 타자 리그 기록(+0x20 타수 …)을 건너뛴다
    ...(stealPlaySettlement ? {} : withLeaguePlateAppearance(progress, false, slot, outcome, applied.runsScored)),
  }

  // 0x8f414 는 사람 장면의 타석 끝(0x12 갱신 0x4e6d4 · 0x17 끝 0x528b0)에서만 돈다 — 내가 던진 타석만.
  // 내가 마운드에 없는 타석은 간이 엔진(0x21)이라 판정이 없다 (`triggerBurstAtPrep` 머리말)
  // 삼진 + 도루 판은 판정 A(0xae24c)가 state[0xb] 3·4 라 정산 없이 0x17 로 보내고, 0x17 끝 정산은 종류 5 라 결과비트를 안 켠다
  // (0xa599c a59a8) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 0x8f414 가 비트 0 으로 돌아 판정이 없고 돌발은 남는다(8f41e)
  const resolved =
    mine && !stealPlaySettlement
      ? resolveBurstFor(
          next,
          outcome,
          applied.runsScored,
          before.outs,
          // 결과비트 B8 · B10 · B5 가 보는 [sp+0x30] — 낫아웃은 삼진 사건이 하나 더 든다
          settledOuts,
          defensePlay,
          homeRunCounted,
          droppedThirdStrike,
        )
      : next
  return closeDefensivePlay(resolved, before, applied, slot, outcome, mine)
}
