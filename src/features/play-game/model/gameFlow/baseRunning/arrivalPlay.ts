import { type PitchArrivalPlay, arrivalApplicationOf, finishPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { arrivalPlaySettles, settlementEventsOfPlay, pendingSettlementEventsAfter } from '@/features/defense-play/model/settlementEvents'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import { enterPitchSelection } from '@/features/play-game/model/gameFlow/atBat/pitchSelection'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { applyCpuPickoff } from '@/features/play-game/model/gameFlow/baseRunning/cpuPickoff'
import { withRunnerOnlyPlay } from '@/features/play-game/model/gameFlow/baseRunning/runnerOnlyPlay'
import { withRunnerPlaySettlement, withWildPitchSettlement } from '@/features/play-game/model/gameFlow/baseRunning/runnerPlaySettlement'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { gatedOffenseRecords } from '@/features/play-game/model/gameFlow/records/gameRecords'
import type { PitchArrivalStep } from '@/features/play-game/model/gameFlow/types/pitchArrival'
import type { AtBatCount } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 다 돈 공 도착 판을 경기에 먹인다 — `arrivePitch` 의 뒷부분(미리 돌린 판 · 실시간으로 본 판 `resolveRunnerPlay` 가 함께 쓴다).
 * 실시간으로 보여 준 판(`shownLive`)은 재생 칸(`lastDefensePlay`)에 다시 안 넣는다.
 */
export function applyArrivalPlay(
  cleared: GameProgress,
  /** 공 도착 앞 진행 — 정산이 지금 상대 마운드 투수 · 타순 칸 · 아웃을 본다 */
  progress: GameProgress,
  play: PitchArrivalPlay,
  outcomeAfter: AtBatOutcome | null,
  isRecorded: boolean,
  random: RandomPort,
  /** 이 공을 먹인 뒤의 볼카운트 — 같은 타석이 이어질 때 0xf 진입의 교체 틱 굴림(0x344dc)이 본다 (`AtBatCount`) */
  countAfter: AtBatCount,
): PitchArrivalStep {
  const before = progress.game
  const shownLive = play.shownLive === true
  // 판이 남긴 수비 장면 연출 칸은 다음 판으로 (`defenseScene`)
  const opened: GameProgress = { ...cleared, defenseScene: play.result.scene }
  // 낫아웃 · 볼넷 · 사구는 타석 결과 쪽(`startPlayerOutcome` 의 `arrivalPlay`)이 먹인다 — 밀어내기 판은 재생 칸에만
  if (arrivalApplicationOf(play) !== 'runnerOnly') return { progress: opened, play, interrupted: false }

  const settledApply = withRunnerOnlyPlay(opened, play.result, true, shownLive)
  const ended = settledApply.game.isFinished || settledApply.game.inning !== before.inning || settledApply.game.half !== before.half
  // 판정 B 가 정산을 건너뛰는 판(삼진 없이 이어지는 폭투·포일 — ae596 → ae5a2)은 정산 칸을 안 센다
  let next = arrivalPlaySettles(play, { halfOrGameEnded: ended }) ? settledApply : withRunnerOnlyPlay(opened, play.result, false, shownLive)
  const recordIds = gatedOffenseRecords(play.recordIds)
  if (recordIds.length > 0) next = { ...next, recordIds: [...next.recordIds, ...recordIds] }
  // 삼진 없는 도루 판(종류 5)의 정산 — 거르지 않는 칸 (`withRunnerPlaySettlement`). 삼진 + 도루 판은 정산이 하나라 타석 결과 쪽
  // (`startPlayerOutcome` → `finishStrikeoutStealSettlement`)이 삼진 사건과 판의 사건을 함께 센다
  if (play.kind === 5 && outcomeAfter === null) {
    next = withRunnerPlaySettlement(next, progress, play.result, settlementEventsOfPlay(play.result), isRecorded)
  }
  // 삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9) — 거르기가 없는 정산이라 타석 칸 · 결과 링까지 오른다
  if (play.kind === 9 && ended && outcomeAfter === null) {
    next = withWildPitchSettlement(next, progress, play.result, isRecorded)
  }
  // 같은 타석이 이어지면 이 판의 사건이 목록에 남아 다음 견제 정산이 함께 센다 — 다음 공의 0xa5e14 가 비운다
  next = {
    ...next,
    pendingSettlementEvents: pendingSettlementEventsAfter(undefined, settlementEventsOfPlay(play.result), outcomeAfter === null && !ended),
  }
  next = appendLog(next, `${before.inning}회${before.half} ${describeArrivalPlay(play)}`, true)
  const interrupted = ended
  if (interrupted && !next.game.isFinished) next = advanceUntilPlayerTurn(next, random)
  // 판정 B 0xae3e8 — 같은 타석이 이어지면 0xf(다음 공) 진입 0x3d954
  else if (!interrupted && outcomeAfter === null) next = enterPitchSelection(next, random, countAfter)
  return { progress: next, play, interrupted }
}

/**
 * **붙든 주자 판이 끝났다** — 화면이 사람 주루 키를 받으며 다 돌린 결과(`pendingRunnerPlay`)로 그 걸음의 나머지를 잇는다.
 * - 공 도착 판(도루 · 폭투) — `arrivePitch` 의 뒷부분. 돌려준 `play` 를 타석 결과(`startPlayerOutcome` 의 `arrivalPlay`)에 넘긴다.
 * - CPU 견제 판 — `cpuPickoff` 의 뒷부분.
 * 실시간으로 본 판은 재생 칸에 다시 안 넣는다. 붙든 판이 없으면 그대로 돌려준다.
 */
export function resolveRunnerPlay(progress: GameProgress, result: DefensePlayResult, random: RandomPort): PitchArrivalStep {
  const pending = progress.pendingRunnerPlay
  if (pending == null) return { progress, play: null, interrupted: false }
  const cleared: GameProgress = { ...progress, pendingRunnerPlay: null }
  if (pending.kind === 'pickoff') {
    if (!isPickoffPlayResult(result)) return { progress: cleared, play: null, interrupted: false }
    const next = applyCpuPickoff(cleared, pending.input.targetBase as PickoffBase, result, random, {
      isRecorded: pending.pickoff.isRecorded,
      shownLive: true,
      count: pending.pickoff.count,
    })
    const before = cleared.game
    const interrupted = next.game.isFinished || next.game.inning !== before.inning || next.game.half !== before.half
    return { progress: next, play: null, interrupted }
  }
  const play = finishPitchArrivalPlay(pending.opened, result as RunnerPlayEngineResult, true)
  const arrival = pending.arrival
  return applyArrivalPlay(cleared, cleared, play, arrival.outcomeAfter, arrival.isRecorded, random, arrival.countAfter)
}

function describeArrivalPlay(play: PitchArrivalPlay): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}점)` : ''
  if (play.kind === 9) return `폭투·포일${tail}`
  if (play.kind === 2) return `밀어내기${tail}`
  if (play.result.caughtFrom.length > 0) return `도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `도루 성공${tail}`
  return `도루${tail}`
}
