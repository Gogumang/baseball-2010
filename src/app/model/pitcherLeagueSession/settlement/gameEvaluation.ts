import {
  countCompleteGame,
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
  NO_LAST_EVALUATION,
  type PitcherCareer,
  type PitcherLastGame,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { reliefNeverEnteredOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { advancePitcherStreaks, EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { managerCommentIndexOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 경기 뒤 평가 0xa719c(인기도 0xa690c → 평판 0xa6218 → 사기)는 **정규시즌 경기만** 탄다. 유일한 호출지
 * 0x4ea0c 안 0x4f274 앞에서 0x4f216(L+0xac 국가대항전)·0x4f268(L+0x34 포스트시즌)이 0x4f29a(하루 끝)로
 * 건너뛰고, 이 갈래에는 모드 갈림이 없다(0x4f1a2 의 모드 2 곁가지 뒤 0x4f216 으로 합류) → 모드 3 도 같다.
 * 포스트시즌 표시는 45번째 경기의 하루 끝(0xb818c → 0xb80a8)에야 서므로 그 경기는 평가된다 —
 * 경기 전 커리어(`played.postseason`)로 가른다.
 * 선발형 승리 완투 계열 → +0x1e0/+0x1f0 (0xa690c 안이라 평가가 도는 정규시즌 경기만). 평가가 돈 경기만 S+0x4a · +0x64 · +7 을
 * 덮는다 — 포스트시즌 경기 뒤 116 은 앞 경기 값을 다시 읽는다.
 */
export function evaluatedCareerOf(seasoned: PitcherCareer, { evaluation }: PitcherGameSummary): PitcherCareer {
  const evaluated = gainPitcherMorale(
    gainPitcherReputation(gainPitcherPopularity(seasoned, evaluation.popularityChange), evaluation.reputationChange),
    evaluation.moraleChange,
  )
  const completed = countCompleteGame(evaluated, evaluation.countedCompleteGame)
  return {
    ...completed,
    lastEvaluation: {
      popularityChange: evaluation.popularityChange,
      reputationChange: evaluation.reputationChange,
      moraleChange: evaluation.moraleChange,
    },
  }
}

/** 기록 줄 S+0x1d8 의 이번 경기 값 — 평가 0xa719c 의 모드 3 갈래(a7264~a72da, 모두 strb) */
function thisGameLineOf(summary: PitcherGameSummary) {
  return {
    decisionCode: summary.decisionCode & 0xff,
    outs: summary.record.outsRecorded & 0xff,
    runs: summary.record.runsAllowedField & 0xff,
    strikeouts: summary.record.strikeouts & 0xff,
    walksAndHitByPitch: (summary.record.walksAllowed + summary.record.hitByPitch) & 0xff,
    hitsAllowed: summary.record.hitsAllowed & 0xff,
    pitches: summary.pitchCount & 0xff,
  }
}

/**
 * 기록 줄 S+0x1d8 — 쓰는 곳은 평가 0xa719c 의 모드 3 갈래(a7264~a72da: memset 8 뒤 [0] R+0x124 · [1] R+0x13c · [2] R+0x128 ·
 * [3] R+0x134 · [4] R+0x144+R+0x148 · [5] R+0x12c · [6] R+0x140, 모두 strb)뿐이다(0x1d8 상수를 만드는 자리 전수 — 그 밖은 다른
 * 객체). 포스트시즌 경기는 0x4f268 이 평가를 건너뛰므로 **116 은 앞 평가 경기(정규시즌 마지막 경기)의 줄을 다시 읽는다** —
 * 기록 줄 · 감독 글 38 의 [6] · 0x8a6fc 의 새가슴/더티볼 모두. 원본 그대로. 옛 저장에 앞 줄이 없으면 이 경기 값.
 *
 * 116 진입 0x1278c — 감독 글은 116 이 고른다: 모드 3 표 [−2…6](선발형이면 칸 3~8 두 배, 0x1285a)에서 +0x4a 칸 · 평판 +0x62
 * (평가 뒤 값) 구간(0x128d2) · 38 은 보직(0xb6705) ≠ 0 && state+0x6a == state+0x6b(이 경기) && S+0x1d8[6](투구 수) == 0
 * (12ac4~12afe). 기록 줄은 S+0x1d8 (12a3c~12ac0).
 */
export function pitcherLastGameOf(
  played: PitcherCareer,
  withEvaluation: PitcherCareer,
  summary: PitcherGameSummary,
  gameOptions: PitcherGameOptions,
): PitcherLastGame {
  const isEvaluated = played.postseason === null
  const line = isEvaluated || played.lastGame === undefined ? thisGameLineOf(summary) : played.lastGame
  const neverEntered =
    gameOptions.role !== PITCHER_ROLE.starter && reliefNeverEnteredOf(summary.endedInningIndex) && ((line.pitches ?? 0) & 0xff) === 0
  const lastEvaluation = withEvaluation.lastEvaluation ?? NO_LAST_EVALUATION
  return {
    decisionCode: line.decisionCode,
    outs: line.outs,
    runs: line.runs,
    strikeouts: line.strikeouts,
    walksAndHitByPitch: line.walksAndHitByPitch,
    hitsAllowed: line.hitsAllowed,
    pitches: line.pitches,
    managerCommentIndex: managerCommentIndexOf(
      { role: gameOptions.role, neverEntered, reputation: withEvaluation.reputation, positionCode: gameOptions.positionCode },
      lastEvaluation.popularityChange,
    ),
  }
}

/** 연속 기록 +0x1bc — 0xa719c 모드 3 갈래라 평가가 도는 정규시즌 경기만 잇는다 (`advancePitcherStreaks`) */
export function streaksAfterGameOf(played: PitcherCareer, withEvaluation: PitcherCareer, summary: PitcherGameSummary) {
  if (played.postseason !== null) return withEvaluation.streaks
  return advancePitcherStreaks(played.streaks ?? EMPTY_PITCHER_STREAKS, {
    role: played.role,
    dayCounter: leagueDayCounterOf(played),
    endedInningIndex: summary.endedInningIndex,
    decisionCode: summary.decisionCode,
    strikeouts: summary.record.strikeouts,
  })
}
