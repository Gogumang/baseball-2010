import { BALANCE } from '@/shared/config/original/balance'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { advanceRunners, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'

export const INNINGS_PER_GAME = 9
/*
 * **연장 상한은 없다** (E 3d 확정 · 경기 끝 판정 0xb68fc 직접 떴다) — 동점이면 점수가 갈릴 때까지 돈다.
 * b691e 이닝(s8 st+0x6b) < st+0x69(8) 이면 끝 아님 · 말 아웃 > 2 → 점수가 다르면 끝(b6934) · 그 밖은 홈이 앞설 때(b6942)와
 * 콜드(b694c 이닝 > 5 · 10점 차 — 동점일 수 없다)뿐이고, 이닝 넘김 0xb6b6c 도 막는 값이 없다. 그래서 사람 경기(모든 모드)는
 * 동점으로 끝나지 않는다. 예전 웹의 30회 안전망(`MAXIMUM_INNINGS`)과 그때의 무승부는 원본에 없어 뺐다.
 * (14회 분기는 상한이 아니라 "15회에 스윙 강제"(0xc26e0, 0-기준 0xe)였다.)
 */
/** 콜드게임 — 7회(이닝 인덱스 > 5) 이후 10점 차 (0xb68fc) */
const COLD_GAME_FROM_INNING = BALANCE.coldGame.fromInning
const COLD_GAME_MARGIN = BALANCE.coldGame.margin
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

/**
 * **경기 끝 판정 0xb68fc 그대로** (직접 뜬 것). CPU 끼리 경기 고리(0xc2a48 등 `do 0xc262c while 0xc2198`)와
 * 사람 경기의 자동진행은 **타석(0xc262c 한 번 = 타자가 바뀔 때까지의 공 고리)마다** 0xc2198 머리 c21d6 에서 이것을 본다 —
 * 3아웃이 된 타석 뒤에도 반 이닝 넘김 0xb6b6c(c21fc)보다 먼저다.
 * ```
 * b691e  이닝 index(st+0x6b) ≥ st+0x69(8):
 * b6928    말: 아웃 > 2 → 점수가 다르면 끝(b6934) ; 아웃 ≤ 2 → 홈 > 원정이면 끝(b6942 — 끝내기)
 * b693a    초: 아웃 > 2 → 홈 > 원정이면 끝 ; 아웃 ≤ 2 → 아님
 * b694c  이닝 index > 5 (콜드):
 * b6956    말: 아웃 > 2 && 원정 ≥ 홈 + 10 → 끝 ; 그리고(아웃과 무관하게) b6976 홈 ≥ 원정 + 10 → 끝
 * b696e    초: 아웃 ≤ 2 → 아님 ; 아웃 > 2 → b6976 홈 ≥ 원정 + 10 → 끝
 * ```
 * 곧 **초 공격 중에는 콜드가 없다** — 원정이 10점 앞서도 말 3아웃(b6962)까지 간다. 말 공격 중의 홈 10점 차만 곧바로 끝난다.
 */
export function isGameOverAt(situation: GameEndSituation): boolean {
  const { inning, half, outs, awayScore, homeScore } = situation
  const threeOuts = outs >= OUTS_PER_HALF_INNING
  if (inning >= INNINGS_PER_GAME) {
    if (half === '말' && (threeOuts ? awayScore !== homeScore : homeScore > awayScore)) return true
    if (half === '초' && threeOuts && homeScore > awayScore) return true
  }
  if (inning >= COLD_GAME_FROM_INNING) {
    if (half === '말' && threeOuts && awayScore >= homeScore + COLD_GAME_MARGIN) return true
    if ((half === '말' || threeOuts) && homeScore >= awayScore + COLD_GAME_MARGIN) return true
  }
  return false
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

/** 0xb6a9c 의 `cmp #0x62; bgt` — 98 이하일 때만 칸을 올린다 */
const INNING_RUNS_RAISE_LIMIT = 0x62

/** 0xb6a9c 를 `runs` 번 — 측 `side` 의 지금 이닝 칸 (자동진행 중계 칸이 반 이닝 도중의 판을 그릴 때도 쓴다) */
export function withInningRuns(game: GameState, side: number, runs: number): GameState {
  if (runs <= 0) return game
  const board = game.inningRuns ?? { runs: [[], []] }
  const row = [...board.runs[side === 1 ? 1 : 0]]
  const index = game.inning - 1
  let cell = row[index] ?? 0
  for (let run = 0; run < runs; run += 1) if (cell <= INNING_RUNS_RAISE_LIMIT) cell += 1
  for (let fill = row.length; fill < index; fill += 1) row[fill] = 0
  row[index] = cell
  const next: readonly [readonly number[], readonly number[]] = side === 1 ? [board.runs[0], row] : [row, board.runs[1]]
  return { ...game, inningRuns: { ...board, runs: next } }
}

/** 경기가 끝난 그 반 이닝의 공격 측을 남긴다 — 0x18 은 넘김을 안 한다 */
function withFinalOffenseSide(game: GameState, side: 0 | 1): GameState {
  if (!game.isFinished) return game
  return { ...game, inningRuns: { runs: game.inningRuns?.runs ?? [[], []], finalOffenseSide: side } }
}

const halfSideOf = (half: InningHalf): 0 | 1 => (half === '초' ? 0 : 1)

/**
 * 점수판 0x41c18 이 보는 판 값 — st[0x6b](0 부터 센 이닝) · st[9](공격 측) · 칸 st[0x6c..](이닝 mod 9) · 합 0xb69b0(98 상한 → 99).
 * 경기가 끝났으면 st[9] 는 끝난 반 이닝의 측이다.
 */
export function lineScoreSlotsOf(game: GameState): {
  readonly inning: number
  readonly offenseSide: 0 | 1
  readonly inningRuns: readonly [readonly number[], readonly number[]]
  readonly totals: readonly [number, number]
} {
  const inning = game.inning - 1
  const offenseSide = game.isFinished && game.inningRuns?.finalOffenseSide !== undefined
    ? game.inningRuns.finalOffenseSide
    : halfSideOf(game.half)
  const slotsOf = (side: 0 | 1) => {
    const slots = Array.from({ length: 9 }, () => 0)
    const row = game.inningRuns?.runs[side] ?? []
    for (let index = Math.max(0, inning - 8); index <= inning; index += 1) slots[index % 9] = row[index] ?? 0
    return slots
  }
  const away = game.playerSide === PLAYER_SIDE_LAST_BAT ? game.opponentScore : game.ourScore
  const home = game.playerSide === PLAYER_SIDE_LAST_BAT ? game.ourScore : game.opponentScore
  // 합 st[0x7e + s] 도 0xb6a9c 가 98 이하일 때만 올린다
  const capped = (score: number) => Math.min(score, INNING_RUNS_RAISE_LIMIT + 1)
  return { inning, offenseSide, inningRuns: [slotsOf(0), slotsOf(1)], totals: [capped(away), capped(home)] }
}

export function createGame(
  playerOrderIndex = PLAYER_BATTING_ORDER_INDEX,
  playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT,
): GameState {
  return {
    inning: 1,
    half: '초',
    outs: 0,
    bases: EMPTY_BASES,
    ourScore: 0,
    opponentScore: 0,
    battingOrderIndex: 0,
    playerOrderIndex,
    playerSide,
    isFinished: false,
  }
}

/** 우리가 공격하는 반 이닝 — 측 0 이면 초, 측 1 이면 말 */
export function ourHalfOf(game: GameState): InningHalf {
  return game.playerSide === PLAYER_SIDE_FIRST_BAT ? '초' : '말'
}

/** 상대가 공격하는 반 이닝 */
export function opponentHalfOf(game: GameState): InningHalf {
  return game.playerSide === PLAYER_SIDE_FIRST_BAT ? '말' : '초'
}

/** 홈(말 공격) 팀 점수 — 측 1 이면 우리, 측 0 이면 상대다 */
function homeScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.ourScore : game.opponentScore
}

/** 원정(초 공격) 팀 점수 */
function awayScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.opponentScore : game.ourScore
}

export function isPlayerTurn(game: GameState): boolean {
  return (
    !game.isFinished &&
    game.half === ourHalfOf(game) &&
    game.battingOrderIndex === game.playerOrderIndex
  )
}

/**
 * 상대 공격 한 이닝의 득점을 한 번에 반영하고 우리 공격으로 넘긴다.
 * **상대가 공격하는 반 이닝은 측이 정한다** — 사람이 후공(측 1)이면 초, 선공(측 0)이면 말이다.
 */
export function applyOpponentInning(game: GameState, runs: number): GameState {
  if (game.isFinished || game.half !== opponentHalfOf(game)) return game

  const scored: GameState = withInningRuns({ ...game, opponentScore: game.opponentScore + runs }, 1 - game.playerSide, runs)
  return game.half === '초' ? endTopHalf(scored) : endBottomHalf(scored)
}

/**
 * 우리 공격에서 타석 하나의 결과를 반영한다. 3아웃이면 반 이닝을 넘긴다.
 * **우리가 공격하는 반 이닝은 측이 정한다** (측 0 선공 = 초 · 측 1 후공 = 말).
 *
 * `precomputed` 를 주면 주자 처리를 그 결과로 대신한다 — 사람 경기에서 수비 시뮬레이션
 * (`features/defense-play`)이 정한 아웃·득점·루 상황을 그대로 넣는 자리다.
 * 안 주면 지금까지처럼 `baseState.advanceRunners` 의 근사를 쓴다 (미션·투수편이 그 길을 쓴다).
 */
export function applyAtBatOutcome(
  game: GameState,
  outcome: AtBatOutcome,
  precomputed?: AdvanceResult,
): GameState {
  if (game.isFinished || game.half !== ourHalfOf(game)) return game

  const advance = precomputed ?? advanceRunners(game.bases, outcome, game.outs)
  const outs = game.outs + advance.outsAdded
  const afterAtBat: GameState = withInningRuns(
    {
      ...game,
      outs,
      bases: advance.bases,
      ourScore: game.ourScore + advance.runsScored,
      battingOrderIndex: (game.battingOrderIndex + 1) % BATTING_ORDER_SIZE,
    },
    game.playerSide,
    advance.runsScored,
  )

  // 타석마다 경기 끝 판정 0xb68fc (`isGameOverAt`) — 3아웃 전에는 말 공격 중의 끝내기(9회 이후 홈 > 원정)와
  // 콜드(7회 이후 홈 ≥ 원정 + 10)만 선다. 초 공격 중에는 원정이 10점 앞서도 끝나지 않는다(b696e) — 예전 웹은 공격 중인
  // 우리가 10점 앞서면 초에도 끝냈다. 3아웃이면 아래 반 이닝 넘김이 같은 판정을 아웃 3 으로 본다
  if (outs < OUTS_PER_HALF_INNING) {
    return isGameOverAt(endSituationOf(afterAtBat))
      ? withFinalOffenseSide({ ...afterAtBat, isFinished: true }, halfSideOf(game.half))
      : afterAtBat
  }
  return game.half === '초' ? endTopHalf(afterAtBat) : endBottomHalf(afterAtBat)
}

/** 경기 상태를 0xb68fc 가 보는 칸으로 — 측으로 원정 · 홈 점수를 가른다. `outs` 를 주면 그 아웃 수로 본다 */
export function endSituationOf(game: GameState, outs = game.outs): GameEndSituation {
  return { inning: game.inning, half: game.half, outs, awayScore: awayScoreOf(game), homeScore: homeScoreOf(game) }
}

/**
 * 초가 끝났다 — 0xb68fc 를 아웃 3 으로: 마지막 이닝 이후 홈팀이 앞서면 말 공격 없이 끝난다.
 * 7회 이후 홈팀이 10점 앞서 있으면 콜드다. (측과 무관하게 홈·원정 점수로 본다)
 */
function endTopHalf(game: GameState): GameState {
  const isOver = isGameOverAt(endSituationOf(game, OUTS_PER_HALF_INNING))

  return withFinalOffenseSide({ ...game, half: '말', outs: 0, bases: EMPTY_BASES, isFinished: isOver }, 0)
}

/**
 * 말 3아웃 — 0xb68fc 를 아웃 3 으로: 마지막 이닝 이후 동점이 아니면 끝, 동점이면 상한 없이 연장(0xb6934).
 * 7회 이후 어느 쪽이든 10점 앞서면 콜드(b6962 원정 · b6976 홈 — 상대가 홈이면 그 반 이닝 끝에 홈 10점 차도 끝이다)
 */
function endBottomHalf(game: GameState): GameState {
  const isLastInning = isGameOverAt(endSituationOf(game, OUTS_PER_HALF_INNING))

  return withFinalOffenseSide(
    {
      ...game,
      inning: isLastInning ? game.inning : game.inning + 1,
      half: '초',
      outs: 0,
      bases: EMPTY_BASES,
      isFinished: isLastInning,
    },
    1,
  )
}

export type GameResult = '승' | '무' | '패'

export function resultOf(game: GameState): GameResult {
  if (game.ourScore > game.opponentScore) return '승'
  if (game.ourScore < game.opponentScore) return '패'
  return '무'
}
