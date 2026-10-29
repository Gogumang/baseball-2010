/**
 * 경기 진행 흐름 — 공개 이름만 다시 내보내는 barrel.
 * 몸통은 `gameFlow/` 아래 하위 도메인 파일로 옮겼다(r347, 동작 그대로).
 */
export type { GameProgress, GameAutoRelay, GameAutoRelayTick } from '@/features/play-game/model/gameFlow/types/progress'
export { UNFILLED_SPECIAL_SWING_COUNT } from '@/features/play-game/model/gameFlow/types/constants'
export { startGame } from '@/features/play-game/model/gameFlow/setup/startGame'
export type { GamePitcherSetup } from '@/features/play-game/model/gameFlow/setup/startGame'
export { applyPlayerOutcome, recordMyBuntAttempt, startPlayerOutcome } from '@/features/play-game/model/gameFlow/batting/applyPlayerOutcome'
export {
  throwOpponentPitch,
  stageOpponentPitcherAbilityOf,
  opponentCpuMagicStateOf,
  opponentStaminaPercentAfterPitchOf,
} from '@/features/play-game/model/gameFlow/opponent/opponentPitch'
export { startPlayerFoulPlay, resolveDefensePlay } from '@/features/play-game/model/gameFlow/batting/foulPlay'
export { judgeHitByPitch, enterBenchClearing, resolveBenchClearing } from '@/features/play-game/model/gameFlow/benchClearing/benchClearing'
export { recordDrawnFieldingErrors, withGameTeamMorale } from '@/features/play-game/model/gameFlow/records/gameRecords'
export { contactDefensePlayInputOf } from '@/features/play-game/model/gameFlow/defense/defenseInputs'
export { opponentFielderRecordsOf } from '@/features/play-game/model/gameFlow/defense/opponentFielders'
export {
  opponentPitcherAbilityOf,
  opponentPitcherEquipmentOf,
  opponentPitcherSkinIndexOf,
  opponentMoundAcePlayerOf,
  opponentMoundStaminaPercentOf,
} from '@/features/play-game/model/gameFlow/roster/opponentPitcher'
export { opponentMoundOf, moundPitcherNameAt } from '@/features/play-game/model/gameFlow/roster/opponentMound'
export {
  ourRunnerAcesOf,
  ourRunnerRunsOnBaseOf,
  runnerRunAbilitiesOf,
  hiddenStealBasesOf,
} from '@/features/play-game/model/gameFlow/baseRunning/runners'
export { teamBatterNameAt } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
export { withAutoStopLateInningSetup } from '@/features/play-game/model/gameFlow/autoPlay/lateInning'
export { mySpecialSwingRemainingOf, spendMySpecialSwing } from '@/features/play-game/model/gameFlow/roster/specialSwing'
export { startSteal, stealableBasesOf } from '@/features/play-game/model/gameFlow/baseRunning/steals'
export type { PitchArrivalStep } from '@/features/play-game/model/gameFlow/types/pitchArrival'
export { arrivePitch } from '@/features/play-game/model/gameFlow/baseRunning/arrivePitch'
export { resolveRunnerPlay } from '@/features/play-game/model/gameFlow/baseRunning/arrivalPlay'
export { cpuPickoff } from '@/features/play-game/model/gameFlow/baseRunning/cpuPickoff'
export { summaryOf } from '@/features/play-game/model/gameFlow/summary/summary'
