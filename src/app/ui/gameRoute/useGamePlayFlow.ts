import { useState } from 'react'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { useFreePassPlayStart } from '@/pages/defense/model/useFreePassPlayStart'
import { useHitByPitchWait } from '@/pages/defense/model/useHitByPitchWait'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import { useGameWalkerSeats } from '@/app/ui/gameRoute/useGameWalkerSeats'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'
import type { useGameSceneSetup } from '@/app/ui/gameRoute/useGameSceneSetup'

interface PlayFlowInput extends Pick<GameRouteProps, 'session' | 'progress' | 'random' | 'career'> {
  readonly play: GameProgress['lastDefensePlay']
  readonly shownPlay: ReturnType<typeof useGameSceneSetup>['shownPlay']
  readonly sceneSerial: number
  readonly alertSceneFrozenBefore: boolean
  readonly resolution: GameProgress['lastBurstResolution']
}

/** 인트로 · 밀어내기 판 · 사구 대기 · 수비 판이 서는가 · 경기 장면 두 줄의 자리 */
type DefensePlay = GameProgress['lastDefensePlay']

/** 아직 안 보여 준 플레이 — 같은 플레이를 두 번 재생하지 않는다 */
function unshownPlayOf(play: DefensePlay, shownPlay: DefensePlay): DefensePlay {
  return play !== null && play !== shownPlay ? play : null
}

/** 재생 판(`ticks`)을 지금 보여 주는가 — 밀어내기 판은 0x12 대기가 끝나야(`isReplayReady`) */
function isReplayShown(play: DefensePlay, shownPlay: DefensePlay, isReplayReady: boolean): boolean {
  return unshownPlayOf(play, shownPlay) !== null && play !== null && play.ticks.length > 0 && isReplayReady
}

export function useGamePlayFlow({
  session,
  progress,
  random,
  career,
  play,
  shownPlay,
  sceneSerial,
  alertSceneFrozenBefore,
  resolution,
}: PlayFlowInput) {
  /**
   * 경기 시작 인트로(상태 0xc) — 적재(상태 8, 웹은 로딩 팁) 끝에서 모드 1~4 만 온다. 타자편은 모드 4 라 선다.
   * 효과음 61 은 진입 예약음이라 세션이 로딩을 끝낼 때(`finishLoading`) 이미 낸다. 난수는 안 쓴다.
   */
  const [isIntroDone, setIntroDone] = useState(false)
  // 볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기(0x1f 틱) 뒤 판정 A 가 0x17 로 보낸다 — 그동안 타석 화면을 둔다
  const isReplayReady = useFreePassPlayStart(
    unshownPlayOf(play, shownPlay),
    progress.pendingBenchClearing !== null,
    alertSceneFrozenBefore,
    // 0x12 끝 돌발 판정의 결과 창(0x1d)을 닫은 뒤에야 판정 A 의 0x17
    resolution !== null,
  )
  // 사구 — 0x12 대기(판정 틀 T 다음 그림이 틱 0) 틱 31 의 4e74c 판정, 들어갔으면 다음 틀의 진입 0x3a5f0 (A-22)
  useHitByPitchWait({
    hold: progress.pendingBenchClearing,
    waitTicks: RESULT_WAIT_TICKS_AT_BAT_END,
    isFrozen: alertSceneFrozenBefore,
    random,
    onJudge: session.actions.judgeHitByPitch,
    onEnter: session.actions.enterBenchClearing,
  })
  /** 사람 주루 키를 받으며 실시간으로 도는 주자 판(도루 · 폭투 · CPU 견제) — `progress.pendingRunnerPlay` */
  const runnerPlay = progress.pendingRunnerPlay ?? null
  const isDefenseShown = progress.pendingDefensePlay !== null || runnerPlay !== null || isReplayShown(play, shownPlay, isReplayReady)
  const walkerSeats = useGameWalkerSeats({ progress, career, sceneSerial, runnerPlay, play })
  return { isIntroDone, setIntroDone, isReplayReady, runnerPlay, isDefenseShown, walkerSeats }
}
