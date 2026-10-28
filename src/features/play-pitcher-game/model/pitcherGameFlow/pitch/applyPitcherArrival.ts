import { isBugFixed } from '@/shared/config/bugfixes'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import { laserThrowOutRecordOf, passesRecordTeamGate, strikeoutCallRecordIdsOf } from '@/entities/game/model/gameRecords'
import { arrivalPlaySettles, pendingSettlementEventsAfter, settlementEventsOfPlay } from '@/features/defense-play/model/settlementEvents'
import { arrivalApplicationOf, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { PitcherPitchArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchArrivalTypes'
import { withoutSteal } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/stealDisplay'
import { withLeagueSteals } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { withMyRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/myRunnerPlay'
import { withMyRunnerPlaySettlement } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerPlaySettlement'
import { withMyWildPitchSettlement } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/wildPitchSettlement'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import { isHalfInningOrGameEnded } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/halfInning'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/** 종류 9 — 폭투·포일 판 · 종류 5 — 도루 판 · 종류 2 — 밀어내기 판 (`PitchArrivalPlay.kind`) */
const WILD_PITCH_PLAY_KIND = 9
const STEAL_PLAY_KIND = 5
const FORCED_ADVANCE_PLAY_KIND = 2

/**
 * 도루 판(종류 5) 정산의 리그 기록 — 0xa8024 0xa8340~0xa83c0 (R8 5-2): 잡힌 도루 주자가 하나라도 있으면 아무도 안 쌓고, 게이트
 * sp+0x34 = 0xa56dc(ctx, **지금 타자**, 0)(a8070), 루를 옮긴 도루 주자 r 마다 마선수가 아니면 +0x2c. 주자는 판 앞 루의 신원(`GameState.runners`)이다.
 * ⚠️ 원본 버그(B-61): 게이트가 지금 타자를 봐서 마타자 타석에 한 도루는 아무도 안 쌓인다.
 * 고침(bugfixes.json B-61, 기본 켬): 지금 타자 게이트를 건너뛰고 주자마다의 마선수 거르기만 본다. 굴림 없음.
 */
export function withStealPlayLeagueSteals(next: PitcherGameProgress, before: PitcherGameProgress, play: PitchArrivalPlay): PitcherGameProgress {
  if (play.kind !== STEAL_PLAY_KIND || play.result.caughtFrom.length > 0 || play.result.stolenFrom.length === 0) return next
  if (!isBugFixed('B-61') && rosterSlotAt(before.opponentLineup, before.opponentOrderIndex) === ACE_BATTER_ROSTER_SLOT) return next
  const runners = runnersOfGame(before.game, before.opponentOrderIndex)
  const stolen = play.result.stolenFrom.map((from) => runnerOnBase(runners, from as 1 | 2 | 3)).filter((runner): runner is number => runner !== null)
  return withLeagueSteals(next, false, stolen)
}

/** 다 돈 공 도착 판을 경기에 먹인다 — `arrivePitcherPitch` 의 뒷부분. 실시간으로 보여 준 판(`shownLive`)은 재생 칸에 다시 안 넣는다 */
export function applyPitcherArrival(progress: PitcherGameProgress, play: PitchArrivalPlay): PitcherPitchArrival {
  const before = progress.game
  const opened: PitcherGameProgress = { ...withoutSteal(progress), lastArrivalPlay: play, defenseScene: play.result.scene }
  // 낫아웃 · 볼넷 · 사구는 타석 결과 쪽(`startPitch`)이 먹인다 — 밀어내기 판(종류 2)은 재생 칸에만
  if (arrivalApplicationOf(play) !== 'runnerOnly') return { progress: opened, play, interrupted: false }
  const moved = withArrivalRunnerPlay(opened, play)
  const settled = withArrivalSettlement(moved.progress, progress, play, moved.settles)
  const recorded = withArrivalRecordIds(settled, progress, play)
  const next = appendLog(recorded, `${before.inning}회${before.half} ${describeArrivalPlay(play)}`, true)
  return { progress: next, play, interrupted: isHalfInningOrGameEnded(before, next.game) }
}

/** 판의 진루 — 판정 B 가 정산을 부르는가: 도루는 늘, 폭투·포일은 삼진이 섰거나 반 이닝 · 경기가 끝난 판만 (`arrivalPlaySettles`) */
function withArrivalRunnerPlay(opened: PitcherGameProgress, play: PitchArrivalPlay): { readonly progress: PitcherGameProgress; readonly settles: boolean } {
  const shownLive = play.shownLive === true
  const settledApply = withMyRunnerPlay(opened, play.result, true, shownLive).progress
  const settles = arrivalPlaySettles(play, { halfOrGameEnded: isHalfInningOrGameEnded(opened.game, settledApply.game) })
  if (settles) return { progress: settledApply, settles }
  return { progress: withMyRunnerPlay(opened, play.result, false, shownLive).progress, settles }
}

/** 판 정산 0xa8024 의 판 종류별 칸 · 다음 견제 정산이 함께 셀 사건 목록 */
function withArrivalSettlement(moved: PitcherGameProgress, progress: PitcherGameProgress, play: PitchArrivalPlay, settles: boolean): PitcherGameProgress {
  const events = settlementEventsOfPlay(play.result)
  let next = withStealPlayLeagueSteals(moved, progress, play)
  // 삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9) — 거르기가 없는 정산이라 상대 타석 칸 · 결과 링 · 타자 수까지 오른다.
  // 거르지 않는 칸(36 · 26/27)은 도루 판과 같은 자리다
  if (play.kind === WILD_PITCH_PLAY_KIND && settles && progress.atBat.outcome === null) {
    next = withMyWildPitchSettlement(withMyRunnerPlaySettlement(next, play.result, events), progress, play.result)
  }
  // 삼진 없는 도루 판(종류 5)의 정산 — 거르지 않는 칸 (`withMyRunnerPlaySettlement`). 삼진과 한 정산이면 타석 결과 쪽이 센다
  if (play.kind === STEAL_PLAY_KIND && progress.atBat.outcome?.kind !== '삼진') {
    next = withMyRunnerPlaySettlement(next, play.result, events)
  }
  // 같은 타석이 이어지면 이 판의 사건이 목록에 남아 다음 견제 정산이 함께 센다 — 다음 공의 0xa5e14 가 비운다
  const continues = progress.atBat.outcome === null && !isHalfInningOrGameEnded(progress.game, next.game)
  return { ...next, pendingSettlementEvents: pendingSettlementEventsAfter(undefined, events, continues) }
}

/**
 * 판이 들이는 기록달성 번호. 삼진 + 도루 판(종류 5) — 삼진 콜 0xa7c4c(16 삼구 · 17 풀카운트)는 정산 0xa8024 보다 **먼저** 났다:
 * 정산이 그 콜이 넣은 사건 5 를 세어([sp+0x20]) 레코드 +0x26 을 올리므로(a8d00) 콜이 판 정산 앞이다. 그래서 알림 차례는
 * 16/17 → 36 → 24(a83de)다. 그 한 정산 안에서는 36(a80f8 — [sp+0x30] > 0 && state[0x8b])이 도루 루프의 24(a83de)보다 먼저다.
 * [sp+0x30] 에는 삼진 사건 5 가 들어 늘 0 보다 크다 — 타석 결과 쪽(`applyDefensivePlay` 의 `stealPlaySettlement`)은 이 둘을 다시 안 준다.
 * 0xa77f0 — 24(도루 저지)는 수비 계열이라 사람 수비에서 지난다. 8(도루)은 공격 계열이라 버려진다
 */
function withArrivalRecordIds(next: PitcherGameProgress, progress: PitcherGameProgress, play: PitchArrivalPlay): PitcherGameProgress {
  const recordIds = [
    ...strikeoutStealRecordIdsOf(progress, play),
    ...play.recordIds.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: false, defenseIsHuman: true })),
  ]
  if (recordIds.length === 0 || !recordsAllowed(next)) return next
  return { ...next, recordIds: [...next.recordIds, ...recordIds] }
}

function strikeoutStealRecordIdsOf(progress: PitcherGameProgress, play: PitchArrivalPlay): number[] {
  if (play.kind !== STEAL_PLAY_KIND || progress.atBat.outcome?.kind !== '삼진') return []
  return [
    ...strikeoutCallRecordIdsOf({ pitches: progress.atBatPitches, balls: progress.atBat.balls }),
    ...laserThrowOutRecordOf({ laserThrowFlag: play.result.laserOutFlag, outsInPlay: play.result.advance.outsAdded + 1 }).recordIds,
  ]
}

function describeArrivalPlay(play: PitchArrivalPlay): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}실점)` : ''
  if (play.kind === WILD_PITCH_PLAY_KIND) return `폭투·포일${tail}`
  if (play.kind === FORCED_ADVANCE_PLAY_KIND) return `밀어내기${tail}`
  if (play.result.caughtFrom.length > 0) return `상대 도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `상대 도루 성공${tail}`
  return `상대 도루${tail}`
}
