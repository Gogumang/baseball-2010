import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { runDefensePlay, recordedOutcomeOf, withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { droppedThirdStrikeArrivalOf, stealPlayWithStrikeoutOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/arrivalPlays'
import { withoutSteal, withoutStealDisplay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { finishBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/finishBatterOutcome'
import { resolveBenchClearing } from '@/features/play-team-game/model/teamGameFlow/benchClearing/benchClearing'
import { withResultWaitHold } from '@/features/play-team-game/model/teamGameFlow/benchClearing/resultWaitHold'
import { isBattedIntoPlay } from '@/features/play-team-game/model/teamGameFlow/defense/battedIntoPlay'
import { batterDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseInputs'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 사람 타석 하나의 **결과**를 반영하고 다음 사람 차례까지 민다.
 * 인플레이 타구는 수비 시뮬레이션을 돌려 아웃·득점·루 상황을 그 결과로 갈아 끼운다.
 *
 * ⚠️ 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startBatterOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (자동 소화·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  let started = startBatterOutcome(progress, outcome, random, options)
  // 끼어들 사람이 없으면 벤치 클리어링도 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    started = resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기라 난수 차례가 같다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending.input)
  // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  return finishBatterOutcome({ ...started, pendingDefensePlay: null }, recordedOutcomeOf(pending.input, result), random, result, result)
}

/**
 * 사람 타석의 결과 코드만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 `isHumanTurn` 이 거짓이라
 * 다음 투구가 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 돌아간다).
 *
 * 우리 공격 타석이므로 사람이 잡는 쪽은 **공격(주루 0x5331c)** 이다 (I 0절 상태 0x17 표).
 * 홈런 · 공 도착 판이 열린 삼진은 수비가 개입할 것이 없어 여기서 곧장 끝낸다. 볼넷 · 사구 · 판 없는 삼진은 0x12 대기 끝까지
 * 붙든다(`judgeHitByPitch` — 사구면 그때 벤치 클리어링을 굴린다, r295 · r298).
 */
export function startBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  // 출발 칸은 이 공 하나의 것이다 — 타구 판 입력이 읽고 나면 비운다
  const cleared = withoutSteal(progress)
  // 볼넷 · 사구 · 판 없는 삼진 — 0x12 대기 끝까지 붙든다 (`withResultWaitHold`)
  if (holdsUntilResultWaitEnd(outcome, options.arrivalPlay)) return withResultWaitHold(cleared, '공격', outcome, options.arrivalPlay ?? null)
  // 페어 타구면 쏜 패턴이 따라온다 — 넘겨받았거나(`options.pattern`) 타석 결과 객체에 묶여 있다(`contactOfOutcome`)
  const pattern = options.pattern ?? contactOfOutcome(outcome)?.pattern
  if (!isBattedIntoPlay(outcome, pattern)) return finishUnplayedOurAtBat(cleared, outcome, random, options)
  return startOurInPlayDefense(progress, cleared, outcome, pattern, random, options)
}

/**
 * 인플레이 타구 — 진행기에 넘길 판 입력만 만들어 `pendingDefensePlay` 에 얹는다. 판 입력은 출발 칸이 남은 진행(`stealing`)으로 만든다.
 * ⚠️ 패턴이 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
 * 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
 */
function startOurInPlayDefense(
  stealing: TeamGameProgress,
  cleared: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern | undefined,
  random: RandomPort,
  options: BatterOutcomeOptions,
): TeamGameProgress {
  const input = withPredictedOutcome({
    ...batterDefenseInputOf(stealing, outcome, pattern ?? fixturePatternFor(outcome), random, options),
    ...(pattern === undefined ? { outcomeIsGiven: true } : {}),
  })
  // 타구 판(종류 1) 시작 리드 0x3d7b8 이 도루 주자의 출발 표시를 지운다(3d8c6~3d8d2)
  return { ...withoutStealDisplay(cleared), pendingDefensePlay: { side: '공격', input, outcome: input.outcome } }
}

/** 판을 안 도는 사람 타석 — 낫아웃 판 · 홈런 · 판 없이 끝난 공 */
function finishUnplayedOurAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions,
): TeamGameProgress {
  const arrival = options.arrivalPlay ?? null
  // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
  const droppedThirdStrike = droppedThirdStrikeArrivalOf(arrival)
  if (droppedThirdStrike !== undefined) return finishBatterOutcome(progress, outcome, random, droppedThirdStrike.result, droppedThirdStrike.result)
  // ⚠️ 패턴 없이 들어온 홈런(시험·옛 호출)은 날아가는 그림만 따로 만든다 — 점수는 타석 쪽 규칙(전원 득점)이다.
  // 이 공이 연 도루·폭투 판이 있으면 그 판을 재생 칸에 남긴다
  const playback =
    homeRunPlaybackOf({ outcome, bases: progress.game.bases, outs: progress.game.outs, pattern: options.pattern }) ?? arrival?.result ?? null
  return finishBatterOutcome(progress, outcome, random, null, playback, stealPlayWithStrikeoutOf(arrival, outcome))
}
