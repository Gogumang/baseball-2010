import { BALANCE } from '@/shared/config/original/balance'
import {
  INNINGS_PER_GAME,
  OUTS_PER_HALF_INNING,
  PLAYER_SIDE_LAST_BAT,
  type GameEndSituation,
  type GameState,
} from '@/entities/game/model/gameState/types'

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
  const threeOuts = situation.outs >= OUTS_PER_HALF_INNING
  if (situation.inning >= INNINGS_PER_GAME && isRegulationEnd(situation, threeOuts)) return true
  return situation.inning >= COLD_GAME_FROM_INNING && isColdGameEnd(situation, threeOuts)
}

/** b691e~b6942 — 이닝 index ≥ 8: 말은 3아웃이면 점수가 다를 때 · 아니면 홈이 앞설 때(끝내기), 초는 3아웃이고 홈이 앞설 때 */
function isRegulationEnd({ half, awayScore, homeScore }: GameEndSituation, threeOuts: boolean): boolean {
  if (half === '말') return threeOuts ? awayScore !== homeScore : homeScore > awayScore
  return half === '초' && threeOuts && homeScore > awayScore
}

/** b694c~b6976 — 이닝 index > 5: 말 3아웃에 원정 10점 차, 또는 (말이거나 3아웃이면) 홈 10점 차 */
function isColdGameEnd({ half, awayScore, homeScore }: GameEndSituation, threeOuts: boolean): boolean {
  if (half === '말' && threeOuts && awayScore >= homeScore + COLD_GAME_MARGIN) return true
  return (half === '말' || threeOuts) && homeScore >= awayScore + COLD_GAME_MARGIN
}

/** 홈(말 공격) 팀 점수 — 측 1 이면 우리, 측 0 이면 상대다 */
function homeScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.ourScore : game.opponentScore
}

/** 원정(초 공격) 팀 점수 */
function awayScoreOf(game: GameState): number {
  return game.playerSide === PLAYER_SIDE_LAST_BAT ? game.opponentScore : game.ourScore
}

/** 경기 상태를 0xb68fc 가 보는 칸으로 — 측으로 원정 · 홈 점수를 가른다. `outs` 를 주면 그 아웃 수로 본다 */
export function endSituationOf(game: GameState, outs = game.outs): GameEndSituation {
  return { inning: game.inning, half: game.half, outs, awayScore: awayScoreOf(game), homeScore: homeScoreOf(game) }
}
