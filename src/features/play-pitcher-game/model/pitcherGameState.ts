import { applyAtBatOutcome, opponentHalfOf } from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { advanceRunners } from '@/entities/game/model/baseState'
import type { AdvanceResult } from '@/entities/game/model/baseState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * 나만의리그 **투수편**(원본 모드 3)에서는 사람이 **수비 반 이닝**을 타석 하나씩 치른다.
 *
 * `entities/game/model/gameState` 의 `applyAtBatOutcome` 은 "우리 공격" 반 이닝 전용이고,
 * 상대 공격은 `applyOpponentInning` 으로 **한 이닝을 통째로** 넘기게 되어 있다(타자편이 쓰는 길).
 * 투수편은 상대 타석 하나하나가 사람의 투구라서 그 사이 자리가 필요하다.
 *
 * 경기 상태 전이(끝내기·콜드게임·반 이닝 교대)는 이미 원본과 대조해 둔 코드가 하나뿐이므로
 * **베껴 쓰지 않고 거울을 씌워 그대로 재사용**한다: 공수를 맞바꾼 `GameState` 를 만들어
 * `applyAtBatOutcome` 에 넣고, 돌려받은 결과의 거울을 다시 벗긴다.
 *   - `playerSide` 를 뒤집으면 `ourHalfOf` 가 곧 원래의 `opponentHalfOf` 가 된다.
 *   - 점수 두 칸을 맞바꾸면 `homeScoreOf`/`awayScoreOf` 도 그대로 맞아떨어진다
 *     (측을 뒤집었으므로 홈·원정 판정이 원래대로 나온다).
 *   - 콜드게임 판정 `ourScore − opponentScore >= 10` 은 "공격 중인 팀이 달아났는가" 라서
 *     거울 안에서 보면 상대가 달아난 경우가 된다 — 원본 0xb6976 과 같다.
 */

/** 공수를 맞바꾼 거울 상태 */
function mirrorOf(game: GameState, opponentOrderIndex: number): GameState {
  return {
    ...game,
    ourScore: game.opponentScore,
    opponentScore: game.ourScore,
    battingOrderIndex: opponentOrderIndex,
    // 거울 안에서는 사람이 타석에 서지 않는다 — 타순 칸을 절대 맞히지 못하는 값으로 둔다
    playerOrderIndex: -1,
    playerSide: (1 - game.playerSide) as PlayerSide,
  }
}

export interface OpponentAtBatResult {
  readonly game: GameState
  /** 다음 상대 타순 칸 (0~8) */
  readonly opponentOrderIndex: number
  /** 이 타석으로 상대가 낸 점수 */
  readonly runsScored: number
  /** 이 타석으로 늘어난 아웃 수 */
  readonly outsAdded: number
}

/**
 * 사람이 던지는 반 이닝의 타석 하나를 반영한다.
 *
 * `precomputed` 를 주면 주자 처리를 그것으로 대신한다 — 투수편에도 수비 시뮬레이션
 * (`features/defense-play`)을 붙일 자리다. 안 주면 `baseState.advanceRunners` 의 근사를 쓴다.
 * 어느 쪽이든 **같은 결과를 두 번 계산하지 않도록** 여기서 한 번 구해 넘긴다.
 */
export function applyOpponentAtBat(
  game: GameState,
  opponentOrderIndex: number,
  outcome: AtBatOutcome,
  precomputed?: AdvanceResult,
): OpponentAtBatResult {
  if (game.isFinished || game.half !== opponentHalfOf(game)) {
    return { game, opponentOrderIndex, runsScored: 0, outsAdded: 0 }
  }
  const advance = precomputed ?? advanceRunners(game.bases, outcome, game.outs)
  const next = applyAtBatOutcome(mirrorOf(game, opponentOrderIndex), outcome, advance)
  return {
    game: {
      ...next,
      ourScore: next.opponentScore,
      opponentScore: next.ourScore,
      battingOrderIndex: game.battingOrderIndex,
      playerOrderIndex: game.playerOrderIndex,
      playerSide: game.playerSide,
    },
    opponentOrderIndex: next.battingOrderIndex,
    runsScored: advance.runsScored,
    outsAdded: advance.outsAdded,
  }
}

/**
 * 이닝별 실점 표 — 원본 `state+0x6c + (이닝%9)·2 + 측` 을 읽는 `0xb6988` 자리다.
 * 감독 강판 3번 사유("한 이닝 4실점")가 이 값을 본다 (P1 2-1).
 *
 * 원본이 `이닝 % 9` 로 칸을 돌려 쓰는 것까지 그대로다 — ⚠️ 연장 10회는 1회 칸에 덧쌓인다.
 */
export const INNING_RUN_SLOTS = 9

export function addInningRuns(
  runs: readonly number[],
  inning: number,
  scored: number,
): readonly number[] {
  if (scored === 0) return runs
  const slot = (inning - 1) % INNING_RUN_SLOTS
  const next = [...runs]
  while (next.length < INNING_RUN_SLOTS) next.push(0)
  next[slot] = (next[slot] ?? 0) + scored
  return next
}

export function inningRunsOf(runs: readonly number[], inning: number): number {
  return runs[(inning - 1) % INNING_RUN_SLOTS] ?? 0
}

/** 이닝이 바뀌면 그 칸을 비운다 — 원본은 경기 상태 초기화가 표를 0 으로 둔 채 이닝마다 채운다 */
export function clearInningRuns(runs: readonly number[], inning: number): readonly number[] {
  const slot = (inning - 1) % INNING_RUN_SLOTS
  const next = [...runs]
  while (next.length < INNING_RUN_SLOTS) next.push(0)
  next[slot] = 0
  return next
}
