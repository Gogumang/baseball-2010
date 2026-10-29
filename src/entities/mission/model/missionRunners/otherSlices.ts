/**
 * 미션 주자 신원 · 판 재료가 쓰는 **다른 조각**(루 · 주자 목록 · 간이 타순 · 팀 표 · 마선수)과 **위 층**(`features/defense-play` 이름 판 ·
 * 마선수 주자 꼴)의 값 — 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 층 방향 · cross-slice 예외는
 * 이 파일 하나).
 */
export { missionOpponentOf } from '@/entities/game/model/aceOpponent'
export {
  EMPTY_BASE_RUNNERS,
  effectiveRunnersOf,
  runnerOnBase,
  runnersAfterPlay,
  runnersBehindCursor,
  survivorsWithoutPlayOf,
  type BaseRunners,
} from '@/entities/game/model/baseRunners'
export type { BaseState } from '@/entities/game/model/baseState'
export { lineupSlotOf, rosterSlotAt, type QuickLineup } from '@/entities/game/model/quickLineup'
export { skillIdsOfBits, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
export { defenseFielderPlatesOf } from '@/features/defense-play/model/runDefensePlay'
export type { RunnerAces } from '@/features/defense-play/model/runnerAces'
