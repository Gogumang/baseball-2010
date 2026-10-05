import type { GameState } from '@/entities/game/model/gameState'
import { runnerCountOf } from '@/entities/game/model/baseState'
import {
  applyPitcherChange,
  applyRunScored,
  NO_SIDE,
  REGULATION_LAST_INNING_INDEX,
} from '@/features/play-pitcher-game/model/winLossSave'
import type { DecisionState, PitcherOfRecord } from '@/features/play-pitcher-game/model/winLossSave'

/**
 * **승·패·세 투수 칸**(state+0x44/0x50/0x5c)을 사람 경기(타자편·팀 경기)에 잇는 얇은 껍데기.
 *
 * 판정식은 투수편이 이미 옮겨 둔 `features/play-pitcher-game/model/winLossSave` 그대로다 (S1 확정):
 * - 득점 처리 `0xa5c34` 는 **한 점마다** 불린다 — 한 플레이에 여러 점이 나도 한 점씩 차례로 넣는다.
 * - 세이브 후보는 투수가 **올라오는 순간** `0xa60c0` 한 번 (사람 경기 0x52284 · 간이 엔진 0xc26a2).
 *
 * 측(side)은 원본 그대로 **0 = 선공(초 공격) · 1 = 후공(말 공격)** 이다 (`gameState.PlayerSide` 머리말).
 * 등번호 칸(+0x48 …)은 웹 로스터에 등번호가 없어 **투수 칸 번호**를 넣는다 — 이름을 찾는 열쇠로만 쓴다.
 *
 * 경기 끝 결과 판(상태 0x18, 그리기 0x4fe9c)은 이 칸을 **그대로** 읽는다 — 경기 끝 기록 반영 `0xa7de8`
 * 의 거르기(세이브 코드 > 0 이면 버림 · 승 투수와 같으면 버림)를 거치지 않는다. 그래서 화면 세 줄은
 * `gameEndDecisionOf` 가 아니라 이 칸 셋을 그대로 보여 준다 (측 2 = 없음이면 빈 줄).
 */

/** 그 반 이닝에 공격하는 측 — `state[9]` (초 0 · 말 1) */
export function offenseSideOf(game: GameState): number {
  return game.half === '초' ? 0 : 1
}

/** 측별 점수 (0xb69b0) — 사람 팀은 `playerSide` 측에 앉는다 */
export function sideScoreOf(game: GameState, side: number): number {
  return side === game.playerSide ? game.ourScore : game.opponentScore
}

/** 측별 지금 마운드 투수 칸 (0xae83c → 레코드 +0) */
export interface MoundBySide {
  readonly our: number
  readonly opponent: number
}

function moundPitcherOf(game: GameState, mound: MoundBySide) {
  return (side: number) => (side === game.playerSide ? mound.our : mound.opponent)
}

/**
 * 플레이 하나(같은 반 이닝 안)에서 난 점수를 한 점씩 먹인다 (0xa5c34 를 점마다).
 *
 * `before` 는 플레이 전 경기 상태다 — 이닝·공격 측은 여기서 읽는다. 점수는 공격 측 점수 차만큼
 * 한 점씩 올려 가며 그때마다 판정한다 (원본도 한 점 들어올 때마다 부른다).
 * 마운드는 그 플레이 동안 바뀌지 않는다고 본다 — 교체는 타석 앞(0xc1ba4 · 0x3da3e)에서만 난다.
 */
export function decisionsAfterRuns(
  decisions: DecisionState,
  before: GameState,
  runs: number,
  mound: MoundBySide,
): DecisionState {
  if (runs <= 0) return decisions
  const offenseSide = offenseSideOf(before)
  const defenseSide = 1 - offenseSide
  let next = decisions
  for (let run = 1; run <= runs; run += 1) {
    next = applyRunScored(next, {
      // 원본 이닝은 0-기준이다 (state+0x6b)
      inningIndex: before.inning - 1,
      // 9이닝 경기 — 경기 상태 초기화 0xb6814 가 state+0x69 = 8 로 둔다. 연장에서도 그대로다
      lastInningIndex: REGULATION_LAST_INNING_INDEX,
      offenseSide,
      defenseSide,
      scoreOf: (side) => sideScoreOf(before, side) + (side === offenseSide ? run : 0),
      moundPitcherOf: moundPitcherOf(before, mound),
    })
  }
  return next
}

/**
 * 두 경기 상태 사이에 공격 측이 낸 점수만큼 먹인다 — 한 타석·한 플레이 단위로 부른다.
 * 반 이닝이 넘어가도 점수는 넘어가기 전 공격 측이 낸 것이다 (3아웃 플레이의 득점).
 */
export function decisionsAfterPlay(
  decisions: DecisionState,
  before: GameState,
  after: GameState,
  mound: MoundBySide,
): DecisionState {
  const offenseSide = offenseSideOf(before)
  const runs = sideScoreOf(after, offenseSide) - sideScoreOf(before, offenseSide)
  return decisionsAfterRuns(decisions, before, runs, mound)
}

/**
 * 수비 측 투수가 막 올라왔다 — 세이브 후보를 잡는다 (0xa60c0).
 * `mound` 는 **바뀐 뒤**의 마운드다. 남은 아웃은 그 순간의 이닝·아웃으로 센다.
 */
export function decisionsAfterPitcherChange(
  decisions: DecisionState,
  game: GameState,
  mound: MoundBySide,
  /** 그 순간 아웃 수 — 안 주면 `game.outs` */
  outs: number = game.outs,
  /** 그 순간 루상 주자 수 (0xa9598) — 안 주면 `game.bases` 로 센다 */
  runnerCount: number = runnerCountOf(game.bases),
): DecisionState {
  const offenseSide = offenseSideOf(game)
  return applyPitcherChange(decisions, {
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    inningIndex: game.inning - 1,
    outs,
    defenseSide: 1 - offenseSide,
    offenseSide,
    scoreOf: (side) => sideScoreOf(game, side),
    moundPitcherOf: moundPitcherOf(game, mound),
    runnerCount,
  })
}

/** 결과 판 세 줄(승·패·세)에 들어갈 이름 — 측 2(없음)면 null */
export interface PitcherOfRecordNames {
  readonly win: string | null
  readonly loss: string | null
  readonly save: string | null
}

/**
 * 결과 판 세 줄의 이름 (0x4fe9c: `0xb62c0(0xb8b60(팀[측], 번호))`).
 * `nameOf(우리 팀인가, 투수 칸)` 은 부르는 쪽 로스터에서 이름을 찾는다.
 */
export function pitcherOfRecordNamesOf(
  decisions: DecisionState,
  playerSide: number,
  nameOf: (isOurTeam: boolean, pitcherNumber: number) => string | undefined,
): PitcherOfRecordNames {
  const name = (record: PitcherOfRecord) =>
    record.side === NO_SIDE ? null : (nameOf(record.side === playerSide, record.number) ?? null)
  return { win: name(decisions.winner), loss: name(decisions.loser), save: name(decisions.save) }
}
