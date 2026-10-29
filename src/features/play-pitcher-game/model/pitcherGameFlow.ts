/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 진행기.
 *
 * 타자편 `features/play-game/model/gameFlow.ts` 와 뼈대는 같지만 **공수가 뒤집혀 있다**:
 * 사람은 수비 반 이닝에 공을 하나씩 던지고, 우리 팀 공격은 동료 아홉 타순을 간이 엔진이 돌린다.
 * 원본도 같다 — "지금 사람 차례인가" 0xc1d38 은 모드 3 에서 **수비측 현재 투수가 내 선수인가**만 본다.
 *
 * 원본 경기 장면 상태와의 대응 (R10 2절·8절, R14 3절):
 * ```
 * 0x9  준비 2        모드 3 이면 감독 강판 플래그 두 개를 0 으로 (S5 U-17)
 * 0xd  타석 시작
 * 0xe  등판·확인     ← 진입에서 **감독 강판 판정 0x504cc**. 참이면 0x23(감독 대사 창)
 * 0xf  구질 고르기   ← 0xe → 0xf 전이에서 **돌발 발동 판정 0x8f158**. 참이면 0x1b(돌발 창)
 * 0x10 코스 고르기   ← 확정(OK)에서 마구 횟수가 줄어든다 (0x50e9c)
 * 0x11 게이지 + 투구
 * 0x12 / 0x13       못 맞힌 공 / 맞은 공 — 타석이 끝나면 **돌발 결과 판정 0x8f414** (0x12 끝 · 0x17 끝)
 * 0x17 인플레이
 * 0x18 공수 교대 · 경기 끝
 * 0x21 강판 뒤 자동진행 (간이 엔진이 남은 경기를 끝까지)
 * 0x23 감독 대사 창 → 닫으면 0x21
 * ```
 */
// 상수 · 옵션 · 진행 상태 꼴
export { MY_PITCHER_SLOT, OUR_ACE_PITCHER_SLOT, DEFAULT_PLAYER_SIDE } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
export type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'
export type { PitcherGameProgress, PitcherAutoRelayTick } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
export type { PitchInput } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
// 로스터 · 투수 차례
export { startsToday, ourPitcherOrderOf, opponentPitcherOrderOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
export { opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
export { myMoundStaminaOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
// 경기 시작 · 투구 (상태 0xe → 0xf → 0x10 → 0x11 → 0x12)
export { startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow/start/startPitcherGame'
export { isPitchTurn, pitchSlotsFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchTurn'
export { throwPitch } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/throwPitch'
export { startPitch } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/startPitch'
export { enterPitchResult } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchArrival'
export { withStealPlayLeagueSteals } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/applyPitcherArrival'
export { hiddenStealBasesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/stealDisplay'
export { resolveRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/runnerPlay'
// 수비 판 · 견제 · 벤치 클리어링 (상태 0x17 · 0x1e)
export {
  recordDrawnPitcherFieldingErrors,
  myFielderPlatesOf,
  opponentRunnerAcesOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
export { judgeHitByPitch, enterBenchClearing, resolveBenchClearing } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/benchClearing'
export { resolveDefensePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/resolveDefensePlay'
export { pickoff } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/pickoff'
// 돌발 · 장면 확인 · 강판 (0x1b · 0xe · 0x23)
export { withPitcherGameMorale } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstResult'
export { closeBurstWindow } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstTrigger'
export {
  confirmScene,
  pitcherSceneSkillPanelOf,
  returnToPitchSelection,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/pitchSelection'
export { giveUpPitching, closeManagerHookWindow } from '@/features/play-pitcher-game/model/pitcherGameFlow/manager/managerHook'
export { ourBenchPitcherCountOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/manager/pitcherChange'
// 화면 · 경기 끝 재료
export { batterNameAt, moundPitcherNameOf, pitchersOfRecordOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/summary/names'
export type { PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow/summary/summaryTypes'
export { earnedRunAverageOf, summaryOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/summary/summary'
