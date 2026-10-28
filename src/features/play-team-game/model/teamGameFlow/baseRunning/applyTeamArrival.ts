import { type PitchArrivalPlay, arrivalApplicationOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { arrivalPlaySettles, settlementEventsOfPlay, pendingSettlementEventsAfter } from '@/features/defense-play/model/settlementEvents'
import { strikeoutCallRecordIdsOf, laserThrowOutRecordOf } from '@/entities/game/model/gameRecords'
import { describeArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/arrivalPlays'
import { withRunnerOnlyAdvance } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runnerOnlyAdvance'
import { withRunnerPlaySettlement, withTeamWildPitchSettlement } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runnerPlaySettlement'
import { withoutSteal } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { withLeagueStolenBases } from '@/features/play-team-game/model/teamGameFlow/records/leagueStolenBases'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withGameRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { isAtBatInterrupted } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import type { TeamPitchArrival } from '@/features/play-team-game/model/teamGameFlow/types/pitchArrival'
import { ARRIVAL_PLAY_KIND } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 다 돈 공 도착 판을 경기에 먹인다 — `arriveTeamPitch` 의 뒷부분. 실시간으로 보여 준 판(`shownLive`)은 재생 칸에 다시 안 넣는다.
 */
export function applyTeamArrival(progress: TeamGameProgress, play: PitchArrivalPlay, humanSide: ControlSide): TeamPitchArrival {
  const before = progress.game
  const humanOffense = humanSide === '공격'
  const opened: TeamGameProgress = { ...withoutSteal(progress), lastArrivalPlay: play, defenseScene: play.result.scene }
  // 낫아웃 · 볼넷 · 사구는 타석 결과 쪽이 먹인다 — 밀어내기 판(종류 2)은 재생 칸에만
  if (arrivalApplicationOf(play) !== 'runnerOnly') return { progress: opened, play, interrupted: false }

  const base = play.shownLive === true ? opened : { ...opened, lastDefensePlay: play.result }
  const settledApply = withRunnerOnlyAdvance(base, play.result.advance, humanSide, play.result.runnerFates)
  const ended = isAtBatInterrupted(before, settledApply.progress.game)
  // 판정 B 가 정산을 건너뛰는 판(삼진 없이 이어지는 폭투·포일 — ae596 → ae5a2)은 정산 칸을 안 센다
  const settles = arrivalPlaySettles(play, { halfOrGameEnded: ended })
  const applied = settles
    ? settledApply.progress
    : withRunnerOnlyAdvance(base, play.result.advance, humanSide, play.result.runnerFates, false).progress
  const recorded = withGameRecords(applied, [...strikeoutStealCallRecordIdsOf(progress, play), ...play.recordIds], humanOffense)
  const settled = withArrivalPlaySettlement(withLeagueStolenBases(recorded, progress, play, humanOffense), progress, play, humanOffense, settles)
  // 같은 타석이 이어지면 이 판의 사건이 목록에 남아 다음 견제 정산이 함께 센다 — 다음 공의 0xa5e14 가 비운다
  const pending: TeamGameProgress = {
    ...settled,
    pendingSettlementEvents: pendingSettlementEventsAfter(undefined, settlementEventsOfPlay(play.result), progress.atBat.outcome === null && !ended),
  }
  const next = appendLog(pending, `${before.inning}회${before.half} ${describeArrivalPlay(play, humanOffense)}`, true)
  return { progress: next, play, interrupted: ended }
}

/**
 * 삼진 + 도루 판(종류 5) — 삼진 콜 0xa7c4c(16 삼구 · 17 풀카운트)는 정산 0xa8024 보다 **먼저** 났다(정산이 그 콜이 넣은 사건 5 를
 * 세어 [sp+0x20] 으로 쓴다, a8d00). 그래서 알림 차례는 16/17 → 36 → 24(a83de)다 — 타석 결과 쪽(`withOurDefenseRecords` 의
 * `stealPlayOuts`)은 다시 안 준다. 16/17 은 수비 계열이라 사람 수비에서만 게이트를 지난다.
 * 그 한 정산 안에서는 머리의 36(a80f8 — [sp+0x30] > 0 && state[0x8b])이 도루 루프의 24(a83de)보다 먼저다. [sp+0x30] 에는 삼진
 * 사건 5 가 들어 늘 0 보다 크다 — 타석 결과 쪽(`withOurDefenseRecords` 의 `stealPlayOuts`)은 36 을 다시 안 준다
 */
function strikeoutStealCallRecordIdsOf(progress: TeamGameProgress, play: PitchArrivalPlay): readonly number[] {
  if (play.kind !== ARRIVAL_PLAY_KIND.도루 || progress.atBat.outcome?.kind !== '삼진') return []
  return [
    ...strikeoutCallRecordIdsOf({ pitches: progress.recordTally.atBatPitches, balls: progress.atBat.balls }),
    ...laserThrowOutRecordOf({ laserThrowFlag: play.result.laserOutFlag, outsInPlay: play.result.advance.outsAdded + STRIKEOUT_CALL_EVENT })
      .recordIds,
  ]
}

/** 삼진 콜이 사건 목록에 넣는 사건 5 하나 */
const STRIKEOUT_CALL_EVENT = 1

/** 타석 결과 없이 판 혼자 도는 정산 — 판 종류마다 하나뿐이다 */
function withArrivalPlaySettlement(
  next: TeamGameProgress,
  progress: TeamGameProgress,
  play: PitchArrivalPlay,
  humanOffense: boolean,
  settles: boolean,
): TeamGameProgress {
  const events = settlementEventsOfPlay(play.result)
  // 삼진이 함께 선 도루 판은 정산이 삼진 길에서 한 번에 돈다 (`stealPlayWithStrikeoutOf`)
  if (play.kind === ARRIVAL_PLAY_KIND.도루 && progress.atBat.outcome?.kind !== '삼진') {
    return withRunnerPlaySettlement(next, progress, play.result, humanOffense, events)
  }
  // 삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9) — 거르기가 없는 정산이라 거르지 않는 칸(36 · 26/27 · R[3] ·
  // state[0x88]) 위에 타석 칸 · 결과 링 · 리그 타수 · 콤보 지우기 · 결과비트까지 오른다
  if (play.kind === ARRIVAL_PLAY_KIND.폭투포일 && settles && progress.atBat.outcome === null) {
    const runnerSettled = withRunnerPlaySettlement(next, progress, play.result, humanOffense, events)
    return withTeamWildPitchSettlement(runnerSettled, progress, play.result, humanOffense)
  }
  return next
}
