import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { type PitchArrivalPlay, arrivalApplicationOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { contactOfOutcome, type BattedContact, registerContact } from '@/entities/batting/model/battedContact'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { isBattedBallInPlay, withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { stealPlayWithStrikeoutOf, wildPitchWithStrikeoutOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/arrivalPlays'
import { withoutSteal, withoutStealDisplay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { batterDefenseInputOf, defensiveDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseInputs'
import { finishDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/finishDefensiveAtBat'
import { withFoulRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 상대 타석 하나의 결과 코드만 먼저 정한다. `mine` 이 참이면 사람이 던진 타석이라
 * 인플레이 타구를 `pendingDefensePlay` 에 얹고 **경기 상태는 한 톨도 안 건드린 채** 멈춘다.
 *
 * 사람이 잡는 쪽은 **수비(송구 0x533c8)** 다 — 원본 상태 0x17 갈래가 공/수로 가르는 그 자리다
 * (I 0절 표: 공격이면 0x5331c 주루, 수비면 0x533c8 송구).
 *
 * 자동으로 넘긴 타석(`mine` 거짓)은 수비 시뮬레이션 자체가 없어 곧장 끝난다.
 */
export function startDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  random: RandomPort,
  /** 필살 성공 타구인가 (0x517e6 → 0x51800) — 사람이 던진 타석의 CPU 마타자만 */
  isUncatchable = false,
  /** 이 공이 도착하며 연 주자 판 (`arriveTeamPitch`) — 낫아웃이면 그 판의 진루가 이 삼진 타석의 진루다 */
  arrival: PitchArrivalPlay | null = null,
  /** 장면 +0xfdc — CPU 타자의 번트 종류(`simulateBatter`). 판 시작 리드(0x3d7b8) · 필살수비 관문(50fc8) · 정산이 본다 */
  buntKind = 0,
): TeamGameProgress {
  // 출발 칸은 이 공 하나의 것이다 — 타구 판 입력이 읽고 나면 비운다
  const stealing = progress
  progress = withoutSteal(progress)
  // 사람이 던진 타석의 맞은 공은 쏜 패턴(`simulateBatter` 가 결과 객체에 묶어 둔 것)으로 판을 돈다
  const pattern = contactOfOutcome(outcome)?.pattern
  const inPlay = mine && (pattern !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome))
  if (!inPlay) {
    // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
    if (arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns') {
      // 실시간으로 이미 보여 준 판(사람 수비의 키 송구 — `shownLive`)은 다시 안 튼다
      return finishDefensiveAtBat(progress, outcome, mine, arrival.result, arrival.shownLive === true ? null : arrival.result)
    }
    // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 (자동으로 넘긴 타석은 재생 자체가 없다).
    // 볼넷 · 사구면 이 공이 연 밀어내기 판(종류 2)을 재생한다 — 진루는 보통 길과 같다
    const walkPlayback = arrival !== null && arrivalApplicationOf(arrival) === 'freePass' ? arrival.result : null
    const playback = mine ? (homeRunPlaybackOf({ outcome, bases: progress.game.bases, outs: progress.game.outs }) ?? walkPlayback) : null
    return finishDefensiveAtBat(
      progress,
      outcome,
      mine,
      null,
      playback,
      undefined,
      stealPlayWithStrikeoutOf(arrival, outcome),
      wildPitchWithStrikeoutOf(arrival, outcome),
    )
  }
  // ⚠️ 패턴이 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
  // 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
  const input = withPredictedOutcome(
    pattern !== undefined
      ? { ...defensiveDefenseInputOf(stealing, outcome, pattern, random, isUncatchable), buntKind }
      : {
          ...defensiveDefenseInputOf(stealing, outcome, fixturePatternFor(outcome), random, isUncatchable),
          buntKind,
          outcomeIsGiven: true,
        },
  )
  // 타구 판(종류 1) 시작 리드 0x3d7b8 이 도루 주자의 출발 표시를 지운다(3d8c6~3d8d2)
  return { ...withoutStealDisplay(progress), pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **사람이 던진 타석의 파울 각 공 판** — 맞은 공이라 판을 돈다(타석은 아직 안 끝났다). 판이 파울로 닫히면(`foulEnded`)
 * `resolveDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로, 낙구 전에 잡히면 파울 뜬공 아웃으로 타석을 끝낸다.
 */
export function startDefensiveFoulPlay(progress: TeamGameProgress, contact: BattedContact, random: RandomPort, buntKind: number): TeamGameProgress {
  const stealing = progress
  // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다
  const cleared = withoutStealDisplay(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...defensiveDefenseInputOf(stealing, outcome, contact.pattern, random, false),
    // 판 끝 결과 코드 11(2스트라이크 번트 파울) · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
    strikes: progress.atBat.strikes,
    // 장면 +0xfdc — CPU 타자의 번트 종류. 11 은 번트(state[0x13])일 때만 난다
    buntKind,
  })
  return { ...cleared, pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** **우리 타석의 파울 각 공 판** — `startDefensiveFoulPlay` 의 공격 쪽. 상대 수비(CPU)가 공을 쫓고 사람은 주루를 잡는다 */
export function startBatterFoulPlay(
  progress: TeamGameProgress,
  contact: BattedContact,
  random: RandomPort,
  options: BatterOutcomeOptions,
): TeamGameProgress {
  const stealing = progress
  // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다
  const cleared = withoutStealDisplay(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...batterDefenseInputOf(stealing, outcome, contact.pattern, random, options),
    strikes: progress.atBat.strikes,
  })
  return { ...cleared, pendingDefensePlay: { side: '공격', input, outcome: input.outcome } }
}

/**
 * **파울로 닫힌 판의 뒤** — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
 * 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크 ≤ 1 이면 +1)을 부른다. 웹 타석 칸의 '파울' 과 같은 규칙이다.
 * 우리 타석이면 판의 결과 코드 7 메시지(51c5c)의 연속 파울 기록(0xa7dbc)도 이때 센다.
 */
export function afterFoulPlay(progress: TeamGameProgress, side: ControlSide, random: RandomPort): TeamGameProgress {
  const recorded = side === '공격' ? withFoulRecords(progress, true) : progress
  return enterPitchSelection({ ...recorded, atBat: applyPitchResolution(recorded.atBat, { kind: '파울' }) }, random)
}
