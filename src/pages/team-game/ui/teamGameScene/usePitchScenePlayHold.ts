import { usePitcherHitScene } from '@/widgets/batting-stage/model/usePitcherHitScene'
import { usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamPitcherSideStageOf } from '@/pages/team-game/lib/teamMatchupCards'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'

/**
 * 사람 수비 타석의 공 도착 판(도루 · 폭투) — 원본은 0x12 진입 0x3dfac 이 판을 열고 0x17 을 예약한다. 진행기도 붙든 공의 0x3dfac 을 그
 * 틀에 돌린다(`enterPitchResult`). 공격 측이 사람이면 아니다
 */
function humanArrivalPlayOf(progress: TeamGameProgress) {
  const runnerPlay = progress.pendingRunnerPlay
  return runnerPlay?.kind === 'arrival' && runnerPlay.side !== '공격' ? runnerPlay : null
}

/** 사람 수비 타석 장면이 CPU 타자의 맞은 공(0x11 끝 · 0x13)을 그릴 재료 — 사람 수비 판이 섰을 때만 판 입력 */
function hitSceneInputOf(session: TeamGameSession, isFrozen: boolean) {
  const { progress } = session
  const pendingHumanDefense = session.pendingDefensePlay?.side === '수비' ? session.pendingDefensePlay.input : null
  const humanDefenseStage = teamPitcherSideStageOf(progress)
  return {
    play: pendingHumanDefense,
    pitch: progress.lastPitch,
    cpuSwing: progress.lastCpuSwing ?? null,
    batterHand: humanDefenseStage.batterSide ?? humanDefenseStage.batterForm & 1,
    aceOrder: humanDefenseStage.acePitcher?.order ?? null,
    isFrozen,
  }
}

/**
 * 수비 판(상태 0x17)과 그 앞 사람 투구 장면 — 판이 섰어도 0x11 끝 · 0x12 · 0x13 을 그리는 동안은 아직 0x17 전이다.
 * `isFrozen` 은 일시정지 팝업(경기 중 메뉴 · 조작방법) — 0x52cc6
 */
export function usePitchScenePlayHold(session: TeamGameSession, isFrozen: boolean) {
  const { progress } = session
  /** 수비 화면이 실시간으로 도는 판(타구 · 사람 수비의 주자 판)이 있는가 — 원본 상태 0x17 */
  const isDefenseInPlay = session.pendingDefensePlay !== null || progress.pendingRunnerPlay != null
  /**
   * 사람이 던진 공을 CPU 타자가 맞혔으면 판정 틀까지 0x11 · 이어 0x13 을 사람 수비 타석 장면이 그린 뒤 0x17(수비 판)이다
   * (`usePitcherHitScene` — 투수편과 같다). 그동안 수비 판은 진행기에 서 있지만 화면은 아직 안 띄운다.
   * 그동안은 아직 0x17 이 아니라 '*' 메뉴가 열린다(0x498d4 4991c — 상태 0xd~0x15, `isPlayKeyBlocked`)
   */
  const teamHitScene = usePitcherHitScene(hitSceneInputOf(session, isFrozen))
  const isHitSceneShowing = teamHitScene.isShowing
  /** 그 다음 그림까지 사람 수비 타석 장면(0x12 틱 0)을 두고 수비 화면을 띄운다 (`usePitchArrivalHold` — 투수편과 같다) */
  const humanArrivalPlay = humanArrivalPlayOf(progress)
  const isArrivalHolding = usePitchArrivalHold({ play: humanArrivalPlay, isFrozen })
  /** 사람 투구 장면이 아직 0x11 끝 · 0x12 · 0x13 을 그리는 동안(판은 섰지만 0x17 전) */
  const isPitchSceneBeforePlay = isHitSceneShowing || isArrivalHolding
  /** 원본 상태 0x17 — 공용 키 0x498d4 의 '*'(상태 0xd~0x15) · '#' · 도루가 안 열린다 */
  const isPlayKeyBlocked = isDefenseInPlay && !isPitchSceneBeforePlay
  return { isDefenseInPlay, teamHitScene, isHitSceneShowing, humanArrivalPlay, isArrivalHolding, isPitchSceneBeforePlay, isPlayKeyBlocked }
}
