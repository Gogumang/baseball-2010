import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { runDefensePlay, recordedOutcomeOf, withPredictedOutcome, isBattedBallInPlay } from '@/features/defense-play/model/runDefensePlay'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { arrivalApplicationOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { withoutSteal, withoutStealDisplay } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { finishPlayerOutcome } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome'
import { finishStrikeoutStealSettlement } from '@/features/play-game/model/gameFlow/batting/strikeoutSteal'
import { resolveBenchClearing } from '@/features/play-game/model/gameFlow/benchClearing/benchClearing'
import { defensePlayInputOf } from '@/features/play-game/model/gameFlow/defense/defenseInputs'
import { withFoulRecords } from '@/features/play-game/model/gameFlow/records/gameRecords'
import type { PlayerOutcomeOptions } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 플레이어 타석의 결과를 반영하고, 다시 플레이어 차례가 올 때까지 자동 진행한다.
 *
 * **원본은 CPU 끼리의 경기에만 간이 엔진(0xc11f0)을 쓰고 사람 경기는 수비 시뮬레이션을 돌린다.**
 * 그래서 여기서는 맞은 공(안타·아웃·홈런으로 끝난 타석)이면 `features/defense-play` 진행기에 **쏜 패턴 그대로**를
 * 넘겨 돌리고, 아웃·득점·루 상황은 물론 **기록할 결과**(안타 루타·아웃·홈런)도 판 끝 정산(0xa8024 —
 * `playOutcome`)이 낸 것으로 갈아 끼운다. 넘겨받은 결과는 타석을 끝내기 위한 임시 값이다.
 * 삼진·볼넷·사구는 수비가 개입할 것이 없어 지금까지의 길(0xc11f0 과 같은 규칙)을 그대로 쓴다.
 *
 * 패턴은 `options.pattern` 이나, `resolvePitch` 가 결과 객체에 묶어 둔 것(`contactOfOutcome`)을 쓴다.
 * 둘 다 없으면(시험·옛 호출 — 원본에 없는 웹 전용 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
 * `isUncatchable` 은 필살타법 성공 타구 — 야수가 포구를 건너뛴다 (0x51800, S13 6절).
 *
 * 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startPlayerOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (미션·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  const started = startPlayerOutcome(progress, outcome, random, options)
  // 벤치 클리어링도 끼어들 사람이 없으면 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    return resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending)
  // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  return finishPlayerOutcome(
    { ...started, pendingDefensePlay: null, defenseScene: result.scene },
    recordedOutcomeOf(pending, result),
    random,
    result,
    result,
  )
}

/**
 * **내 타석에서 상대 투수가 공 하나를 던졌다** — 원본은 공이 손을 떠날 때(상태 0x11 진입 0x3de10 의
 * 0x3dec6) `0xa5e14(ctx, 구질 = game+0xfc8)` 를 부른다 (P1 3-1):
 *   P+0x28·ctx+0x16c·수비팀+0x27c += 1 · state[0xd] = 0(0xa5e72) ·
 *   c = 0x66ef0(구질), 0xb62b4(현재 타자, 22) || 0xb62b4(P, 18) 이면 ×2, 0xb62b4(P, 10) 이면 −1 → 0xaeb08
 * 웹은 이 중 마운드 칸(투구 수 `+0x27c` · 스태미나 `+0x2c` · `justChanged`)만 든다 — 동료 간이 타석
 * (`drainQuickPitcher`)과 같은 칸이다. 시즌 누계 P+0x28·반 이닝 투구 수 ctx+0x16c·타석 투구 수 ctx+0x161 은
 * 타자편 진행기에 칸이 없다.
 *
 * 공마다 부른다 — 판정이 난 공(`PitchOutcomeDetail.pitchTypeNumber`)마다 한 번. 견제는 공이 아니라 안 부른다.
 * 깎은 스태미나는 다음 공의 0xf 진입(`enterPitchSelection` — CPU 교체 0xac428)과 동료 간이 타석이 본다. 난수는 쓰지 않는다.
 *
 * `batterIntimidates` = 타석에 선 내 선수가 타자 스킬 22 압도를 **장착**했는가.
 * 상대 투수 스킬 18 비겁자 · 10 끈기는 그 레코드 +0x14 (`quickDefenseOf` 의 `skillBitsAt` → `drainPitcherForPitch`).
 */
/**
 * **번트 판정을 받은 내 공** — 0x4e060 의 4e15c~4e1fa: 번트 자세(S+8)가 공 틱 N − 1 까지 섰으면 스윙 시작 0xa5fac 를 부르고, 그 안
 * a5fcc 가 state[0x13](번트 종류) ≠ 0 이라 0xa57f8(코드 11) → G+0xf8 +1 (`ReputationCounts.bunts`). 맞혔든 헛맞았든 센다.
 * 나리 타자편의 사람 타석은 내 타석뿐이라 0xa56dc(R, 타자, 1) 게이트(국가대항전 · 포스트시즌이면 거짓)만 본다. 굴림 없음.
 */
export function recordMyBuntAttempt(progress: GameProgress, options: { readonly isRecorded: boolean }): GameProgress {
  if (progress.game.isFinished || !options.isRecorded) return progress
  const counts = progress.reputationCounts
  return { ...progress, reputationCounts: { ...counts, bunts: (counts.bunts ?? 0) + 1 } }
}

/**
 * 타석 결과만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 타석이 시작되지 않는 것이
 * 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 투구가 안 나가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 홈런 · 공 도착 판이 열린 삼진(낫아웃 · 도루)은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (0xc11f0 과 같은 규칙).
 * 볼넷 · 사구 · 판 없는 삼진은 굴림 없이 붙든다 — 0x12 대기 끝(틱 31 의 0x4e6d4)에서 사구면 벤치 클리어링을 굴리고 판정 A 로 간다
 * (`judgeHitByPitch`, A-22 · r295 · r298).
 */
export function startPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  if (progress.game.isFinished) return progress
  progress = withFoulRecords(progress, options.foulRecordIds)
  // 볼넷 · 사구 · 판 없는 삼진 — 공 도착 0x3dfac 은 0x12 를 예약할 뿐이다. 벤치 클리어링 굴림(4e74c, 사구만)·판정 A 의 밀어내기
  // 주루 · 정산(삼진은 0xd · 0x18 과 0xa8024)은 0x12 의 32 그림 뒤라 그동안 붙든다(그 그림들의 입자 굴림이 먼저 난다 —
  // `holdsUntilResultWaitEnd`, r295 · r298)
  if (holdsUntilResultWaitEnd(outcome, options.arrivalPlay)) {
    const arrivalPlay = options.arrivalPlay ?? null
    return {
      ...progress,
      pendingBenchClearing: arrivalPlay === null ? { phase: 'wait', outcome } : { phase: 'wait', outcome, arrivalPlay },
    }
  }
  // 페어 타구면 쏜 패턴이 따라온다 — 넘겨받았거나(`options.pattern`) 타석 결과 객체에 묶여 있다(`contactOfOutcome`)
  const pattern = options.pattern ?? contactOfOutcome(outcome)?.pattern
  if (isBattedBallKind(outcome) && pattern !== undefined) {
    return {
      // 타구 판(종류 1) 시작 리드 0x3d7b8 이 도루 주자의 출발 표시를 지운다(3d8c6~3d8d2)
      ...withoutStealDisplay(progress),
      pendingDefensePlay: withPredictedOutcome(defensePlayInputOf(progress, outcome, pattern, random, options)),
    }
  }
  if (!isBattedBallInPlay(outcome)) {
    const arrival = options.arrivalPlay ?? null
    // 삼진 + 도루 — 판정 B 0xae3e8 이 정산 0xa8024 를 종류 5 로 한 번만 부른다(ae586 · ae5a8). 판의 진루는 `arrivePitch` 가 먹였다
    if (arrival !== null && arrival.kind === 5 && outcome.kind === '삼진') {
      return finishStrikeoutStealSettlement(withoutSteal(progress), outcome, arrival, random, options.isRecorded !== false)
    }
    // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
    // 실시간으로 이미 보여 준 판(`shownLive` — 사람 주루 키를 받은 판)은 재생 칸에 다시 안 넣는다
    const arrivalPlayback = arrival === null || arrival.shownLive === true ? null : arrival.result
    if (arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns') {
      return finishPlayerOutcome(withoutSteal(progress), outcome, random, arrival.result, arrivalPlayback)
    }
    // 웹 전용 길: 패턴 없이 들어온 홈런(시험·옛 호출)은 날아가는 그림만 따로 만든다 — 점수는 타석 쪽 규칙(전원 득점)이다
    const playback = homeRunPlaybackOf({ outcome, bases: progress.game.bases, outs: progress.game.outs, pattern: options.pattern }) ?? arrivalPlayback
    return finishPlayerOutcome(withoutSteal(progress), outcome, random, null, playback)
  }
  // 웹 전용 길: 패턴 없이 들어온 안타·아웃(시험·옛 호출) — 원본에 없는 길이다. 결과에 맞는 패턴을 원본 표에서 골라 판을 돌린다
  //    (`fixturePatternFor`). 실제 타석(`resolvePitch`)은 늘 패턴을 싣는다
  return {
    ...withoutStealDisplay(progress),
    pendingDefensePlay: {
      ...defensePlayInputOf(progress, outcome, fixturePatternFor(outcome), random, options),
      outcomeIsGiven: true,
    },
  }
}
