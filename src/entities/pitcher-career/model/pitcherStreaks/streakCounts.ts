import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * **투수편 연속 기록** — 모드 레코드 `0x1f8d5(전역, 3)` 의 `+0x1bc` u8 세 칸 (타자편 `PlayerCareer.streaks` 와 같은 칸).
 *
 * - 잇기: 경기 뒤 평가 0xa719c 의 모드 3 갈래(a7264~a7386)가 `0xa4ce0(S, 칸, 참?)` — 참이면 +1(u8), 아니면 0.
 *   평가가 도는 **정규시즌 경기만** 잇는다(유일한 호출지 0x4ea0c 가 포스트시즌 0x4f268 에서 건너뛴다).
 * - 지우기: 새 시즌 0x1b768 의 0x1b882 `memset(S+0x1bc, 0, 4)`.
 * - 읽기: 116 진입이 부르는 0x8a6fc(8a8d4~8af8c)가 표와 견줘 알림 줄과 **보상 명령**(종류 7)을 내장 이벤트에 쌓는다 —
 *   보상은 114 가 그 이벤트를 틀 때 먹는다(`pitcherStreakEventOf`).
 */
export interface PitcherStreaks {
  /** +0x1bc — 선발: 승리 · 구원: 승리 또는 세이브 */
  readonly win: number
  /** +0x1bd — 선발: 5탈삼진 이상 · 구원: 2탈삼진 이상 */
  readonly strikeout: number
  /** +0x1be — 패배 */
  readonly loss: number
}

export const EMPTY_PITCHER_STREAKS: PitcherStreaks = { win: 0, strikeout: 0, loss: 0 }

/** R+0x124 판정 코드 */
const DECISION_WIN = 1
const DECISION_LOSS = 2
const DECISION_SAVE = 3
/** 선발 탈삼진 문턱 `cmp 4; bgt` · 구원 `cmp 1; bgt` */
const STARTER_STRIKEOUT_ABOVE = 4
const RELIEF_STRIKEOUT_ABOVE = 1
/** 구원은 `state+0x6b > 6` 일 때만 잇는다 (a7328~a7336) */
const RELIEF_STREAK_INNING_ABOVE = 6

export interface PitcherStreakGame {
  /** 보직 `0xb6705` = 내 투수 레코드 `+0xb & 3` */
  readonly role: PitcherRole
  /** 날짜 카운터 g = `0x1fa2d(전역)+0xb2` — 평가는 하루 끝(0xb818c) 앞이라 오늘의 g 다 */
  readonly dayCounter: number
  /** 경기 끝 이닝 `[0x1552d0c]+0x6b` (0-기준) */
  readonly endedInningIndex: number
  /** R+0x124 */
  readonly decisionCode: number
  /** R+0x134 */
  readonly strikeouts: number
}

const step = (count: number, on: boolean) => (on ? (count + 1) & 0xff : 0)

/**
 * 0xa719c 모드 3 갈래의 연속 기록 잇기 (직접 떴다):
 * ```
 * 보직 == 0:  g(0x1fa2d+0xb2) 비트0 이 서 있으면(홀수 날 — 선발 아닌 날) 건너뜀 (a72ee~a72fe)
 *             [0] 판정 == 1 · [1] 탈삼진 > 4 · [2] 판정 == 2
 * 보직 != 0:  (s8)state+0x6b ≤ 6 이면 건너뜀 (a7328~a7336)
 *             [0] 판정 == 3 || 판정 == 1 · [1] 탈삼진 > 1 · [2] 판정 == 2
 * ```
 */
export function advancePitcherStreaks(streaks: PitcherStreaks, game: PitcherStreakGame): PitcherStreaks {
  if (game.role === PITCHER_ROLE.starter) {
    if ((game.dayCounter & 1) !== 0) return streaks
    return {
      win: step(streaks.win, game.decisionCode === DECISION_WIN),
      strikeout: step(streaks.strikeout, game.strikeouts > STARTER_STRIKEOUT_ABOVE),
      loss: step(streaks.loss, game.decisionCode === DECISION_LOSS),
    }
  }
  if (!(game.endedInningIndex > RELIEF_STREAK_INNING_ABOVE)) return streaks
  return {
    win: step(streaks.win, game.decisionCode === DECISION_SAVE || game.decisionCode === DECISION_WIN),
    strikeout: step(streaks.strikeout, game.strikeouts > RELIEF_STRIKEOUT_ABOVE),
    loss: step(streaks.loss, game.decisionCode === DECISION_LOSS),
  }
}
