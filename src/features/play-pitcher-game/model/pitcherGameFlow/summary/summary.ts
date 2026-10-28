import { resultOf } from '@/entities/game/model/gameState'
import { completeGameRecordIdsOf, gameEndRecordIdsOf } from '@/entities/game/model/gameRecords'
import { ownPositionRecordIdsOf } from '@/entities/game/model/ownPositionRecords'
import { PITCHER_EDITION_MODE, reliefNeverEnteredOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { decisionCodeForMine, gameEndDecisionOf, PITCHER_DECISION_CODE, type PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { evaluatePitcherGame, type PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import { chargeCpuPitcherLine, withOutgoingStamina } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import {
  MY_PITCHER_NUMBER,
  MY_PITCHER_SLOT,
  OPPONENT_PITCHER_NUMBER_BASE,
  TEAMMATE_PITCHER_NUMBER_BASE,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord, recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'
import type { PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow/summary/summaryTypes'

/** 방어율 `0xb6ce8` = 아웃>0 ? min(9999, trunc(실점 × 2700 / 아웃)) : (실점>0 ? 9999 : 0) */
export function earnedRunAverageOf(runsAllowed: number, outsRecorded: number): number {
  if (outsRecorded > 0) return Math.min(9999, Math.trunc((runsAllowed * 2700) / outsRecorded))
  return runsAllowed > 0 ? 9999 : 0
}

export function summaryOf(progress: PitcherGameProgress): PitcherGameSummary {
  const decision = gameEndDecisionOf(progress.decision)
  const decisionCode = myDecisionCodeOf(progress, decision)
  const record: PitcherEvaluationRecord = { ...progress.record, hitByPitch: progress.pitcherRecord.hitByPitch, decisionCode }
  return {
    result: resultOf(progress.game),
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    record,
    pitcherRecord: progress.pitcherRecord,
    pitchCount: progress.pitchCount,
    evaluation: evaluationOf(progress, record),
    decision,
    decisionCode,
    earnedRunAverage: earnedRunAverageOf(progress.runsAllowedByMe, record.outsRecorded),
    seasonDelta: seasonDeltaOf(progress, record, decisionCode),
    stamina: progress.stamina,
    recordIds: gameEndRecordIdsFor(progress),
    hasEntered: progress.hasEntered,
    endedInningIndex: progress.endedInningIndex,
    pitcherStaminas: {
      ours: withOutgoingStamina(progress.ourPitcherStaminas, progress.ourMound),
      opponent: withOutgoingStamina(progress.opponentPitcherStaminas, progress.opponentMound),
    },
    leagueStolenBases: progress.leagueStolenBases ?? [],
    leagueErrors: progress.leagueErrors ?? [],
    leaguePlateAppearances: progress.leaguePlateAppearances ?? [],
    burstRewardDeltas: progress.burstRewardDeltas ?? [],
    ...(progress.opponentRecordMorale === undefined ? {} : { opponentRecordMorale: progress.opponentRecordMorale }),
    leaguePitchers: leaguePitchersOf(progress, decision),
  }
}

/**
 * 경기 끝 0xa7de8 이 승 +0x2e(a7e2a) · 패 +0x2f(a7e70) · 세이브 +0x24(a7ec6)를 `0xa56dc(R, 그 투수, 0)` 이 참일 때만 올리고,
 * 내 투수 칸 R+0x124(1 승 · 2 패 · 3 세이브)는 이어서 `0xa56dc(R, 그 투수, 1)`(a7e46 · a7e8c · a7ede)이 참일 때만 쓴다.
 * 모드 3 갈래 0xa571c 는 포스트시즌 · 국가대항전이면 플래그와 상관없이 거짓 → 그 경기는 승패 · 세이브도 R+0x124 도 안 남는다.
 * (투구 수 +0x28 은 0xa5e14 a5e30 이 게이트 없이 올린다)
 */
function myDecisionCodeOf(progress: PitcherGameProgress, decision: ReturnType<typeof gameEndDecisionOf>): number {
  if (!countsMyPitcherRecord(progress)) return PITCHER_DECISION_CODE.none
  return decisionCodeForMine(decision, { side: progress.game.playerSide, number: MY_PITCHER_NUMBER })
}

function evaluationOf(progress: PitcherGameProgress, record: PitcherEvaluationRecord) {
  const { options } = progress
  return evaluatePitcherGame(record, {
    positionCode: options.positionCode,
    role: options.role,
    won: progress.game.ourScore > progress.game.opponentScore,
    endedInningIndex: progress.endedInningIndex,
    teamBaserunnerAllowed: progress.teamBaserunnerAllowed,
    teamHitsAllowed: progress.teamHitsAllowed,
    teamRunsAllowed: progress.teamRunsAllowed,
    // ⚠️ **원본 빈틈 그대로** — 원본은 `state[0x6a] == state[0x6b]` 한 줄뿐이라 **7회 콜드게임만**
    // "등판 없음" 으로 잡는다. 8회에 콜드게임이 나서 정말로 등판을 못 했어도 이 조건이 서지 않아
    // 구원형 인기도 −2·평판 −2 와 보통 감독 글이 그대로 걸린다 (S5 U-14 4절).
    // 실제로 등판했는지(`hasEntered`)를 함께 보면 그 빈틈이 메워지므로 **일부러 보지 않는다.**
    neverEntered: reliefNeverEnteredOf(progress.endedInningIndex),
    reputation: options.reputation,
    isRivalGame: options.isRivalGame,
    hasLuckSkill: options.hasLuckSkill,
  })
}

function seasonDeltaOf(progress: PitcherGameProgress, record: PitcherEvaluationRecord, decisionCode: number): PitcherGameSummary['seasonDelta'] {
  return {
    // 레코드 +0x20 — 정산 a8cb0 이 사건 목록의 아웃으로 센다 (`settledOutsExtra`)
    outs: record.outsRecorded + (progress.settledOutsExtra ?? 0) + (progress.seasonOutsExtra ?? 0),
    runsAllowed: progress.runsAllowedByMe,
    // 레코드 +0x26 — R+0x134 에 삼진 + 도루 판(종류 5)의 삼진을 더한 값 (`stealPlayStrikeouts`)
    strikeouts: record.strikeouts + (progress.stealPlayStrikeouts ?? 0),
    pitches: progress.pitchCount,
    wins: decisionCode === PITCHER_DECISION_CODE.win ? 1 : 0,
    losses: decisionCode === PITCHER_DECISION_CODE.loss ? 1 : 0,
    saves: decisionCode === PITCHER_DECISION_CODE.save ? 1 : 0,
    walks: progress.freePassesByMe,
  }
}

function leaguePitchersOf(progress: PitcherGameProgress, decision: ReturnType<typeof gameEndDecisionOf>): PitcherGameSummary['leaguePitchers'] {
  const { options } = progress
  const side = progress.game.playerSide
  const withOurMound = chargeCpuPitcherLine(progress.pitcherLines, options.ourTeamId, progress.ourMound.pitcherSlot, {
    pitches: progress.ourMound.pitches,
  })
  return {
    lines: chargeCpuPitcherLine(withOurMound, options.opponentTeamId, progress.opponentMound.pitcherSlot, {
      pitches: progress.opponentMound.pitches,
    }),
    // 판정의 등번호 자리는 표지(`teammatePitcherNumberOf`·`opponentPitcherNumberOf`)라 붙박이 표 칸으로 되돌린다.
    // 내 투수 표지는 표 밖 칸(`MY_PITCHER_SLOT`)이 된다
    decision: { winner: recordSlotOf(decision.winner, side), loser: recordSlotOf(decision.loser, side), save: recordSlotOf(decision.save, side) },
    sideTeams: side === 0 ? [options.ourTeamId, options.opponentTeamId] : [options.opponentTeamId, options.ourTeamId],
  }
}

/** 판정 칸의 표지를 붙박이 표 칸으로 — 내 측이면 동료 표지(나는 `MY_PITCHER_SLOT`), 아니면 상대 표지 */
function recordSlotOf(record: PitcherOfRecord | null, ourSide: number): PitcherOfRecord | null {
  if (record === null) return null
  if (record.side !== ourSide) return { side: record.side, number: OPPONENT_PITCHER_NUMBER_BASE - record.number }
  if (record.number === MY_PITCHER_NUMBER) return { side: record.side, number: MY_PITCHER_SLOT }
  return { side: record.side, number: TEAMMATE_PITCHER_NUMBER_BASE - record.number }
}

/**
 * 경기 끝 0xa7de8 이 더 얹는 기록 — 37~39 점수차 승과 28~31 완투 계열.
 *
 * 투수편은 **모드 3** 이라 0xa7de8 의 `모드 == 4 → 끝` 가지에 걸리지 않는다 →
 * 타자편과 달리 완투 계열이 실제로 나올 수 있다. 나머지 세 조건은 원본 그대로 본다:
 *   ① 사람 팀 승리 ② 사람이 이 경기에서 투구 코스를 한 번이라도 확정함(state+0x8c = 내가 공을 던짐)
 *   ③ 사람 팀 **현재** 투수가 잡은 아웃 == 3 × 치른 이닝 (연장 포함)
 * 피안타·볼넷·실점은 우리 팀 투수 **전체**가 내준 state+0x88·0x89·0x8a 를 쓴다 —
 * 원본도 팀 단위 칸이라 구원으로 올라온 경우엔 ③ 에서 먼저 걸러진다.
 *
 * 강판 뒤에는 `recordsAllowed` 가 닫히므로 이 둘도 들어오지 않는다 (0xa77f0 첫 게이트).
 */
function gameEndRecordIdsFor(progress: PitcherGameProgress): readonly number[] {
  if (!recordsAllowed(progress)) return progress.recordIds
  return [
    ...progress.recordIds,
    // 37~39 점수차 승은 공격 쪽 — B-129 고친 길은 투수에게 안 준다
    ...ownPositionRecordIdsOf(gameEndRecordIdsOf(progress.game.ourScore - progress.game.opponentScore), 'pitcher'),
    ...completeGameRecordIdsOf({
      mode: PITCHER_EDITION_MODE,
      won: progress.game.ourScore > progress.game.opponentScore,
      // state+0x8c 는 코스 확정(0x50e9c)에서만 1 이 된다 — 웹에서는 공을 한 번이라도 던졌는가
      pitchCourseConfirmed: progress.pitchCount > 0,
      // state[0x6b]+1 = 치른 이닝 전부 (연장이면 그만큼 늘어난다)
      inningsPlayed: progress.endedInningIndex + 1,
      // R[3] — 정산 a8f8c 가 사건 목록의 아웃으로 센다 (`settledOutsExtra`)
      outsRecorded: progress.record.outsRecorded + (progress.settledOutsExtra ?? 0),
      hitsAllowed: progress.teamHitsAllowed,
      baserunnerAllowed: progress.teamBaserunnerAllowed,
      runsAllowed: progress.teamRunsAllowed,
    }),
  ]
}
