import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import {
  freePassArrivalResultOf,
  droppedThirdStrikeArrivalOf,
  stealPlayWithStrikeoutOf,
  wildPitchWithStrikeoutOf,
} from '@/features/play-team-game/model/teamGameFlow/baseRunning/arrivalPlays'
import { withoutSteal, withoutStealDisplay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { isBattedIntoPlay } from '@/features/play-team-game/model/teamGameFlow/defense/battedIntoPlay'
import { defensiveDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseInputs'
import { finishDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/finishDefensiveAtBat'
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
  const cleared = withoutSteal(progress)
  // 사람이 던진 타석의 맞은 공은 쏜 패턴(`simulateBatter` 가 결과 객체에 묶어 둔 것)으로 판을 돈다
  const pattern = contactOfOutcome(outcome)?.pattern
  if (!mine || !isBattedIntoPlay(outcome, pattern)) return finishUnplayedOpponentAtBat(cleared, outcome, mine, arrival)
  return startOpponentInPlayDefense(progress, cleared, outcome, pattern, random, isUncatchable, buntKind)
}

/**
 * 사람이 던진 타석의 인플레이 타구 — 판 입력만 만들어 `pendingDefensePlay` 에 얹는다. 판 입력은 출발 칸이 남은 진행(`stealing`)으로 만든다.
 * ⚠️ 패턴이 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
 * 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
 */
function startOpponentInPlayDefense(
  stealing: TeamGameProgress,
  cleared: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern | undefined,
  random: RandomPort,
  isUncatchable: boolean,
  buntKind: number,
): TeamGameProgress {
  const input = withPredictedOutcome({
    ...defensiveDefenseInputOf(stealing, outcome, pattern ?? fixturePatternFor(outcome), random, isUncatchable),
    buntKind,
    ...(pattern === undefined ? { outcomeIsGiven: true } : {}),
  })
  // 타구 판(종류 1) 시작 리드 0x3d7b8 이 도루 주자의 출발 표시를 지운다(3d8c6~3d8d2)
  return { ...withoutStealDisplay(cleared), pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** 판을 안 도는 상대 타석 — 낫아웃 판 · 홈런 · 볼넷 · 사구 · 삼진, 그리고 자동으로 넘긴 타석(수비 시뮬레이션이 없다) */
function finishUnplayedOpponentAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  arrival: PitchArrivalPlay | null,
): TeamGameProgress {
  // 낫아웃 — 실시간으로 이미 보여 준 판(사람 수비의 키 송구 — `shownLive`)은 다시 안 튼다
  const droppedThirdStrike = droppedThirdStrikeArrivalOf(arrival)
  if (droppedThirdStrike !== undefined) {
    const playback = droppedThirdStrike.shownLive === true ? null : droppedThirdStrike.result
    return finishDefensiveAtBat(progress, outcome, mine, droppedThirdStrike.result, playback)
  }
  return finishDefensiveAtBat(
    progress,
    outcome,
    mine,
    null,
    unplayedPlaybackOf(progress, outcome, mine, arrival),
    undefined,
    stealPlayWithStrikeoutOf(arrival, outcome),
    wildPitchWithStrikeoutOf(arrival, outcome),
  )
}

/**
 * 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 (자동으로 넘긴 타석은 재생 자체가 없다).
 * 볼넷 · 사구면 이 공이 연 밀어내기 판(종류 2)을 재생한다 — 진루는 보통 길과 같다
 */
function unplayedPlaybackOf(progress: TeamGameProgress, outcome: AtBatOutcome, mine: boolean, arrival: PitchArrivalPlay | null) {
  if (!mine) return null
  return homeRunPlaybackOf({ outcome, bases: progress.game.bases, outs: progress.game.outs }) ?? freePassArrivalResultOf(arrival)
}
