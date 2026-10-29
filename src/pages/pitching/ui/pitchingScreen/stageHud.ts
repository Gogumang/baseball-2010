import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import { smallLogoUrlOf } from './missionPitching'
import type { PitchingScreenProps, PitchingStageSource } from './pitchingScreenProps'

/** st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 0xf 진입 전까지(공이 날거나 0x12 인 동안 포함) 루에 안 그린다 */
function hiddenRunnerBasesOf(stealDisplay: PitchingScreenProps['stealDisplay'], isPitchSceneBusy: boolean): readonly number[] {
  if (stealDisplay === null || stealDisplay === undefined) return []
  return !stealDisplay.selectionEntered || isPitchSceneBusy ? stealDisplay.bases : []
}

/** 경기 칸(이닝 st[0x6b] · 공격 측 st[9] · 점수 0xb69b0 · 팀 st[0x28 + 칸]) — 타자 미션 화면과 같다 */
export function missionStageHudOf(
  run: PitcherRun,
  atBat: AtBatState,
  stage: PitchingStageSource,
  stealDisplay: PitchingScreenProps['stealDisplay'],
  isPitchSceneBusy: boolean,
) {
  const teamIds = missionTeamIdsOf(run)
  return {
    inning: run.game.inning + 1,
    half: run.game.offenseSide === 0 ? '초' : '말',
    ourScore: run.game.scores[humanSideOf(run.mission)],
    opponentScore: run.game.scores[cpuSideOf(run.mission)],
    balls: atBat.balls,
    strikes: atBat.strikes,
    outs: outsShownDuringResultWait(run.outs, stage.resultHold),
    bases: run.bases,
    // 경기[0x28 + 칸] 팀의 작은 로고 (0x48658 48a38~48a74 → 장면+0x1054 · +0x1058) — 사람 칸 · CPU 칸 (`missionTeamIdsOf`)
    ourLogoUrl: smallLogoUrlOf(teamIds.human),
    opponentLogoUrl: smallLogoUrlOf(teamIds.cpu),
    // 루상 주자 팔레트(0x35b94 — 주자 +0xac 팀) · 펜스 아이콘(0x77974 — 모드 5 · 6 은 77ae4~77af0 에서 늘 11)
    ourTeamId: teamIds.human,
    opponentTeamId: teamIds.cpu,
    playerSide: humanSideOf(run.mission),
    hiddenRunnerBases: hiddenRunnerBasesOf(stealDisplay, isPitchSceneBusy),
  } as const
}

/** 장면 재료의 고를 수 있는 칸 — 있을 때만 넘긴다(없으면 장면 기본값) */
export function optionalStageFieldsOf(stage: PitchingStageSource) {
  return {
    ...(stage.pitcherMagicNumber === undefined ? {} : { pitcherMagicNumber: stage.pitcherMagicNumber }),
    pitcherHand: stage.pitcherHand,
    ...(stage.pitcherEquipment === undefined ? {} : { pitcherEquipment: stage.pitcherEquipment }),
    ...(stage.pitcherSkinIndex === undefined ? {} : { pitcherSkinIndex: stage.pitcherSkinIndex }),
    ...(stage.pitcherStaminaPercent === undefined ? {} : { pitcherStaminaPercent: stage.pitcherStaminaPercent }),
    ...(stage.batterSide === undefined ? {} : { batterSide: stage.batterSide }),
    ...(stage.aceBatterOrder === undefined ? {} : { aceBatterOrder: stage.aceBatterOrder }),
    ...(stage.batterEquipment === undefined ? {} : { batterEquipment: stage.batterEquipment }),
  }
}
