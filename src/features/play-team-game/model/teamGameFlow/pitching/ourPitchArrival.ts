import type { RandomPort } from '@/shared/api/random/randomPort'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import { runDefensePlay, recordedOutcomeOf, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { type PitchArrivalPlay, finishPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import { applyPickoffPlay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/applyPickoffPlay'
import { applyTeamArrival } from '@/features/play-team-game/model/teamGameFlow/baseRunning/applyTeamArrival'
import { arriveTeamPitch } from '@/features/play-team-game/model/teamGameFlow/baseRunning/arriveTeamPitch'
import { continueOurAtBatAfterArrival } from '@/features/play-team-game/model/teamGameFlow/batting/afterBatterArrival'
import { startBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/batterOutcome'
import { resolveBenchClearing } from '@/features/play-team-game/model/teamGameFlow/benchClearing/benchClearing'
import { withResultWaitHold } from '@/features/play-team-game/model/teamGameFlow/benchClearing/resultWaitHold'
import { startDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/defensiveAtBat'
import { finishDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/finishDefensiveAtBat'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import type { TeamPitchArrival } from '@/features/play-team-game/model/teamGameFlow/types/pitchArrival'
import type { TeamPendingPitchArrival, TeamPendingRunnerPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **0x12 진입 0x3dfac — 붙든 우리 공의 공 도착** (`pendingPitchArrival`). 화면이 공을 놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤 틀
 * 머리에 부른다 — 그 사이 공이 나는 틀들의 관리자 틱 0x6de85 굴림이 이 굴림(`rollPassedBall` 1번 → 판이 열리면 판 시작 굴림) 앞에 난다.
 * 그 뒤는 `startThrowPitch` 가 놓는 걸음에 돌리던 나머지 그대로다(0xf 진입 · 타석 결과 · 벤치 클리어링). 붙든 공이 없으면 그대로 돌려준다.
 */
export function enterPitchResult(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const held = progress.pendingPitchArrival
  if (held == null) return progress
  return arriveOurPitchThenRest({ ...progress, pendingPitchArrival: null }, held, random, true)
}

/** 우리 공의 0x3dfac 과 그 뒤 — `pitchOnce` · `enterPitchResult` 의 꼬리 */
export function arriveOurPitchThenRest(
  progress: TeamGameProgress,
  pitch: TeamPendingPitchArrival,
  random: RandomPort,
  defer: boolean,
): TeamGameProgress {
  const resume = { isUncatchable: pitch.isUncatchable, buntKind: pitch.buntKind }
  const arrival = arriveTeamPitch(
    progress,
    { resolution: pitch.resolution, outcomeAfter: pitch.outcomeAfter, buntKind: pitch.buntKind, batterHand: pitch.batterHand },
    '수비',
    random,
    defer ? resume : undefined,
  )
  if (arrival.deferred === true) return arrival.progress
  return afterOurPitchArrival(arrival, resume, random, defer)
}

/**
 * 우리 공의 공 도착 뒤 — 판에서 반 이닝 · 경기가 끝났으면 다음 타석, 같은 타석이면 0xf, 타석이 끝났으면 벤치 클리어링 ·
 * 타구 판(`pitchOnce` 의 뒷부분). 실시간 주자 판이 끝난 뒤(`resolveRunnerPlay`)도 여기서 잇는다.
 */
function afterOurPitchArrival(
  arrival: TeamPitchArrival,
  resume: { readonly isUncatchable?: boolean; readonly buntKind: number },
  random: RandomPort,
  defer: boolean,
): TeamGameProgress {
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  const arrived = arrival.progress
  const outcome = arrived.atBat.outcome
  // 판정 A(0xae24c)의 "그 밖 → 0xf" — 같은 타석 다음 공. 0xf 진입 0x3d954 가 CPU 대타를 다시 묻는다
  if (outcome === null) return enterPitchSelection(arrived, random)

  // 볼넷 · 사구 · 판 없는 삼진 — 0x12 의 32 그림 뒤 틱 31 갱신(4e74c)이 (사구면) 벤치 클리어링을 굴리고 판정 A 가 밀어내기
  // 주루(0x17)·정산(삼진은 0xd · 0x18 과 0xa8024)으로 보낸다 — 그동안 붙든다(`judgeHitByPitch`, A-22 · r295 · r298).
  // 끼어들 사람이 없는 갈래는 대기 · 연출을 끝까지 본 것으로
  if (holdsUntilResultWaitEnd(outcome, arrival.play)) {
    const held = withResultWaitHold(arrived, '수비', outcome, arrival.play)
    return defer ? held : resolveBenchClearing(held, { reachedTargetTick: true }, random)
  }
  // 0x517e6 — CPU 마타자 필살이 성공한 타구는 "송구공" 비트(0xaf180)가 서서 야수가 쥐지 못한다
  const started = startDefensiveAtBat(arrived, outcome, true, random, resume.isUncatchable, arrival.play, resume.buntKind)
  const pending = started.pendingDefensePlay
  // 수비 진행 중 — 화면이 틱을 돌리는 동안 경기를 붙들어 둔다 (원본 상태 0x17)
  if (pending === null) return advance(started, random)
  if (defer) return started
  // 미리 다 돌려 버리는 갈래 — 난수를 쓰는 자리가 예전 `runDefensePlay` 호출과 똑같다
  const result = runDefensePlay(pending.input)
  return advance(
    // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 타석 쪽 결과는 임시 값이다(`battedContact`)
    finishDefensiveAtBat({ ...started, pendingDefensePlay: null }, recordedOutcomeOf(pending.input, result), true, result, result),
    random,
  )
}

/**
 * **실시간 주자 판이 끝났다** — 화면이 키(+0x160)를 받으며 다 돌린 도루 · 폭투 · 견제 판(`pendingRunnerPlay`)의 결과를
 * 경기에 먹이고 투구 흐름을 잇는다. 이미 눈으로 본 판이라 재생 칸(`lastDefensePlay`)에는 다시 안 넣는다.
 */
export function resolveRunnerPlay(progress: TeamGameProgress, result: DefensePlayResult, random: RandomPort): TeamGameProgress {
  const pending = progress.pendingRunnerPlay
  if (pending == null) return progress
  const cleared: TeamGameProgress = { ...progress, pendingRunnerPlay: null }
  const side = pending.side ?? '수비'
  if (pending.kind === 'pickoff') return isPickoffPlayResult(result) ? applyPickoffPlay(cleared, result, side, random, true) : cleared
  const play = finishPitchArrivalPlay(pending.opened, result as RunnerPlayEngineResult, true)
  if (side === '공격') return continueOurAtBatAfterRunnerPlay(cleared, play, pending.batter, random)
  return afterOurPitchArrival(applyTeamArrival(cleared, play, '수비'), pending.resume ?? { buntKind: 0 }, random, true)
}

/** 사람 공격 — `batterPitch` 의 나머지(판에서 끊김 → 다음 타석 · 같은 타석 → 0xf · 타석 끝 → 타석 결과) */
function continueOurAtBatAfterRunnerPlay(
  cleared: TeamGameProgress,
  play: PitchArrivalPlay,
  batter: TeamPendingRunnerPlay['batter'],
  random: RandomPort,
): TeamGameProgress {
  const arrival = applyTeamArrival(cleared, play, '공격')
  return continueOurAtBatAfterArrival(arrival, batter?.outcome ?? null, random, batter?.options ?? {}, startBatterOutcome)
}
