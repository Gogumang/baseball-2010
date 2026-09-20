import {
  MORALE_LIMIT,
  POPULARITY_LIMIT,
  REPUTATION_LIMIT,
  clampTo,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { seasonReputationChangeOf } from '@/entities/season-mode/model/seasonReputation'
import type { CompleteGameKind, SeasonGameContext } from '@/entities/season-mode/model/seasonReputation'

/**
 * 시즌모드 경기 뒤 팀 평가 — 인기도 `0xa6734` · 평판 `0xa6f1c` · 사기 `0xa7442`.
 * 부르는 곳은 경기 끝 `0x4ea0c → 0x4f274 → 0xa719c` 의 **모드 2 갈래 `0xa7442`** 이고,
 * 조건은 `[obj+0x1c](=SR) ≠ 0` 뿐이라 **정규시즌·포스트시즌·국가대항전을 가리지 않는다**.
 * 근거: `docs/re/P4-season-flow.md` 4a 절 (확정).
 */

/**
 * 완투 판정 — 사람 팀 현재 투수의 아웃 수 `p[3]` 이 `이닝×3+3` 과 같은가.
 *
 * ⚠️ **인기도와 평판이 서로 다른 칸을 본다** (원본 그대로):
 * 인기도는 `st+0x6b`(현재 이닝), 평판은 `st+0x69`(정규 마지막 이닝, 기본 8).
 * 그래서 **연장 완투는 인기도만 보너스를 받는다** (P4 "원본 버그·이상" 3번).
 */
export interface CompleteGameFlags {
  /** `st+0x88` — 출루를 허용했는가 */
  readonly allowedBaserunner: boolean
  /** `st+0x89` — 안타를 맞았는가 */
  readonly allowedHit: boolean
  /** `st+0x8a` — 점수를 줬는가 */
  readonly allowedRun: boolean
}

const kindOf = (flags: CompleteGameFlags): CompleteGameKind => {
  if (!flags.allowedBaserunner && !flags.allowedHit && !flags.allowedRun) return '퍼펙트'
  if (!flags.allowedHit && !flags.allowedRun) return '노히트'
  if (!flags.allowedRun) return '완봉'
  return '완투'
}

/** 퍼펙트로 치는 아웃 수 상한 — 인기도식에만 있다 (`아웃 ≤ 27`) */
export const PERFECT_OUT_LIMIT = 27

/** 인기도용 완투 판정 (`아웃 == 현재이닝×3+3`, 퍼펙트는 아웃 ≤ 27 도 봐야 한다) */
export function popularityCompleteGameOf(
  outs: number,
  currentInningIndex: number,
  flags: CompleteGameFlags,
): CompleteGameKind {
  if (outs !== currentInningIndex * 3 + 3) return null
  const kind = kindOf(flags)
  if (kind === '퍼펙트' && outs > PERFECT_OUT_LIMIT) return '노히트'
  return kind
}

/** 평판용 완투 판정 (`아웃 == 정규 마지막 이닝×3+3`) */
export function reputationCompleteGameOf(
  outs: number,
  lastRegularInningIndex: number,
  flags: CompleteGameFlags,
): CompleteGameKind {
  return outs === lastRegularInningIndex * 3 + 3 ? kindOf(flags) : null
}

/**
 * 인기도 변화 d — 원본 `0xa6734` (P4 4a 확정).
 * ```
 * 패배 : d = −2
 * 승리 : 완투면 퍼펙트 8 / 노히트 7 / 완봉 6 / 그 밖 5, 완투가 아니면 4
 * 내 득점  : >15 +4 | 10~15 +3 | 6~9 +2 | 3~5 +1 | 0 −1
 * 상대 득점: >9 −5 | 6~9 −4 | 3~5 −3
 * ```
 * 범위는 [−8, +12]. 결과는 `SR+0x4a`(직전 경기 인기도 평가)에 남고, 그 칸을
 * 다음 경기의 관중 수 계산이 읽는다.
 */
export function popularityChangeOf(
  won: boolean,
  myRuns: number,
  opponentRuns: number,
  completeGame: CompleteGameKind,
): number {
  let d: number
  if (!won) d = -2
  else if (completeGame === '퍼펙트') d = 8
  else if (completeGame === '노히트') d = 7
  else if (completeGame === '완봉') d = 6
  else if (completeGame === '완투') d = 5
  else d = 4

  if (myRuns > 15) d += 4
  else if (myRuns >= 10) d += 3
  else if (myRuns >= 6) d += 2
  else if (myRuns >= 3) d += 1
  else if (myRuns === 0) d -= 1

  if (opponentRuns > 9) d -= 5
  else if (opponentRuns >= 6) d -= 4
  else if (opponentRuns >= 3) d -= 3

  return d
}

/** 라이벌 표 `0xd8a90` (s8 쌍, 순서 무관) */
export const RIVAL_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 7],
  [3, 6],
  [4, 5],
  [8, 9],
]

/** 라이벌전인가 — `0xb8f68(팀 st+0x28, 팀 st+0x29)` */
export function isRivalGame(teamA: number, teamB: number): boolean {
  return RIVAL_PAIRS.some(([a, b]) => (a === teamA && b === teamB) || (a === teamB && b === teamA))
}

/** 기본 사기 변화 — 승 +5 / 패 −10 */
export const MORALE_ON_WIN = 5
export const MORALE_ON_LOSS = -10

/** 사기 변화 d — 라이벌전이면 두 배가 된다 (승 +10 / 패 −20) */
export function moraleChangeOf(won: boolean, rival: boolean): number {
  const d = won ? MORALE_ON_WIN : MORALE_ON_LOSS
  return rival ? d * 2 : d
}

export interface SeasonGameEvaluationInput {
  readonly myRuns: number
  readonly opponentRuns: number
  /** `0xb69c8` — ⚠️ **동점이면 칸 0(먼저 공격한 쪽)이 이긴 것으로 본다**(원본 그대로) */
  readonly won: boolean
  /** 인기도용 완투 등급 (`popularityCompleteGameOf`) */
  readonly popularityCompleteGame: CompleteGameKind
  /** 평판용 완투 등급 (`reputationCompleteGameOf`) */
  readonly reputationCompleteGame: CompleteGameKind
  /** 상대 팀 번호 — 라이벌 판정에 쓴다 */
  readonly opponentTeamId: number
}

export interface SeasonGameEvaluation {
  readonly popularityChange: number
  readonly reputationChange: number
  readonly moraleChange: number
}

/** 경기 한 판의 평가값 세 개 (인기도·평판·사기) */
export function evaluateSeasonGame(
  record: SeasonRecord,
  input: SeasonGameEvaluationInput,
): SeasonGameEvaluation {
  const context: SeasonGameContext = {
    opponentRuns: input.opponentRuns,
    myRuns: input.myRuns,
    won: input.won,
    completeGame: input.reputationCompleteGame,
  }
  return {
    popularityChange: popularityChangeOf(
      input.won,
      input.myRuns,
      input.opponentRuns,
      input.popularityCompleteGame,
    ),
    reputationChange: seasonReputationChangeOf(record.gameRecord, context),
    moraleChange: moraleChangeOf(input.won, isRivalGame(record.teamId, input.opponentTeamId)),
  }
}

/**
 * 평가를 실제로 적용한다 — 원본 순서는 인기도 → 평판 → 사기다.
 * 상한: 인기도 9999 · 평판 999 · 사기 0~100.
 *
 * 평판 기록 16칸(`gameRecord`)은 여기서 지우지 않는다 — 원본은 **경기 직전 화면(상태 0xdd)**
 * 에서만 지우므로(0xa3424), 경기를 안 하고 화면만 드나들어도 0 이 된다.
 */
export function applySeasonGameEvaluation(state: SeasonState, evaluation: SeasonGameEvaluation): SeasonState {
  const { record } = state
  return {
    ...state,
    record: {
      ...record,
      popularity: clampTo(record.popularity + evaluation.popularityChange, POPULARITY_LIMIT),
      lastPopularityChange: evaluation.popularityChange,
      reputation: clampTo(record.reputation + evaluation.reputationChange, REPUTATION_LIMIT),
      lastReputationGrade: evaluation.reputationChange,
      lastMoraleChange: evaluation.moraleChange,
    },
    teamMorale: clampTo(state.teamMorale + evaluation.moraleChange, MORALE_LIMIT),
  }
}
