import { GAME_RECORD_SIZE } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 평판 평가 16칸 (`SR+0x1a0..0x1af`) — `docs/re/S4-season-reputation.md` **확정**.
 *
 * 채우는 함수는 `0xa3440(SR, k)` 이고, 코드 k(0..14)를 점프표 `0xd7d7c` 로 **오프셋으로 바꿔**
 * `SR[0x1a0+off]++` 만 한다. 값 인자가 없어 **언제나 +1** 이다(삼진이 두 개 나와도 1).
 * 유일한 호출자는 게이트 `0xa755c(ctx, k)` 이고, 지우는 곳은 경기 직전 화면(상태 0xdd)의
 * `0xa3424` = `memset(SR+0x1a0, 0, 16)` 한 곳뿐이다.
 *
 * P4 가 이 16칸의 이름을 못 찾은 이유는 호출이 전부 함수 포인터(`bl 0xca9f8`)였기 때문이다.
 */

/** 기록 코드 k — `0xa755c(ctx, k)` 에 넘기는 값 */
export const SEASON_RECORD_CODE = {
  삼중살: 0,
  벤치클리어링: 1,
  피안타: 2,
  수비실수: 3,
  탈삼진: 4,
  병살: 5,
  내타자삼진: 6,
  안타: 7,
  이루타: 8,
  삼루타: 9,
  솔로홈런: 0xa,
  투런홈런: 0xb,
  쓰리런홈런: 0xc,
  만루홈런: 0xd,
  사이클: 0xe,
} as const
export type SeasonRecordCode = (typeof SEASON_RECORD_CODE)[keyof typeof SEASON_RECORD_CODE]

/**
 * 점프표 `0xd7d7c` 가 만드는 **코드 → 칸** 대응.
 *
 * ⚠️ **원본 버그 그대로**: 코드 4·5 만 서로 뒤집혀 있다 (S4 2b 확정, DECISIONS 2026-09-20).
 * 그래서 **탈삼진(코드 4)이 S[5] 로, 병살(코드 5)이 S[4] 로** 들어가고,
 * 평판식이 `+ S[5]/3`(탈삼진 가산) · `− 2×(S[4]/3)`(병살 감산)을 하므로
 * 결과적으로 **병살을 잡으면 평판이 깎이고 탈삼진이 평판을 올린다.**
 * 표를 뒤집지 않았다면 반대였겠지만 **실행되는 값은 표 그대로**이므로 그대로 옮긴다.
 */
export const RECORD_CODE_TO_SLOT: readonly number[] = [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14]

/** 코드 상한 — `0xa3440` 은 `k > 14` 면 아무것도 하지 않는다 */
export const MAXIMUM_RECORD_CODE = 14
/** S[15] 는 아무도 쓰지 않는다 (지울 때만 16바이트다) */
export const UNUSED_SLOT = 15

/** 경기 직전 화면(상태 0xdd)이 부르는 `0xa3424` = memset 16 */
export function clearSeasonGameRecord(): number[] {
  return Array.from({ length: GAME_RECORD_SIZE }, () => 0)
}

/**
 * 게이트 `0xa755c` 가 보는 "누가 CPU 인가".
 * - 코드 ≤ 5 는 **공격측이 CPU** 일 때만 = 내 팀이 수비·투구 중일 때 나는 사건
 * - 코드 ≥ 6 은 **수비측이 CPU** 일 때만 = 내 팀이 공격 중일 때 나는 사건
 */
export type MySide = '수비' | '공격'

/** 코드가 어느 쪽에서만 기록되는가 */
export function sideOfRecordCode(code: number): MySide {
  return code <= 5 ? '수비' : '공격'
}

/**
 * 기록 한 칸 올리기 — 게이트(`0xa755c`) + 기록(`0xa3440`) 을 합쳐 옮겼다.
 * 게이트에 안 맞으면 아무 일도 없고, 맞으면 해당 칸이 **+1** 된다.
 *
 * 원본 칸은 u8 이고 상한 검사가 없어 255 에서 한 바퀴 돈다 — 한 경기 안에서는 닿지 않지만
 * 원본과 같게 두려고 `& 0xff` 를 남겼다.
 */
export function recordSeasonGameEvent(slots: readonly number[], code: number, mySide: MySide): number[] {
  const next = [...slots]
  if (code < 0 || code > MAXIMUM_RECORD_CODE) return next
  if (sideOfRecordCode(code) !== mySide) return next
  const slot = RECORD_CODE_TO_SLOT[code]
  next[slot] = (next[slot] + 1) & 0xff
  return next
}

/** 완투 뒤 붙는 보너스의 종류 (인기도·평판이 같은 칸을 본다) */
export type CompleteGameKind = '퍼펙트' | '노히트' | '완봉' | '완투' | null

export interface SeasonGameContext {
  /** 상대 득점 R(o) */
  readonly opponentRuns: number
  /** 내 팀 득점 R(u) */
  readonly myRuns: number
  /** 이겼는가 (`0xb69c8`) — ⚠️ 동점이면 칸 0 쪽이 이긴 것으로 본다 */
  readonly won: boolean
  /**
   * 승리 + 정규 완투일 때의 등급. 평판식은 `st+0x69`(정규 마지막 이닝)로 완투를 재고
   * 인기도식은 `st+0x6b`(현재 이닝)로 잰다 — **연장 완투는 인기도만 받는다**(원본 그대로).
   */
  readonly completeGame: CompleteGameKind
}

/** 완투 종류별 평판 가산 (0xa6fd0~) */
const REPUTATION_COMPLETE_GAME: Readonly<Record<Exclude<CompleteGameKind, null>, number>> = {
  퍼펙트: 7,
  노히트: 6,
  완봉: 4,
  완투: 3,
}

/** 안타 합계 t 구간 가산 (0xa70c4~) */
export function hitTotalBonusOf(total: number): number {
  if (total >= 20) return 6
  if (total >= 15) return 4
  if (total >= 10) return 3
  if (total >= 6) return 2
  if (total >= 4) return 1
  return 0
}

/** 점수 s → 등급 g (0xa70f4~0xa7146) */
export function reputationGradeOf(score: number): number {
  if (score <= -4) return -2
  if (score <= -2) return -1
  if (score <= 0) return 0
  if (score <= 2) return 1
  if (score <= 4) return 2
  if (score <= 6) return 3
  if (score <= 8) return 4
  if (score <= 10) return 5
  return 6
}

/** 원본 나눗셈 `0xca739` 는 부호 없는 u8 / 3 이고 결과를 u8 로 자른다 → 버림 */
const dividedByThree = (value: number) => Math.trunc(value / 3)

/**
 * 한 경기의 평판 점수 s — 원본 `0xa6f1c` (S4 4절 · P4 4a).
 *
 * ```
 * R(o) > 4 → s = −4 ; R(o) == 4 → s −= 2 ; 패배 → s −= 2 ; R(o) == 3 → s −= 1
 * s −= S[1]                        ; 벤치클리어링
 * s += S[5] / 3                    ; 탈삼진   ⚠️ 뒤집힌 칸
 * 승리 → s += 2 ; 승리 && 완투 → 퍼펙트 7 / 노히트 6 / 완봉 4 / 그 밖 3
 * s += 4·S[0]                      ; 삼중살
 * s −= 2·(S[4] / 3)                ; 병살     ⚠️ 뒤집힌 칸 — 잡을수록 깎인다
 * s −= S[6] / 3                    ; 내 타자 삼진
 * s += S[10] + 3·S[11] + 4·S[12] + 5·S[13] + 7·S[14] + 2·S[9]
 * t = S[7] + S[8] + S[9] → 구간 가산
 * ```
 * **S[2](피안타)·S[3](수비 실수)·S[15] 는 읽지 않는다** — 적기만 하는 칸이다.
 * 2루타·3루타는 S[7] 과 S[8]/S[9] 를 **둘 다** 올리므로 t 에서 두 번 세어진다(원본 그대로).
 */
export function seasonReputationScoreOf(slots: readonly number[], context: SeasonGameContext): number {
  const s = slots
  let score = 0
  if (context.opponentRuns > 4) score = -4
  else if (context.opponentRuns === 4) score -= 2
  if (!context.won) score -= 2
  if (context.opponentRuns === 3) score -= 1

  score -= s[1]
  score += dividedByThree(s[5])
  if (context.won) {
    score += 2
    if (context.completeGame !== null) score += REPUTATION_COMPLETE_GAME[context.completeGame]
  }

  score += 4 * s[0]
  score -= 2 * dividedByThree(s[4])
  score -= dividedByThree(s[6])

  score += s[10] + 3 * s[11] + 4 * s[12] + 5 * s[13] + 7 * s[14] + 2 * s[9]
  score += hitTotalBonusOf(s[7] + s[8] + s[9])
  return score
}

/** 한 경기 평판 등급 (−2 ~ +6). `SR+0x64` 에 그대로 남고 평판 `SR+0x62` 에 더해진다 */
export function seasonReputationChangeOf(slots: readonly number[], context: SeasonGameContext): number {
  return reputationGradeOf(seasonReputationScoreOf(slots, context))
}
