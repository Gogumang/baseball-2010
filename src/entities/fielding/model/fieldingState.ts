/**
 * 수비 시뮬레이션이 읽는 상태 묶음 — 원본 경기 장면 +0x200 의 "플레이" 객체(vtable 0xd8618)와 야수 · 주자 칸.
 *
 * 공개 이름 모음 — 하위 폴더 (`fieldingState/`): `types`(AI 상태표 0xd8808 · 야수 · 주자 · 플레이 칸) · `throwStats`(송구 속도
 * 0xa0fc4 · 악송구 보정 · 투수 칸 b1032 · 팀 보너스 b10d0 · 주자 팀 등급 a9488) · `create`(야수 0xb0fb4 · 플레이 0xb67d0 ·
 * 주자 0xa93ac · 타석 자리 0xa0884) · `ticks`(남은 틱 0xbefec · 한 루 더 0xa06ec · 멈춤 0xbf3a0 · 도착 0xa1c3c)
 */
export {
  AI_STATE,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState/types'
export {
  defenseTeamBonusOf,
  fielderAbilityOf,
  NO_PLAYER_THROW_ERROR_BIAS,
  recordPlayerAbilityOf,
  runnerTeamGradeOf,
  throwErrorBiasOf,
  UNSEARCHED_FIELDER_SLOT,
} from '@/entities/fielding/model/fieldingState/throwStats'
export { batterBoxPosition, createFielders, createRunner, initialPlayView } from '@/entities/fielding/model/fieldingState/create'
export {
  fielderArrivalTicks,
  isRunnerStopped,
  legTotalTicksOf,
  remainingTicksOf,
  runnerOneMoreBaseTicks,
  runnerRemainingTicks,
} from '@/entities/fielding/model/fieldingState/ticks'
