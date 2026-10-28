import { runnersOfGame } from '@/entities/game/model/gameState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { chargedRunsByPitcher, settleRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { baserunnerAllowedOfFates, chargedFromBasesOfFates, survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { addInningRuns, applyOpponentRunnerPlay, clearInningRuns } from '@/features/play-pitcher-game/model/pitcherGameState'
import { chargeCpuPitcherLine } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import { applyRunScoredFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { MY_PITCHER_SLOT, OUTS_PER_INNING } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord, recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

export function withMyRunnerPlay(
  progress: PitcherGameProgress,
  result: DefensePlayResult,
  settles: boolean,
  /** 화면이 실시간으로 이미 보여 준 판 — 재생 칸에 다시 안 넣는다 */
  shownLive = false,
): { readonly progress: PitcherGameProgress; readonly changed: boolean } {
  const before = progress.game
  const bases = before.bases
  const advanceResult = result.advance
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== bases.first ||
    advanceResult.bases.second !== bases.second ||
    advanceResult.bases.third !== bases.third
  let next: PitcherGameProgress = {
    ...progress,
    lastDefensePlay: shownLive ? progress.lastDefensePlay : result,
    defenseScene: result.scene,
    // state[0x88] — 정산 a8c5c 는 판 종류를 안 거른다: 정산하는 판이면 그 판 주자 목록의 마지막 원소가 안 끝났을 때 선다
    // (아무도 안 움직인 견제 판도 산 주자가 남아 선다 — 원본 그대로)
    teamBaserunnerAllowed: progress.teamBaserunnerAllowed || (settles && baserunnerAllowedOfFates(result.runnerFates)),
  }
  if (!changed) return { progress: next, changed }
  const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult, {
    survivorsFromBase: survivorsFromBaseOfFates(result.runnerFates),
  })
  let decision = progress.decision
  for (let run = 1; run <= applied.runsScored; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, true)
  }
  const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
  // 들어온 주자마다 그 주자를 내보낸 투수(주자+0x30)에게 — 정산을 지나는 판만(a8ea4). 포스트시즌이면 0xa56dc 가 거짓이라
  // R+0x128 · +0x22 를 안 센다 (`countsMyPitcherRecord`). 루별 책임 투수 장부는 정산과 무관하게 판 뒤로 옮긴다
  const runnersAtPitch = runnersOfGame(before, progress.opponentOrderIndex)
  const runnerSettlement = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersAtPitch,
    after: halfChanged ? EMPTY_BASE_RUNNERS : runnersOfGame(applied.game, applied.opponentOrderIndex),
    batter: null,
    pitcher: progress.ourMound.pitcherSlot,
    scoredFromBases: settles ? chargedFromBasesOfFates(result.runnerFates, before.outs + advanceResult.outsAdded) : [],
  })
  const charged = countsMyPitcherRecord(progress) ? runnerSettlement.charged.filter((pitcher) => pitcher === MY_PITCHER_SLOT).length : 0
  // 판에서 잡은 아웃(견제사 · 도루사 · 주루 아웃)은 콜 62/20 → 결과 13 → 아웃 콜 0xa7d0c 가 하나마다 센다 — 정산과 무관하다:
  //   a7d52  R+0x13c += 1 (코드 0x1a — 0xa57f8 게이트: 수비 지금 투수가 R 의 선수, `countsMyPitcherRecord`)
  //   a7d78  ctx+0x16c(반 이닝 투구 수) == 3 && 아웃 == 3 → 25 삼구 삼자범퇴 (수비가 사람일 때 — 투수편은 늘)
  //   a7d8e  아웃 == 3 && R+0x184(삼자범퇴 표시) → R+0x154 (코드 0x20 — 게이트 밖)
  const counted = countsMyPitcherRecord(progress)
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING
  const threePitchInning = inningEnded ? threePitchInningRecordIdsOf(progress.halfInningPitches, OUTS_PER_INNING) : []
  next = {
    ...next,
    game: applied.game,
    decision,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    runsAllowedByMe: progress.runsAllowedByMe + charged,
    runnerPitchers: runnerSettlement.tags,
    // 동료가 내보낸 주자의 실점은 그 동료 줄에 (내 줄은 커리어가 센다)
    pitcherLines: chargedRunsByPitcher(runnerSettlement.charged).reduce(
      (lines, [pitcherSlot, runsAllowed]) => chargeCpuPitcherLine(lines, progress.options.ourTeamId, pitcherSlot, { runsAllowed }),
      progress.pitcherLines,
    ),
    record: {
      ...progress.record,
      runsAllowedField: progress.record.runsAllowedField + charged,
      outsRecorded: progress.record.outsRecorded + (counted ? applied.outsAdded : 0),
      perfectInnings: progress.record.perfectInnings + (inningEnded && progress.perfectInningFlag ? 1 : 0),
    },
    // state[0x8a] — 정산 a8dd0 이 이 판 득점을 더한다. 정산을 건너뛰는 판은 안 센다
    teamRunsAllowed: progress.teamRunsAllowed + (settles ? applied.runsScored : 0),
    // R[3] · +0x20 은 정산이 센다 — 정산을 건너뛰는 판의 아웃은 아웃 콜(R+0x13c)에만 든다
    ...(settles || applied.outsAdded === 0 ? {} : { settledOutsExtra: (progress.settledOutsExtra ?? 0) - applied.outsAdded }),
    ...(threePitchInning.length > 0 && recordsAllowed(progress) ? { recordIds: [...progress.recordIds, ...threePitchInning] } : {}),
  }
  if (halfChanged) {
    next = {
      ...next,
      inningRuns: clearInningRuns(next.inningRuns, applied.game.inning),
      perfectInningFlag: true,
      halfInningPitches: 0,
      atBat: createAtBat(),
      atBatPitches: 0,
      atBatPrepared: false,
      endedInningIndex: applied.game.inning - 1,
    }
  }
  return { progress: next, changed }
}
