import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { isBattedBallInPlay, withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  clearsPitchJudgement,
  openPitchArrivalPlay,
  pitchJudgementOf,
  runOpenedPitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { countsTopGradePitch, recordPitchGrade } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import { enterPitchSelection } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/pitchSelection'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { defensePlayInputOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/defensePlayInput'
import {
  myDefenseAbilitiesOf,
  myFielderPlatesOf,
  myFielderRecordsOf,
  myFielderSkillIdsOf,
  opponentRunnerAcesOf,
  runAbilitiesOnBaseOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { applyPitcherArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/applyPitcherArrival'
import type { PitcherPitchArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchArrivalTypes'
import { withoutSteal, withoutStealDisplay } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/stealDisplay'
import { finishNonPlayOutcome } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/nonPlayOutcome'
import { applyDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlay'
import type { PitcherPendingPitchArrival, PitcherPendingRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * **0x12 진입 0x3dfac — 붙든 공의 공 도착** (`pendingPitchArrival`). 화면이 공을 놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤 틀 머리에
 * 부른다 — 그 사이 공이 나는 틀들의 관리자 틱 0x6de85 굴림이 이 굴림(`rollPassedBall` 1번 → 판이 열리면 판 시작 굴림) 앞에 난다.
 * 그 뒤는 `startPitch` 가 놓는 걸음에 돌리던 나머지 그대로다(0xf 진입 · 타석 결과 · 벤치 클리어링). 붙든 공이 없으면 그대로 돌려준다.
 */
export function enterPitchResult(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const held = progress.pendingPitchArrival
  if (held == null) return progress
  return arrivePitcherPitchThenRest({ ...progress, pendingPitchArrival: null }, held, random)
}

/** 붙든(또는 막 놓은) 못 맞힌 공의 0x3dfac 과 그 뒤 — `startPitch` · `enterPitchResult` 의 꼬리 */
export function arrivePitcherPitchThenRest(
  progress: PitcherGameProgress,
  pitch: PitcherPendingPitchArrival,
  random: RandomPort,
): PitcherGameProgress {
  const resume = { buntKind: pitch.buntKind }
  const arrival = arrivePitcherPitch(progress, pitch, random, pitch.live ? resume : undefined)
  if (arrival.deferred === true) return arrival.progress
  return afterMyPitchArrival(arrival, resume, random)
}

/**
 * 내 공의 공 도착 뒤 — `startPitch` 의 뒷부분. 실시간 주자 판이 끝난 뒤(`resolveRunnerPlay`)도 여기서 잇는다.
 */
export function afterMyPitchArrival(arrival: PitcherPitchArrival, resume: { readonly buntKind: number }, random: RandomPort): PitcherGameProgress {
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  const arrived = arrival.progress
  const outcome = arrived.atBat.outcome
  // 볼·스트라이크·파울 — 판정 A 0xae24c 의 "그 밖 → 0xf" 라 다음 공을 고르기 전에 0xf 진입 0x3d954 를 다시 지난다
  if (outcome === null) return enterPitchSelection(arrived, random)
  // 맞은 공은 쏜 패턴(`simulateBatter` 가 결과 객체에 묶어 둔 것)으로 판을 돈다 — 홈런도 판 안에서 끝난다.
  // 판정 11(2스트라이크 번트 파울 아웃)은 묶인 패턴이 없어 판 없이 아웃이다
  const contact = contactOfOutcome(outcome)
  if (contact !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome)) {
    // 여기서 멈춘다 — 화면이 이 타구를 실시간으로 돌리고 결과를 `resolveDefensePlay` 에 넘긴다.
    // `atBat` 은 아직 안 비웠으므로 끝난 타석의 결과 코드·볼 카운트가 그대로 남아 있다.
    // 출발 칸은 타구 판 입력(리드 0x3d7b8)이 읽고 나면 비운다
    return {
      // 타구 판(종류 1) 시작 리드 0x3d7b8 이 도루 주자의 출발 표시를 지운다(3d8c6~3d8d2)
      ...withoutStealDisplay(arrived),
      // 진행기 입력의 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
      pendingDefensePlay: withPredictedOutcome({
        ...defensePlayInputOf(arrived, outcome, random),
        // 장면 +0xfdc — CPU 타자의 번트 종류. 페어 번트 판도 판 시작 리드(0x3d7b8 +3 틱) · 필살수비 관문(50fc8) · 정산이 본다
        buntKind: resume.buntKind,
      }),
    }
  }
  // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a]).
  // 삼진 기록(0xa7c4c)은 그대로 남는다 — `applyDefensivePlay` 의 보통 삼진 길을 판의 결과로 지난다.
  // 실시간으로 이미 보여 준 판(`shownLive`)은 재생 칸에 다시 안 넣는다
  const play = arrival.play
  if (play !== null && arrivalApplicationOf(play) === 'batterRuns') {
    return advance(applyDefensivePlay(arrived, outcome, true, arrived.atBat.balls, play.result, play.shownLive === true ? null : play.result), random)
  }
  // 볼넷 · 사구 · 판 없는 삼진 — 공 도착 0x3dfac 은 0x12 를 예약할 뿐이다. 벤치 클리어링 굴림(4e74c, 사구만)·판정 A 의 밀어내기
  // 주루(0x17)·정산(삼진은 0xd · 0x18 과 0xa8024)은 0x12 의 32 그림 뒤라 그동안 붙든다(그 그림들의 입자 굴림이 먼저 난다 —
  // `judgeHitByPitch`, A-22 · r295 · r298)
  if (holdsUntilResultWaitEnd(outcome, play)) {
    return {
      ...arrived,
      pendingBenchClearing: play === null ? { phase: 'wait', outcome } : { phase: 'wait', outcome, arrivalPlay: play },
    }
  }
  return finishNonPlayOutcome(arrived, outcome, random, play)
}

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`). 타자편 `gameFlow.arrivePitch`
 * · 팀 경기 `arriveTeamPitch` 와 같은 길이다. 투수편은 늘 내가 수비다.
 *
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판 입력이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9 / 종류 5 / 없음. 판이 열리면 그 advance 를 견제와 같은 주자 판
 *   (`withMyRunnerPlay`, 타순 그대로)으로 먹이고 재생 칸에 넣는다. 낫아웃(종류 9 + 삼진 + 타자주자)은 여기서 안 먹이고
 *   `startPitch` 가 `applyDefensivePlay(…, result, result)` 로 삼진 타석의 진루로 먹인다.
 * - 정산: 도루(5)는 늘, 폭투·포일(9)은 삼진이 그대로 선 판만 0xa8024 를 지난다(`withMyRunnerPlay` 의 `settles`).
 * - 기록: 도루 판의 24(도루 저지)만 0xa77f0 게이트를 지난다(사람 수비) — 8(도루)은 버려진다.
 * - 도루 · 폭투 판은 상태 0x17 동안 사람 송구 키(0x533c8 → 0x588 → +0x160)로 던진다 — 화면이 도는 갈래(`live`)는 판을
 *   붙들어(`pendingRunnerPlay`) 화면이 한 틱씩 돌리고 `resolveRunnerPlay` 가 잇는다(`liveRunnerPlay`). 밀어내기(종류 2)는
 *   vt4c 가 안 돌아 키 송구가 없으니 미리 돌린다.
 *
 * - 루별 주루: 루에 선 주자의 신원(`GameState.runners`, 원본 주자 목록)대로 그 상대 타순 칸 선수(`runAbilitiesOnBaseOf`).
 * - 삼진 + 도루(종류 5)면 원본 판정 B 는 정산 0xa8024 를 **종류 5 로 한 번** 부른다 — 주자 판을 먹인 뒤 삼진 타석을
 *   `applyDefensivePlay(…, stealPlaySettlement)` 로 먹여 R+0x138(타자 수, a8d98) · R+0x134(탈삼진, a8d38) · 18~23 ·
 *   상대 타자 타석 칸(a8ac8) · 리그 타수(a8856)를 건너뛴다. 아웃 R+0x13c · 16/17 은 삼진 콜 0xa7c4c 몫이라 그대로 센다.
 * - 번트 종류(장면 +0xfdc): `simulateBatter` 가 낸 이 공의 값(`thrown.buntKind`)을 주자 판에 싣는다 — 도루 판 리드 0x3d7b8 이
 *   도루 안 한 주자에게 +3 틱을 더한다.
 *   번트 헛스윙은 그 공의 종류를, 안 휘두른 공은 0 을 낸다 — 0x11 진입 0x3de10(3deb8 0x340dc)이 공마다 +0xfd8 · +0xfdc · +0xfe0 을
 *   memset 하고 CPU 타석에서 쓰는 곳 0x34436 은 휘두를 때만이다.
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
function arrivePitcherPitch(
  progress: PitcherGameProgress,
  pitch: {
    readonly resolution: PitchResolution
    readonly outcomeAfter: AtBatOutcome | null
    /** 장면 +0xfdc — 이 공 뒤의 번트 종류(못 맞힌 번트면 그 종류, 안 휘둘렀으면 0). 도루 판 리드 0x3d7b8 이 본다 */
    readonly buntKind?: number
    /** 이 공의 등급 t (scene+0x17c0) — 결과 코드 스위치의 R+0x158(`recordPitchGrade`)이 본다 */
    readonly grade: number
    /** 지금 타자의 손 0xb63c0(1 = 좌타) — 밀어내기 · 낫아웃 판의 타자주자 타석 자리(vt94 0xa0884, `PitchArrivalPlayInput.batterHand`) */
    readonly batterHand: number
  },
  random: RandomPort,
  /** 화면이 도는 갈래면 도루 · 폭투 판을 붙든다 — `afterMyPitchArrival` 이 쓸 값 */
  live?: PitcherPendingRunnerPlay['resume'],
): PitcherPitchArrival {
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    return { progress: next, play: null, interrupted: false }
  }
  const before = progress.game
  const opened = openPitchArrivalPlay(
    {
      gameMode: PITCHER_EDITION_MODE,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: before.bases,
      outs: before.outs,
      batterHand: pitch.batterHand,
      // 수비 아홉 칸은 우리 팀 — 칸 0(나)은 진행기가 선수 없는 칸으로 둔다(0xb0fb4 b1032, `myDefenseAbilitiesOf`)
      defenseAbilities: myDefenseAbilitiesOf(progress),
      // 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10)
      fielderPlates: myFielderPlatesOf(progress),
      fielderSkillIds: myFielderSkillIdsOf(progress),
      // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
      defenseTeamIndex: progress.options.ourTeamId,
      fielderRecords: myFielderRecordsOf(progress),
      offenseTeamIndex: progress.options.opponentTeamId,
      runnerAces: opponentRunnerAcesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
      defenseIsCpu: false,
      // 공격이 CPU 라 늘 자동 진루, 송구만 환경설정이 먹는다 (0xae6c8 의 첫 항이 거짓) — 원본 기본값은 수동
      offenseIsCpu: true,
      throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
      buntKind: pitch.buntKind ?? 0,
      scene: progress.defenseScene,
      // 경기 +0xfd4 — 이 공의 값 (`startPitch` 가 이미 적었다)
      sceneResultCode: progress.sceneResultCode,
    },
    random,
  )
  // 3e0aa — 낫아웃 갈래가 판정 칸을 지웠나. 같은 진입이 적고 0x12 틱 0 그림이 읽는다 (바뀔 때만 새 객체)
  const judgementCleared = clearsPitchJudgement(opened)
  const judged: PitcherGameProgress =
    (progress.lastPitchJudgementCleared === true) === judgementCleared ? progress : { ...progress, lastPitchJudgementCleared: judgementCleared }
  // R+0x158 — 판 종류를 정한 같은 진입이 결과 코드 스위치(0x3e11a, 표 0xcffb4)로 간다 (`countsTopGradePitch`)
  const graded = countsTopGradePitch(pitch.resolution.kind === '스트라이크', judgementCleared)
    ? { ...judged, pitcherRecord: recordPitchGrade(judged.pitcherRecord, pitch.grade) }
    : judged
  if (opened === null) return { progress: withoutSteal(graded), play: null, interrupted: false }
  // 도루 · 폭투 판 — 키(+0x160)로 던지므로 화면이 실시간으로 돌린다 (`liveRunnerPlay`). 밀어내기(종류 2)는 미리 돌린다
  if (live !== undefined && opened.kind !== 2) {
    return {
      progress: { ...graded, pendingRunnerPlay: { kind: 'arrival', opened, resume: live } },
      play: null,
      interrupted: false,
      deferred: true,
    }
  }
  return applyPitcherArrival(graded, runOpenedPitchArrivalPlay(opened))
}
