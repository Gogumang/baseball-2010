import { applyPitcherOutcome } from '@/entities/mission/model/pitcherRun'
import { missionCpuAfterBenchClearing } from '@/entities/mission/model/missionCpuTeam'
import { benchClearingEffectOf, rollsIntoBenchClearing, staminaAfterBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry } from '@/features/play-game/model/benchClearingScene'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingBenchClearingAtom, pickoffReplayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { pitcherStaminaStoredAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import type { MissionHeldResult } from '@/app/model/missionSession/types/missionPlayTypes'
import { finishMissionArrivalAtBat } from '@/app/model/missionSession/batter/arrivalSteps'
import { resetAtBatWithConfirm } from '@/app/model/missionSession/scene/sceneSteps'

/** 붙든 타석 결과의 손잡이 — 칸 · 타석 · 난수 */
export interface HeldHands {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly random: RandomPort
}

/** 붙든 볼넷 · 사구 · 삼진의 판정 A 0xae24c 보통 길 — 밀어내기 판(종류 2, 0x17)을 재생하고 정산한다. 진루는 보통 길과 같다 */
export function finishHeldResult({ atoms, runner, random }: HeldHands, held: MissionHeldResult, elapsedFrames: number): void {
  if (held.side === '타자') {
    // 타자 미션 — 공 도착 걸음의 보통 길(`finishMissionArrivalAtBat`) 그대로. 0xd 는 0x12 진입부터 32 그림 뒤라 지난 그림만큼 덜 둔다
    finishMissionArrivalAtBat(atoms, runner, held.play, held, elapsedFrames)
    return
  }
  if (held.walkReplay != null && held.walkReplay.ticks.length > 0) atoms.set(pickoffReplayAtom, held.walkReplay)
  atoms.set(pitcherRunAtom, applyPitcherOutcome(held.run, held.outcome, { random }))
  resetAtBatWithConfirm(atoms, runner)
}

/**
 * 0x12 틱 31 의 4e74c 판정 — 들어가면 0x1e 를 예약한 칸(`'entry'`)을 돌려주고, 안 들어가면 보통 길을 돌고 null.
 * 투수 미션은 들어가면 수비가 사람이라 0x3ab7c 0xaeab0(수비 팀, 1000) — 미션 투수 +0x2c −1000(진입 꼬리지만 굴림 없는 칸이라 여기서).
 * S[1] 은 시즌(모드 2)만 적는다. 타자 미션은 수비가 CPU 라 진입 꼬리 3ab82 가 CPU 마운드 +0x27c += 10 (`enterHeldBenchClearing`)
 */
export function judgeHeldResult(hands: HeldHands, held: MissionHeldResult): MissionHeldResult | null {
  const { atoms, random } = hands
  // 볼넷 · 삼진은 4e744 st[0xb] == 4 가 거짓이라 굴림 없이 4e78c 판정 A 의 보통 길이다(r295 · r298)
  if (rollsIntoBenchClearing({ isHitByPitch: held.outcome.kind === '사구', isHomeRunDerby: false, burstInProgress: false }, random)) {
    if (held.side === '투수') {
      atoms.set(pitcherStaminaStoredAtom, staminaAfterBenchClearing(held.pitcherStamina, benchClearingEffectOf(true).defenseStaminaLoss))
    }
    const entering: MissionHeldResult = { ...held, phase: 'entry' }
    atoms.set(pendingBenchClearingAtom, entering)
    return entering
  }
  atoms.set(pendingBenchClearingAtom, null)
  finishHeldResult(hands, held, RESULT_WAIT_TICKS_AT_BAT_END)
  return null
}

/** 벤치 클리어링 진입 0x3a5f0 — 굴림 45 번(`rollBenchClearingEntry`), 타자 미션이면 꼬리 3ab82 의 CPU 마운드 투구 수 +10 */
export function enterHeldBenchClearing({ atoms, random }: HeldHands, held: MissionHeldResult): MissionHeldResult {
  const entryRolls = rollBenchClearingEntry(random)
  if (held.side === '타자') {
    atoms.set(missionRunAtom, (previous) => (previous === null ? previous : { ...previous, cpu: missionCpuAfterBenchClearing(previous.cpu) }))
  }
  return { ...held, phase: 'scene', entryRolls }
}
