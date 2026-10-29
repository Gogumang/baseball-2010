/**
 * 경기 진행 상태 — 이닝 · 아웃 · 루 · 점수 · 타순 커서와 사람이 맡는 측(설정 레코드 +8).
 *
 * 공개 이름 모음 — 하위 폴더 (`gameState/`): `types`(상태 꼴 · 측 · 결과) · `gameEnd`(경기 끝 판정 0xb68fc) ·
 * `inningRuns`(이닝별 점수 칸 st[0x6c..] 0xb6a9c · 점수판 0x41c18) · `sides`(새 경기 · 공격 반 · 사람 차례 · 승패) ·
 * `progress`(상대 이닝 · 타석 결과 · 반 이닝 넘김 0xb6b6c · 주자 신원) · `otherSlices`(다른 조각)
 */
export {
  INNINGS_PER_GAME,
  PLAYER_BATTING_ORDER_INDEX,
  PLAYER_SIDE_FIRST_BAT,
  PLAYER_SIDE_LAST_BAT,
  type GameResult,
  type GameState,
  type InningHalf,
  type PlayerSide,
  type RunnerHint,
} from '@/entities/game/model/gameState/types'
export { endSituationOf, isGameOverAt } from '@/entities/game/model/gameState/gameEnd'
export { lineScoreSlotsOf, withInningRuns } from '@/entities/game/model/gameState/inningRuns'
export { createGame, isPlayerTurn, opponentHalfOf, ourHalfOf, resultOf } from '@/entities/game/model/gameState/sides'
export { applyAtBatOutcome, applyOpponentInning, runnersOfGame } from '@/entities/game/model/gameState/progress'
