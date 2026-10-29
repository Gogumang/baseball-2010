import { useRef } from 'react'
import { usePitcherHitScene } from '@/widgets/batting-stage/model/usePitcherHitScene'
import { usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { useBatterPitchEnd } from './otherSlices'
import { stageBatterHandOf } from './pitcherStageCast'

/** 공 도착 판(도루 · 폭투) — 주자 판이 공 도착이면 그 판 */
const arrivalPlayOf = (progress: PitcherGameProgress) => (progress.pendingRunnerPlay?.kind === 'arrival' ? progress.pendingRunnerPlay : null)

/** 판(타구 · 주자 판 · 재생)이 서 있는가 — 공 끝은 그 판이 끝날 때다 */
const isPlayShownOf = (progress: PitcherGameProgress, isReplaying: boolean) =>
  progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null || isReplaying

/**
 * 내 공의 0x12 대기 — 맞히지 못한 공은 갱신 0x4e6d4 가 상태 틱을 15(볼넷 · 사구 · 삼진이면 31) 까지 기다린 뒤 판정 A 가 다음
 * 상태(반 이닝이 끝났으면 0x21)로 보낸다. 웹 진행기는 공 하나에 자동진행까지 돌리므로 중계를 그 틱 뒤로 민다.
 * 웹 진행기는 놓는 순간(0x11 틱 10) 판정까지 내므로 남은 0x11 비행(공 틱 N + 1 까지)도 함께 센다(`pitchSceneBusyTicksOf`) —
 * 그동안은 원본도 0x11 · 0x12 라 다음 공의 구질 키 · 견제 · '#' · 0xe 의 OK 를 안 받는다.
 * `isFrozen` 은 장면(`isPitchInputPaused` — 팝업 · 강판 물음)과 같이 선다
 */
export function usePitchHolds(progress: PitcherGameProgress, isFrozen: boolean, isReplaying: boolean) {
  const atBatBeforeThrowRef = useRef(progress.atBat)
  /**
   * **CPU 타자가 맞힌 공의 0x11 끝 · 0x13** — 진행기는 놓는 순간 수비 판(`pendingDefensePlay`)을 세우지만 원본은 판정 틀(스윙 F + 1 ·
   * 번트 N − 1)까지 공이 날고 0x13(큰 타구면 문턱 + 7 틱)을 지나 0x17 로 간다 — 그동안 타석 장면이 그리고 0x17 이 선 틀에 수비 판을 띄운다
   */
  const pitcherHitScene = usePitcherHitScene({
    play: progress.pendingDefensePlay,
    pitch: progress.lastPitch,
    cpuSwing: progress.lastCpuSwing ?? null,
    batterHand: stageBatterHandOf(progress),
    isFrozen,
  })
  /**
   * **공 도착 판(도루 · 폭투)의 0x12 틱 0** — 진행기는 붙든 공의 0x3dfac 을 0x12 진입 틀에 돌려(`enterPitchResult`) 그 틀에 주자 판
   * (`pendingRunnerPlay`)을 세운다. 원본도 그 진입이 0x17 을 예약하므로 다음 그림까지 타석 장면을 두고 수비 화면을 띄운다 (`usePitchArrivalHold`)
   */
  const arrivalPlay = arrivalPlayOf(progress)
  const isArrivalHolding = usePitchArrivalHold({ play: arrivalPlay, isFrozen })
  /**
   * **공 끝 0x4e600 의 때** — 0x12 끝(문턱 갱신 0x4e796) · 0x17 끝(0x52a60). 진행기는 놓는 순간(0x11 틱 10) 판정을 내므로 그 판정이
   * 든 그림에서 0x12 틱 0 까지(`pitchResultEntryDelayTicksOf`) 를 대기 앞에 붙인다. 맞은 공 · 공 도착 판(도루 · 폭투)은 그 판(0x13 을
   * 그리는 동안 포함)이 끝날 때, 견제 · 밀어내기 판도 그 판이 끝날 때다 (`useBatterPitchEnd` — 타자편과 같은 셈)
   */
  const pitchEnd = useBatterPitchEnd({ isPlayShown: isPlayShownOf(progress, isReplaying), isFrozen })
  return { atBatBeforeThrowRef, pitcherHitScene, isHitSceneShowing: pitcherHitScene.isShowing, arrivalPlay, isArrivalHolding, pitchEnd }
}
