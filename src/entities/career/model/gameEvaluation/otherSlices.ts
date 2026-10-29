/**
 * 경기 후 평가가 쓰는 **다른 조각**(타석 결과 · 경기 결과 · 이벤트 보상 명령)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export type { GameResult } from '@/entities/game/model/gameState'
export { EVENT_REWARD_KIND, type EventReward } from '@/entities/story/model/eventReward'
