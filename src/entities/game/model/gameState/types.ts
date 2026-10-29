import type { BaseState } from '@/entities/game/model/baseState'
import type { BaseRunners } from '@/entities/game/model/baseRunners'

export const INNINGS_PER_GAME = 9
export const BATTING_ORDER_SIZE = 9
export const OUTS_PER_HALF_INNING = 3

/** 경기 끝 판정 0xb68fc 가 보는 칸 — 이닝(1부터) · 공격 반(state[9]) · 아웃(state[6]) · 두 팀 점수(st+0x7e 원정 · +0x7f 홈) */
export interface GameEndSituation {
  readonly inning: number
  readonly half: InningHalf
  readonly outs: number
  readonly awayScore: number
  readonly homeScore: number
}
/** 타순을 따로 주지 않을 때의 플레이어 타순 칸(3번). 나만의리그는 커리어 타순을 쓴다. */
export const PLAYER_BATTING_ORDER_INDEX = 2

export type InningHalf = '초' | '말'

/**
 * 사람이 맡는 측 — 원본 설정 레코드 `+8` 이 정한다 (0x30f44·0x30f50 이 읽고, `state[0x31+측] = 0` 으로 적는다).
 * 경기 상태 초기화 `0xb6814` 가 `state[9] = 0`(공격) · `state[0xa] = 1`(수비) 로 시작하므로
 * **측 0 = 1회 초 공격 = 선공** · **측 1 = 후공(홈)** 이다.
 *
 * 일반모드는 이 칸이 **반반**이고(빠른실행 `0x3123c` 가 `bfa54(0,2) != 0`), **대전모드만 늘 측 1**
 * 로 박혀 있다(`0x30c86` 이 `rec[8] = 1` 을 되써 넣는다).
 * 나만의리그는 지금까지 늘 후공으로 돌려 왔으므로 **기본값**만 측 1 로 두고 박아 두지는 않는다.
 */
export type PlayerSide = 0 | 1
/** 측 0 — 사람이 선공(초에 공격) */
export const PLAYER_SIDE_FIRST_BAT: PlayerSide = 0
/** 측 1 — 사람이 후공(말에 공격, 홈) */
export const PLAYER_SIDE_LAST_BAT: PlayerSide = 1

export interface GameState {
  readonly inning: number
  readonly half: InningHalf
  readonly outs: number
  readonly bases: BaseState
  /**
   * **루에 선 주자의 신원**(공격 팀 타순 칸) — 원본 주자 목록(sim+0x80, `baseRunners.ts`). 루 상황(`bases`)과 어긋나거나 없으면
   * (옛 저장 · 신원을 안 고친 길) 예전 근사(지금 타순에서 거꾸로 센다)로 본다 — `runnersOfGame`.
   */
  readonly runners?: BaseRunners
  readonly ourScore: number
  readonly opponentScore: number
  /** 우리 팀 타순 커서. 이닝이 바뀌어도 이어진다. */
  readonly battingOrderIndex: number
  /** 플레이어가 서는 타순 칸 (0 = 1번) */
  readonly playerOrderIndex: number
  /** 사람이 맡는 측 (0 선공 · 1 후공) — 원본 설정 레코드 +8 */
  readonly playerSide: PlayerSide
  readonly isFinished: boolean
  /**
   * **이닝별 점수 칸** st[0x6c..] (0xb6989) — 이닝별 점수판 0x41c18 이 읽는다. 득점 0xb6a9c 가 한 점마다 지금 이닝 칸을 98 이하일 때만 +1.
   * 측(0 원정 · 1 홈)마다 이닝 순서(1회 = 0)대로 든다 — 원본은 아홉 칸을 이닝 mod 9 로 돌려 쓰고 반 이닝 넘김 0xb6b6c 가 말 끝에
   * 새 이닝 두 칸을 0 으로 지우므로, 판이 보이는 아홉 이닝(지금 − 8 ~ 지금)의 칸 값은 이 기록과 같다(`lineScoreSlotsOf`).
   * 안 든 상태(옛 저장 · 시험의 손 만든 판)는 0 으로 본다.
   */
  readonly inningRuns?: InningRunsBoard
}

/** 이닝별 점수 칸 — `GameState.inningRuns` */
export interface InningRunsBoard {
  readonly runs: readonly [readonly number[], readonly number[]]
  /** 경기가 끝난 반 이닝의 공격 측 st[9] — 경기 끝(0x18)은 반 이닝 넘김(0xb6b6c)을 안 해 그 값이 남는다 */
  readonly finalOffenseSide?: 0 | 1
}

/** `applyAtBatOutcome` 의 주자 신원 실마리 */
export interface RunnerHint {
  readonly runners?: BaseRunners
  readonly survivorsFromBase?: readonly number[]
}

export type GameResult = '승' | '무' | '패'
