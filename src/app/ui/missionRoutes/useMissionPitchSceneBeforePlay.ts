import type { useMissionSession } from '@/app/model/useMissionSession'
import { useHitByPitchWait } from '@/pages/defense/model/useHitByPitchWait'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import type { PitchingStageSource } from '@/pages/pitching/ui/PitchingScreen'
import { usePitcherHitScene } from '@/widgets/batting-stage/model/usePitcherHitScene'
import { usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'
import { pitchingStageOf } from '@/app/ui/missionRoutes/missionStage'

/** 투수 미션의 판이 섰지만 아직 0x17 전인 동안 — `useMissionPitchSceneBeforePlay` */
export interface MissionPitchSceneBeforePlay {
  /** 맞은 공의 0x11 끝 · 0x13 을 투구 장면이 그리는 중 — 수비 판(`pendingDefensePlay`)을 아직 안 띄운다 */
  readonly isHitShowing: boolean
  /** 공 도착 판(도루 · 폭투)의 0x11 끝 · 0x12 틱 0 을 투구 장면이 그리는 중 — 주자 판(`pendingRunnerPlay`)을 아직 안 띄운다 */
  readonly isArrivalHolding: boolean
  /** 투구 화면 장면 재료에 얹을 값 (`PitchingStageSource`) */
  readonly stage: Pick<PitchingStageSource, 'hitScene' | 'onHitSceneEnd' | 'onHitJudged' | 'isBeforePlay'>
}

type MissionSession = ReturnType<typeof useMissionSession>

/** 마지막 공 · CPU 스윙 — 공을 아직 안 던졌으면 둘 다 없다 */
function lastThrowSwingOf(lastThrow: MissionSession['lastPitcherThrow']) {
  return { pitch: lastThrow?.pitch ?? null, cpuSwing: lastThrow?.cpuSwing ?? null }
}

/** 지금 CPU 타자의 손 — 마타자면 손 표, 아니면 폼 & 1 (판이 없으면 0) */
function stageBatterHandOf(stage: PitchingStageSource | null): number {
  if (stage === null) return 0
  return stage.batterSide ?? stage.batterForm & 1
}

/** 투수 미션의 사구 · 삼진 대기 — 타자 미션 몫은 라우트가 센다 */
function pitcherBenchHoldOf(session: MissionSession) {
  return session.pendingBenchClearing?.side === '투수' ? session.pendingBenchClearing : null
}

/** 못 맞힌 공의 공 도착 판(도루 · 폭투) — 사람이 수비할 때만 */
function arrivalPlayOf(runnerPlay: MissionSession['pendingRunnerPlay']) {
  if (runnerPlay === null || runnerPlay.kind !== 'arrival' || runnerPlay.side !== '수비') return null
  return runnerPlay
}

/**
 * **투수 미션의 0x11 끝 · 0x13 · 0x12 틱 0 — 수비 판(0x17)을 그 뒤로 미룬다** (투수편 `PitcherGameScreen` 과 같은 길).
 * 세션은 공을 놓는 순간(0x11 틱 10) 판정과 함께 판을 세운다(`handleThrow`). 원본은 CPU 타자가 맞힌 공이면 판정 틀(스윙 F + 1 ·
 * 번트 N − 1)까지 0x11 · 이어 0x13(큰 타구면 문턱 + 7)을 지나 0x17 로 가고(`usePitcherHitScene`), 못 맞힌 공의 도루 · 폭투 판은
 * 0x12 진입 0x3dfac 이 열어 다음 그림이 0x17 이다(`usePitchArrivalHold` — 세션도 못 맞힌 공의 공 도착을 그 틀에 돌린다). 그동안 투구
 * 화면(`PitchingScreen`)이 장면을 그린다. 맞은 공의 판 입력 · 판 시작 굴림은 세션이 이미 냈으니 미뤄도 그 굴림 차례는 그대로다.
 */
export function useMissionPitchSceneBeforePlay(session: ReturnType<typeof useMissionSession>, isPopupFrozen: boolean): MissionPitchSceneBeforePlay {
  const lastThrow = session.lastPitcherThrow
  const run = session.pitcherRun
  const stage = run === null ? null : pitchingStageOf(session, run)
  const pending = session.pendingDefensePlay
  const hitScene = usePitcherHitScene({
    play: pending !== null && pending.side === '투수' ? pending.input : null,
    ...lastThrowSwingOf(lastThrow),
    batterHand: stageBatterHandOf(stage),
    // 일시정지 팝업(0x741a0)이 장면 틱을 세운다(0x52cc6) — 투구 화면이 알린다
    isFrozen: isPopupFrozen,
  })
  // 투수 미션 볼넷 · 사구 · 삼진 — 0x12 대기 틱 31 의 4e74c 판정, 들어갔으면 다음 틀의 진입 0x3a5f0 (A-22). 세션은 못 맞힌 공의 공 도착을 0x12 진입
  // 틀에 돌려(r293) 붙든 칸이 0x12 틱 0 그림에 서므로 그 그림부터 0x1f − 1
  useHitByPitchWait({
    hold: pitcherBenchHoldOf(session),
    waitTicks: RESULT_WAIT_TICKS_AT_BAT_END - 1,
    isFrozen: isPopupFrozen,
    random: session.random,
    onJudge: session.actions.judgeHitByPitch,
    onEnter: session.actions.enterBenchClearing,
  })
  const isArrivalHolding = usePitchArrivalHold({
    play: arrivalPlayOf(session.pendingRunnerPlay),
    isFrozen: isPopupFrozen,
  })
  return {
    isHitShowing: hitScene.isShowing,
    isArrivalHolding,
    stage: {
      hitScene: hitScene.hitScene,
      onHitSceneEnd: hitScene.end,
      // 판정 틀의 메시지 0x11 굴림 묶음 (A-37)
      onHitJudged: hitScene.judge,
      isBeforePlay: hitScene.isShowing || isArrivalHolding,
    },
  }
}
