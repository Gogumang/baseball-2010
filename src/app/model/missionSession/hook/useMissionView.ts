import { useMemo } from 'react'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionCpuBatterOf } from '@/entities/mission/model/missionCpuTeam'
import { missionRunnerAcesOf, missionRunnerRunAbilitiesOf } from '@/entities/mission/model/missionRunners'
import { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { startHumanSteal } from '@/features/defense-play/model/pitchArrivalPlay'
import { substitutionEntrySoundIdOf } from '@/features/play-game/model/substitutionScene'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { modePitcherMagicRemainingOf } from '@/app/model/modePitcher'
import { isPitcherSideOf, type MissionPlayScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import * as runs from '@/app/model/missionSession/atoms/runAtoms'
import * as plays from '@/app/model/missionSession/atoms/playAtoms'
import * as scenes from '@/app/model/missionSession/atoms/sceneAtoms'
import * as cells from '@/app/model/missionSession/atoms/pitcherAtoms'
import * as records from '@/app/model/missionSession/atoms/recordAtoms'
import { pitcherStealDisplayAtom, stealingFromAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { atBatEntrySoundOf, shownSceneConfirmOf } from '@/app/model/missionSession/scene/announcedWait'
import { missionAceMoundStaminaOf, missionCpuAfterThrow } from '@/app/model/missionSession/opponent/opponentStamina'
import { specialRunnersOf } from '@/app/model/missionSession/pick/specialRunners'

/**
 * **진행 중인 미션의 조준점 흔들림 세기** — 레코드 바이트 13 (`conditionCode`, 0xaa57c → 0x39c5c).
 * 미션이 안 도는 중이면 0 이다 = 안 흔들린다. 값의 뜻은 `shared/config/original/missions.ts` 의 `MISSION_AIM_SHAKES` 에 있다.
 * ⚠️ 타자 미션은 표가 **전부 0** 이라 타자편에서는 늘 0 이다 (원본 그대로).
 * 원본 0x39c5c 는 경기 장면 **상태 0x10(조준) 의 갱신 함수**이고(R10 2절 상태표) 그 안에서
 * `[this+0x1788] != 0 && [this+0x1104] == 5`(= 미션 객체가 있고 모드 5 = 투수 미션) 일 때만
 * 조건코드 1·2·3 갈래로 간다 — 즉 **원본 미션 투구도 보통 경기와 같은 조준·투구 길**이다.
 */
function missionConditionCodeOf(pitcherRun: PitcherRun | null, missionRun: MissionRun | null): number {
  if (pitcherRun !== null && pitcherRun.status === '진행중') return pitcherRun.mission.conditionCode
  if (missionRun !== null && missionRun.status === '진행중') return missionRun.mission.conditionCode
  return 0
}

/** 타자 미션에서 지금 출발시킬 수 있는 루 — `canStartSteal`(0xa9924 앞길 검사). 이번 공에 이미 출발한 주자는 빠진다 */
function stealableBasesOf(missionRun: MissionRun | null, isHeld: boolean, stealingFrom: readonly StealBase[]): readonly StealBase[] {
  if (missionRun === null || missionRun.status !== '진행중' || isHeld) return []
  return ([1, 2, 3] as const).filter((base) => startHumanSteal(missionRun.bases, stealingFrom, base) !== stealingFrom)
}

/**
 * **타석 등장음** — 0xd 진입 0x48d50 의 48ecc 메시지 0xbc1 → 0x522d2 (`SceneConfirmWait.atBatEntrySoundId`). 진행이 판을 다
 * 먹인 뒤(3아웃 뒤의 자동진행 중계까지 지난 뒤) 화면이 0xd 를 그리기 시작할 때의 판으로 고른다 — 대기 객체는 그 동안 같다.
 * 투수 미션 · 투수편 마선수 대결은 CPU 타자(0xae89c — 마타자 칸이면 26), 타자 미션은 나리 선수라 마선수가 아니다.
 */
function atBatEntrySoundIdOf(isPitcherSideNow: boolean, missionRun: MissionRun | null, pitcherRun: PitcherRun | null): number | null {
  const announcingRun = isPitcherSideNow ? pitcherRun : missionRun
  if (announcingRun === null) return null
  const isAce = isPitcherSideNow && pitcherRun !== null && missionCpuBatterOf(pitcherRun.cpu)?.isAce === true
  return substitutionEntrySoundIdOf({ isAce, bases: announcingRun.bases })
}

/** 세션이 내보이는 그림 칸 — atom 값과 그 값으로 센 칸 */
export function useMissionView(scope: MissionPlayScope) {
  const { atoms, screen, aceLevels, pick } = scope
  const missionRun = useMissionValue(atoms, runs.missionRunAtom)
  const pitcherRun = useMissionValue(atoms, runs.pitcherRunAtom)
  const pitcherAceMatchMission = useMissionValue(atoms, runs.pitcherAceMatchMissionAtom)
  const pendingDefensePlay = useMissionValue(atoms, plays.pendingDefensePlayAtom)
  const pendingRunnerPlay = useMissionValue(atoms, plays.pendingRunnerPlayAtom)
  const pendingBenchClearing = useMissionValue(atoms, plays.pendingBenchClearingAtom)
  const stealingFrom = useMissionValue(atoms, stealingFromAtom)
  const sceneConfirm = useMissionValue(atoms, scenes.sceneConfirmAtom)
  const clearCounts = useMissionValue(atoms, records.clearCountsAtom)
  const pitcherStaminaStored = useMissionValue(atoms, cells.pitcherStaminaStoredAtom)
  /** 한 번이라도 깬 미션 키 — 잠금 판정과 컬렉션이 쓴다 */
  const clearedKeys = useMemo(
    () =>
      Object.entries(clearCounts)
        .filter(([, count]) => count > 0)
        .map(([key]) => key),
    [clearCounts],
  )
  const entrySoundId = atBatEntrySoundIdOf(isPitcherSideOf(screen.kind, pitcherAceMatchMission), missionRun, pitcherRun)
  if (sceneConfirm !== null && entrySoundId !== null) atBatEntrySoundOf.set(sceneConfirm, entrySoundId)
  const isHeld = pendingDefensePlay !== null || pendingRunnerPlay !== null || pendingBenchClearing !== null
  return {
    missionRun,
    pitcherRun,
    pitcherAceMatchMission,
    clearedKeys,
    clearCounts,
    lastSide: useMissionValue(atoms, records.lastSideAtom),
    missionConditionCode: missionConditionCodeOf(pitcherRun, missionRun),
    pendingDefensePlay,
    pendingBenchClearing,
    pickoffReplay: useMissionValue(atoms, plays.pickoffReplayAtom),
    pendingRunnerPlay,
    lastPitchJudgementCleared: useMissionValue(atoms, cells.lastPitchJudgementClearedAtom),
    lastPitcherThrow: useMissionValue(atoms, cells.lastPitcherThrowAtom),
    batterSpecialSwingStored: useMissionValue(atoms, cells.batterSpecialSwingStoredAtom),
    pitcherMagicRemaining: modePitcherMagicRemainingOf(useMissionValue(atoms, cells.pitcherMagicStoredAtom), pick.pitcher),
    stealableBases: stealableBasesOf(missionRun, isHeld, stealingFrom),
    stealingFrom,
    pitcherStealDisplay: useMissionValue(atoms, pitcherStealDisplayAtom),
    missionRunnerRunAbilities:
      missionRun === null
        ? {}
        : missionRunnerRunAbilitiesOf(missionRun, specialRunnersOf(missionRun.mission, aceLevels, pick.missionBatterRunAbility)),
    missionRunnerAces: missionRun === null ? undefined : missionRunnerAcesOf(missionRun),
    sceneConfirm: shownSceneConfirmOf(sceneConfirm),
    loadingTip: useMissionValue(atoms, scenes.loadingTipAtom),
    halfInningBoard: useMissionValue(atoms, scenes.halfInningBoardAtom),
    substitutionScene: useMissionValue(atoms, scenes.substitutionSceneAtom),
    skyRow: useMissionValue(atoms, scenes.skyRowAtom),
    opponentStaminaPercent: staminaPercentOf(missionAceMoundStaminaOf(missionRun)),
    pitcherStamina: pitcherStaminaStored ?? pick.pitcher.stamina,
    autoRelayStep: useMissionValue(atoms, runs.autoRelayStepAtom),
    opponentStaminaPercentAfterPitch: (run: MissionRun, pitchTypeNumber: number) =>
      staminaPercentOf(missionCpuAfterThrow(run, pitchTypeNumber, pick.batterSkillIds, aceLevels).pitching?.mound.stamina ?? FULL_STAMINA),
  }
}
