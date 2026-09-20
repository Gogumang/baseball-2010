import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { isStarterTypePosition } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_ENTRY_USER_EVENT_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import { PITCHER_DECISION_CODE } from '@/features/play-pitcher-game/model/winLossSave'

/**
 * 투수편 **경기 뒤 평가** (binary.mod 인기도 0xa690c · 평판 0xa6218 · 사기 0xa73c4 ·
 * 감독 글 0x1278c — P1 5절 전체, 확정).
 *
 * 순서도 원본 그대로다: **인기도 → 평판 → 사기**. 인기도 함수가 마지막에 `career+0x4a = p` 를 적고
 * 평판·사기가 그 p 를 읽으므로 앞뒤를 바꾸면 값이 달라진다 (P1 5-2 의 정정).
 */

/** 경기 뒤 평가가 읽는 투수 기록 (평가 객체 R 의 칸들) */
export interface PitcherEvaluationRecord {
  /** R+0x12c — 피안타 */
  readonly hitsAllowed: number
  /** R+0x134 — 탈삼진 */
  readonly strikeouts: number
  /** R+0x13c — 잡은 아웃 수 (÷3 = 이닝) */
  readonly outsRecorded: number
  /** R+0x144 — 볼넷 */
  readonly walksAllowed: number
  /** R+0x148 — 사구 */
  readonly hitByPitch: number
  /** R+0x14c — 이어지고 있는 연속 탈삼진 */
  readonly strikeoutCombo: number
  /** R+0x150 — 등판 순간 팀이 앞서고 있었나(세이브 기회) */
  readonly leadingAtEntry: boolean
  /** R+0x154 — 삼자범퇴 이닝 수 */
  readonly perfectInnings: number
  /** R+0x124 — 1 승 · 2 패 · 3 세이브 · 0 없음 */
  readonly decisionCode: number
  /**
   * R+0x128 — 평가 식이 "실점" 처럼 쓰는 칸.
   *
   * ⚠️ **원본 버그 그대로**: 이 칸에 값을 넣는 코드가 원본 어디에도 없다(P1 5-1, 유력).
   * 그래서 **늘 0** 이고, 아래 식의 실점 항은 한 번도 걸리지 않는다 —
   * 그 바람에 **완투 승리가 늘 완봉으로 세어진다.** 기본값 0 을 그대로 쓴다.
   */
  readonly runsAllowedField: number
}

export const EMPTY_PITCHER_EVALUATION_RECORD: PitcherEvaluationRecord = {
  hitsAllowed: 0,
  strikeouts: 0,
  outsRecorded: 0,
  walksAllowed: 0,
  hitByPitch: 0,
  strikeoutCombo: 0,
  leadingAtEntry: false,
  perfectInnings: 0,
  decisionCode: PITCHER_DECISION_CODE.none,
  runsAllowedField: 0,
}

export interface PitcherEvaluationContext {
  /** 포지션 코드 `rec[+0xa] & 0x1f` — 인기도·감독 글이 **≤3 이면 선발형**으로 가른다 */
  readonly positionCode: number
  /** 보직 `rec[+0xb] & 3` — 평판·사기가 본다 */
  readonly role: PitcherRole
  /** 우리 팀이 이겼는가 (0xb69b0 로 읽은 점수 비교) */
  readonly won: boolean
  /** 치른 이닝 `state+0x6b` (0-기준) — 완투 판정 `아웃 == 3·이닝 + 3` 에 쓴다 */
  readonly endedInningIndex: number
  /** state+0x88 우리 투수가 내준 볼넷 · +0x89 피안타 · +0x8a 실점 (완투 계열 판정용) */
  readonly teamWalksAllowed: number
  readonly teamHitsAllowed: number
  readonly teamRunsAllowed: number
  /** 구원이 등판조차 못 했는가 — 원본 `state[0x6a] == state[0x6b]` (P1 5-3·5-5) */
  readonly neverEntered: boolean
  /** 평판 `career+0x62` (0~999) — 평판 꼬리 표와 감독 글 구간이 본다 */
  readonly reputation: number
  /** 라이벌전인가 — 사기 변화가 두 배가 된다 */
  readonly isRivalGame?: boolean
  /** 행운 스킬(0xa4b.., 6)을 가졌는가 — 사기 +1 */
  readonly hasLuckSkill?: boolean
}

const trunc = Math.trunc

/** 완투인가 — `아웃 == 3·(state 이닝) + 3` (0xa6b3a) */
export function isCompleteGame(record: PitcherEvaluationRecord, endedInningIndex: number): boolean {
  return record.outsRecorded === 3 * endedInningIndex + 3
}

/** 정규 경기 아웃 수 — 퍼펙트·노히트 판정이 `아웃 ≤ 27` 을 함께 본다 */
const REGULATION_OUTS = 27

/** 완투 계열 갈래 — 인기도·평판이 각각 다른 점수를 준다 */
export type CompleteGameKind = '퍼펙트' | '노히트' | '완봉' | '완투' | '없음'

export function completeGameKindOf(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
): CompleteGameKind {
  if (!isCompleteGame(record, context.endedInningIndex)) return '없음'
  const noRuns = record.runsAllowedField === 0
  if (
    record.walksAllowed === 0 &&
    record.hitByPitch === 0 &&
    record.hitsAllowed === 0 &&
    noRuns &&
    record.outsRecorded <= REGULATION_OUTS
  ) {
    return '퍼펙트'
  }
  if (record.hitsAllowed === 0 && noRuns) return '노히트'
  return noRuns ? '완봉' : '완투'
}

/* ── 5-3. 인기도 변화 0xa690c (모드 3 가지 0xa6aa4~0xa6ed8) ───────────────────────── */

/** 선발형 점수 s → p (0xa6c9c 계열). 눈금이 두 배라 −2 … 12 다 */
function starterPopularityOf(score: number): number {
  if (score <= -5) return -2
  if (score <= -3) return -1
  if (score <= 0) return 0
  if (score <= 2) return 2
  if (score <= 4) return 4
  if (score <= 6) return 6
  if (score <= 8) return 8
  if (score <= 10) return 10
  return 12
}

/** 구원형 점수 s → p. 타자편과 같은 눈금 −2 … 6 이다 */
function reliefPopularityOf(score: number): number {
  if (score <= -4) return -2
  if (score <= -2) return -1
  if (score <= 0) return 0
  if (score <= 2) return 1
  if (score === 3) return 2
  if (score <= 5) return 3
  if (score <= 7) return 4
  if (score === 8) return 5
  return 6
}

function starterStrikeoutPoints(strikeouts: number): number {
  if (strikeouts > 10) return 6
  if (strikeouts >= 9) return 5
  if (strikeouts >= 7) return 4
  if (strikeouts >= 5) return 3
  if (strikeouts >= 3) return 2
  if (strikeouts >= 1) return 1
  return 0
}

function starterOutPoints(outs: number): number {
  if (outs > 26) return 3
  if (outs >= 24) return 2
  if (outs >= 21) return 1
  if (outs >= 9) return 0
  if (outs >= 6) return -1
  if (outs >= 3) return -2
  return -4
}

/**
 * ⚠️ **원본 그대로**: 실점 항의 비교가 **음수**다 (`≤ −6 → −4 · ≤ −5 → −2 · ≤ −3 → −1`).
 * R+0x128 이 늘 0 이라 한 번도 걸리지 않는다. 식 모양을 그대로 남긴다.
 */
function starterRunPoints(runsAllowedField: number): number {
  if (runsAllowedField <= -6) return -4
  if (runsAllowedField <= -5) return -2
  if (runsAllowedField <= -3) return -1
  return 0
}

function reliefStrikeoutPoints(strikeouts: number): number {
  if (strikeouts > 5) return 6
  if (strikeouts === 5) return 5
  if (strikeouts === 4) return 4
  if (strikeouts === 3) return 3
  if (strikeouts >= 1) return 2
  return 0
}

function reliefInningPoints(outs: number): number {
  const innings = trunc(outs / 3)
  if (innings > 5) return 3
  if (innings === 5) return 2
  if (innings === 4) return 1
  return 0
}

/** 경기 뒤 인기도 변화 p — `career+0x4a` 에 적히고 평판·사기가 읽는다 */
export function popularityChangeOf(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
): number {
  if (isStarterTypePosition(context.positionCode)) {
    const kind = completeGameKindOf(record, context)
    let score = context.won
      ? kind === '퍼펙트' || kind === '노히트'
        ? 6
        : kind === '완봉'
          ? 5
          : kind === '완투'
            ? 3
            : 2
      : -1
    score += starterStrikeoutPoints(record.strikeouts)
    score += starterOutPoints(record.outsRecorded)
    score += starterRunPoints(record.runsAllowedField)
    return starterPopularityOf(score)
  }

  const allowed = record.runsAllowedField
  let score = -(allowed > 4 ? 4 : allowed > 3 ? 2 : allowed > 0 ? 1 : 0)
  score += reliefStrikeoutPoints(record.strikeouts)
  if (record.leadingAtEntry) {
    score += reliefInningPoints(record.outsRecorded)
    if (record.outsRecorded <= 2) score -= 2
    if (!context.won) score -= 4
    if (
      record.decisionCode === PITCHER_DECISION_CODE.win ||
      record.decisionCode === PITCHER_DECISION_CODE.save
    ) {
      score += 3
    }
  } else {
    score += context.won ? 5 : -2
    score += reliefInningPoints(record.outsRecorded)
    if (record.outsRecorded <= 2) score -= 2
  }
  const popularity = reliefPopularityOf(score)
  // 아웃 ≤ 2 이고 등판조차 못 했으면 0 (0xa6ec2)
  return record.outsRecorded <= 2 && context.neverEntered ? 0 : popularity
}

/* ── 5-2. 평판 변화 0xa6218 (모드 3 가지 0xa6374~0xa6684 + 공통 꼬리 0xa6686) ───────── */

/** 평판 구간 보정 가점 표 `0xd82a0` */
export const REPUTATION_GAIN_TABLE: readonly number[] = [90, 70, 50, 20, 10, 0, -5, -10, -15, -20]
/** 평판 구간 보정 감점 표 `0xd82c8` */
export const REPUTATION_PENALTY_TABLE: readonly number[] = [-90, -70, -50, -30, -10, 0, 5, 10, 20, 30]

/** 선발 인기도 p → 평판 가점 r 의 첫 항 (6→2 · 8→4 · 10→6 · 12→8, 그 밖 0) */
function starterReputationFromPopularity(popularity: number): number {
  if (popularity === 6) return 2
  if (popularity === 8) return 4
  if (popularity === 10) return 6
  if (popularity === 12) return 8
  return 0
}

/** 구원 인기도 p → 평판 가점 r 의 첫 항 (3→1 · 4→2 · 5→3 · 6→4) */
function reliefReputationFromPopularity(popularity: number): number {
  if (popularity === 3) return 1
  if (popularity === 4) return 2
  if (popularity === 5) return 3
  if (popularity === 6) return 4
  return 0
}

export interface ReputationParts {
  /** 가점 합 r */
  readonly gain: number
  /** 감점 합 pen (음수) */
  readonly penalty: number
}

/** 선발(보직 0)의 가점·감점 (0xa6374~) */
function starterReputationParts(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
  popularity: number,
): ReputationParts {
  let gain = starterReputationFromPopularity(popularity)
  const combo = record.strikeoutCombo
  if (combo >= 6) gain += 8
  else if (combo >= 4) gain += 6
  else if (combo >= 2) gain += 4

  const strikeouts = record.strikeouts
  if (strikeouts >= 13) gain += 6
  else if (strikeouts >= 9) gain += 4
  else if (strikeouts >= 5) gain += 2

  if (record.perfectInnings > 2) gain += 2
  if (trunc(record.outsRecorded / 3) > 9) gain += 4
  if (record.hitsAllowed <= 3) gain += 3

  if (isCompleteGame(record, context.endedInningIndex)) {
    if (
      context.teamWalksAllowed === 0 &&
      context.teamHitsAllowed === 0 &&
      context.teamRunsAllowed === 0 &&
      record.outsRecorded <= REGULATION_OUTS
    ) {
      gain += 7
    } else if (context.teamHitsAllowed === 0 && context.teamRunsAllowed === 0) gain += 6
    else if (context.teamRunsAllowed === 0) gain += 5
    else gain += 4
  }

  let penalty = 0
  if (record.hitsAllowed > 9) penalty -= 5
  if (trunc(record.outsRecorded / 3) <= 1) penalty -= 2
  if (record.walksAllowed > 2) penalty -= 2
  // ⚠️ R+0x128 이 늘 0 이라 아래 두 줄은 걸리지 않는다 (원본 그대로 남긴다)
  if (record.runsAllowedField > 5) penalty -= 5
  else if (record.runsAllowedField >= 4) penalty -= 3

  return { gain, penalty }
}

/** 구원(보직 ≠ 0)의 가점·감점 (0xa64.. ~ 0xa6684) */
function reliefReputationParts(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
  popularity: number,
): ReputationParts {
  let gain = reliefReputationFromPopularity(popularity)
  const combo = record.strikeoutCombo
  if (combo >= 6) gain += 4
  else if (combo >= 4) gain += 3
  else if (combo >= 2) gain += 2

  const strikeouts = record.strikeouts
  if (strikeouts >= 6) gain += 3
  else if (strikeouts >= 4) gain += 2
  else if (strikeouts >= 2) gain += 1

  if (record.perfectInnings > 0) gain += 1
  if (trunc(record.outsRecorded / 3) > 2) gain += 2
  // ⚠️ 늘 참이다 — R+0x128 이 0 이므로 구원은 공짜로 +1 을 받는다 (원본 그대로)
  if (record.runsAllowedField === 0) gain += 1
  if (record.hitsAllowed === 0) gain += 3
  else if (record.hitsAllowed === 1) gain += 2
  else if (record.hitsAllowed === 2) gain += 1

  let penalty = 0
  if (record.hitsAllowed > 4) penalty -= 3
  if (trunc(record.outsRecorded / 3) <= 0) penalty -= 2
  if (record.runsAllowedField > 3) penalty -= 5
  else if (record.runsAllowedField >= 2) penalty -= 3
  if (record.walksAllowed > 1) penalty -= 2

  // 등판조차 못 했으면 가점·감점이 통째로 없다 (0xa666e)
  return context.neverEntered ? { gain: 0, penalty: 0 } : { gain, penalty }
}

export function reputationPartsOf(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
  popularity: number,
): ReputationParts {
  return context.role === PITCHER_ROLE.starter
    ? starterReputationParts(record, context, popularity)
    : reliefReputationParts(record, context, popularity)
}

/**
 * 공통 꼬리 (0xa6686, 타자편과 같은 코드).
 * ```
 * i = trunc((평판 − 1) / 100)
 * Δ = (r + trunc(r·A[i]/100)) + (pen − trunc(|pen|·B[i]/100))
 * ```
 * 평판이 낮을 때는 가점을 거의 두 배, 감점은 10% 로 줄이고, 높을 때는 반대로 만든다.
 * (웹 타자편 `entities/career/model/gameEvaluation.reputationChangeOf` 에도 이 꼬리가 빠져 있다 —
 *  그쪽은 내 담당이 아니라 건드리지 않는다.)
 */
export function applyReputationTail(parts: ReputationParts, reputation: number): number {
  const index = Math.min(Math.max(trunc((reputation - 1) / 100), 0), REPUTATION_GAIN_TABLE.length - 1)
  const gain = parts.gain + trunc((parts.gain * REPUTATION_GAIN_TABLE[index]) / 100)
  const penalty =
    parts.penalty - trunc((Math.abs(parts.penalty) * REPUTATION_PENALTY_TABLE[index]) / 100)
  return gain + penalty
}

/* ── 5-4. 사기 0xa73c4 ─────────────────────────────────────────────────────────── */

/**
 * 사기 변화. 투수편 **선발만** 한 줄이 더 있다 — p 를 반으로 줄여 타자 눈금과 맞춘다 (0xa73e6).
 */
export function moraleChangeOf(context: PitcherEvaluationContext, popularity: number): number {
  let change = context.won ? 5 : -7
  if (context.isRivalGame === true) change *= 2
  let p = popularity
  if (context.role === PITCHER_ROLE.starter && p > 0) p = trunc(p / 2)
  if (change < 0 && p > 1) change += trunc(p / 2)
  if (context.hasLuckSkill === true) change += 1
  return change
}

/* ── 5-5. 감독 평가 글 0x1278c ──────────────────────────────────────────────────── */

/** 평판 구간 문턱 표 `0xcc562` */
export const MANAGER_TEXT_REPUTATION_LIMITS: readonly number[] = [150, 450, 750, 1000]
/** 등급 표 `0xcc558` */
export const MANAGER_TEXT_GRADES: readonly number[] = [-2, -1, 0, 1, 2, 3, 4, 5, 6]
/** 선발형이면 칸 3~8 이 두 배가 된다 (0x1285a) — 선발 p 눈금과 맞춘다 */
export const MANAGER_TEXT_GRADES_STARTER: readonly number[] = [-2, -1, 0, 2, 4, 6, 8, 10, 12]
/** 모드 3(투수) 의 구간 시작 번호 (0x128ac 가 스택에 직접 쓴다) */
export const MANAGER_TEXT_SECTION_STARTS: readonly number[] = [2, 11, 20, 29]

/**
 * 경기 뒤 감독 평가 글 StrUSER_EVT 번호.
 *
 * 구원이 등판조차 못 했으면 **38 "오늘은 등판할 기회가 없었구나."** 다 (0x12ac4).
 * 선발에는 38 이 나오지 않는다.
 *
 * 원본 조건은 세 가지다: 보직 ≠ 0 · `state+0x6a == state+0x6b` · **"결과 칸(+6) == 0"**.
 * 셋째 칸이 무엇인지는 P1 5-5 도 이름을 적지 않았다 — **값이 없어 검사에서 뺀다.**
 * (그 상황이면 인기도 p 도 0 이 되므로(5-3) 실제 결과는 같을 것으로 본다 — 추정.)
 */
export function managerCommentIndexOf(
  context: PitcherEvaluationContext,
  popularity: number,
): number {
  if (context.role !== PITCHER_ROLE.starter && context.neverEntered) {
    return NO_ENTRY_USER_EVENT_INDEX
  }
  const section = MANAGER_TEXT_REPUTATION_LIMITS.findIndex((limit) => context.reputation < limit)
  const sectionIndex = section < 0 ? MANAGER_TEXT_SECTION_STARTS.length - 1 : section
  const grades = isStarterTypePosition(context.positionCode)
    ? MANAGER_TEXT_GRADES_STARTER
    : MANAGER_TEXT_GRADES
  const slot = grades.indexOf(popularity)
  return MANAGER_TEXT_SECTION_STARTS[sectionIndex] + (slot < 0 ? 0 : slot)
}

/* ── 한꺼번에 ─────────────────────────────────────────────────────────────────── */

export interface PitcherGameEvaluation {
  /** `career+0x4a` 에 적히는 이번 경기 인기도 변화 p */
  readonly popularityChange: number
  /** `career+0x64` 에 적히는 평판 변화 Δ */
  readonly reputationChange: number
  /** 사기 변화 */
  readonly moraleChange: number
  /** StrUSER_EVT 번호 */
  readonly managerCommentIndex: number
  readonly completeGame: CompleteGameKind
}

export function evaluatePitcherGame(
  record: PitcherEvaluationRecord,
  context: PitcherEvaluationContext,
): PitcherGameEvaluation {
  const popularityChange = popularityChangeOf(record, context)
  const parts = reputationPartsOf(record, context, popularityChange)
  return {
    popularityChange,
    reputationChange: applyReputationTail(parts, context.reputation),
    moraleChange: moraleChangeOf(context, popularityChange),
    managerCommentIndex: managerCommentIndexOf(context, popularityChange),
    completeGame: completeGameKindOf(record, context),
  }
}
