/**
 * 미션 CPU 팀이 쓰는 **다른 조각**(반 이닝 엔진 · 간이 명단 · 투수 교체 · 체력 · 마구 · 팀 표 · 시즌 레코드)의 값 —
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다. 안쪽 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의
 * cross-slice 예외는 이 파일 하나).
 */
export type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export type { BatterAbility } from '@/entities/batting/model/batter'
export { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
export { BENCH_CLEARING_PITCH_COUNT_GAIN } from '@/entities/game/model/benchClearing'
export type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
export {
  QUICK_LINEUP_SIZE,
  lineupSlotOf,
  recordLineupPlay,
  rosterLineupOf,
  rosterSlotAt,
  tryQuickCpuPinchHit,
  type QuickLineup,
} from '@/entities/game/model/quickLineup'
export {
  changePitcherIfNeeded,
  drainPitcherForPitch,
  withQuickFightingSpirit,
  type HalfInningDefense,
  type HalfInningMound,
} from '@/entities/game/model/simulateHalfInning'
export { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
export {
  FRESH_HELD_CPU_MAGIC,
  heldCpuMagicAfterPitch,
  heldCpuMagicAfterPitcherChange,
  type HeldCpuMagic,
} from '@/entities/pitching/model/magicPitchGame'
export type { PitcherAbility } from '@/entities/pitching/model/pitch'
export { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
export { hasFightingSpiritBit, withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
export { equippedSeasonAbilityOf } from '@/entities/season-mode/model/seasonPlayerRecord'
export { quickPitcherOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
