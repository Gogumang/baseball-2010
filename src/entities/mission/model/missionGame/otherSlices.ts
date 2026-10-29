/**
 * 미션 경기가 쓰는 **다른 조각**(간이 엔진 반 이닝 · 간이 타순 · 루 · 경기 끝 · 팀 표 · 체력 · 마구)의 값 — 조각 경계를 넘는
 * import 를 이 파일 한 곳에 모은다. 안쪽 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의 cross-slice 예외는
 * 이 파일 하나).
 */
export { EMPTY_BASE_RUNNERS, type BaseRunners } from '@/entities/game/model/baseRunners'
export { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
export { isGameOverAt } from '@/entities/game/model/gameState'
export { lineupSlotOf, rosterLineupOf, rosterSlotAt, type QuickLineup } from '@/entities/game/model/quickLineup'
export {
  simulateHalfInningTicks,
  type HalfInningPlateAppearance,
  type HalfInningResult,
  type HalfInningTick,
} from '@/entities/game/model/simulateHalfInning'
export { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
export { FRESH_HELD_CPU_MAGIC, heldCpuMagicAfterPitcherChange } from '@/entities/pitching/model/magicPitchGame'
export { quickBatterOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
