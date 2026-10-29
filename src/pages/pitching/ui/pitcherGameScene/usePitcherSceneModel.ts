import { hiddenStealBasesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { useWarmFieldBackgrounds } from './otherSlices'
import { pitcherBackdropOf } from './pitcherBackdrop'
import type { PitcherGameSceneProps } from './pitcherGameSceneProps'
import { acceptsGiveUpKeyOf, acceptsPickoffOf } from './pitcherSceneConditions'
import { usePitcherBurst } from './usePitcherBurst'
import { usePitcherConfirm } from './usePitcherConfirm'
import { usePitcherFieldWalkers } from './usePitcherFieldWalkers'
import { usePitcherInputState } from './usePitcherInputState'
import { useGiveUpKey, usePickoffKeys } from './usePitcherKeys'
import { usePitcherRecordAlert } from './usePitcherRecordAlert'
import { usePitcherSceneSetup } from './usePitcherSceneSetup'
import { useLiveGameState, usePitchPhaseReset, useStarKey } from './usePitcherSceneKeys'
import { usePitchHolds } from './usePitchHolds'
import { usePitchWait } from './usePitchWait'
import { useReplayRelay } from './useReplayRelay'

/** 판 끝(0x17)의 수비 판이 화면에 서 있는가 — 0x11 끝 · 0x13 · 공 도착 판의 0x12 틱 0 을 그리는 동안은 아직 0x17 이 아니다 */
function isInPlayShownOf(progress: PitcherGameProgress, holds: ReturnType<typeof usePitchHolds>, isReplaying: boolean): boolean {
  const isHitPlayShown = progress.pendingDefensePlay !== null && !holds.isHitSceneShowing
  const isRunnerPlayShown = progress.pendingRunnerPlay != null && !holds.isArrivalHolding
  return isHitPlayShown || isRunnerPlayShown || isReplaying
}

/** 공용 키 0x498d4 의 상태 범위(0xd~0x15) 밖 — 인트로 0xc · 판 0x18 · 벤치 클리어링 0x1e · 경기 끝 */
function isSceneShowingOf(setup: ReturnType<typeof usePitcherSceneSetup>, isBenchClearing: boolean): boolean {
  return !setup.closed.isIntroDone || setup.isHalfInningBoardOpen || isBenchClearing || setup.summary !== null
}

/** 중계(0x21)를 그리는가 — 0x12 끝 돌발 판정이 참이면 0x35108 이 0x21 로 덮은 +0x1b6c 는 결과 창(0x1d)을 닫은 뒤다 (K 돌발 · R10 0x12 끝) — 창이 먼저 */
function isRelayingOf(replay: ReturnType<typeof useReplayRelay>, pitchWaitTicks: number, hasResolution: boolean): boolean {
  const { relay } = replay
  return relay !== null && relay.serial !== replay.shownRelaySerial && !replay.isReplaying && pitchWaitTicks === 0 && !hasResolution
}

/** 돌발 제안 창(0x1b)은 0xe 의 OK 뒤 메시지 1 이 굴려 예약한다(0x50c42) — OK 전에는 안 띄운다. 결과 창은 0xe 앞이다 */
function visibleBurstLinesOf(burst: ReturnType<typeof usePitcherBurst>, isAwaitingConfirm: boolean) {
  return burst.resolution === null && isAwaitingConfirm ? null : burst.burstLines
}

/** 돌발 띠 0x8e858 의 [M+0xc] — 발동부터 결과 창을 닫을 때(0x8e5b8 8e7ee~8e800)까지 */
const burstBandRowOf = (burst: ReturnType<typeof usePitcherBurst>) => burst.burst?.current ?? burst.resolution?.row ?? null

/**
 * **투수편 경기 장면의 상태 · 훅 차례** — 옛 `PitcherGameScene` 몸통의 훅을 같은 차례로 부른다(effect · layout effect 차례가 곧 원본 틀 안
 * 차례다). 그림 갈래(`pitcherSceneBranches` · `pitcherStage`)는 여기서 돌려준 값으로 그리기만 한다.
 */
export function usePitcherSceneModel(props: PitcherGameSceneProps) {
  const { options, random, session } = props
  const { progress, canPitch, actions } = session
  const setup = usePitcherSceneSetup(props)
  const { summary, isHalfInningBoardOpen } = setup
  const walkers = usePitcherFieldWalkers(options, progress, props.fieldLineups)
  const isSceneShowing = isSceneShowingOf(setup, walkers.isBenchClearing)
  const input = usePitcherInputState()
  const { phase, isPopupOpen, asksGiveUp, overlay } = input
  useLiveGameState(progress)
  usePitchPhaseReset(canPitch, progress, input.setPhase)
  useStarKey(input.menu, isSceneShowing, overlay)
  const burst = usePitcherBurst(progress, input.shownProposal)
  const { resolution } = burst
  const replay = useReplayRelay({ progress, play: setup.play, shownPlay: setup.shownPlay, isPopupOpen })
  const { isReplaying } = replay
  /** 투구 입력 단계를 가리는 팝업 — 원본은 그 동안 상태 틱이 멈추고(0x741a0) 단계 상태는 그대로다 */
  const isPitchInputPaused = isPopupOpen || asksGiveUp
  const holds = usePitchHolds(progress, isPitchInputPaused, isReplaying)
  const wait = usePitchWait({
    ...{ session, random, pitchEnd: holds.pitchEnd, arrivalPlay: holds.arrivalPlay },
    ...{ atBatBeforeThrowRef: holds.atBatBeforeThrowRef, isPopupOpen, isFrozen: isPitchInputPaused },
  })
  const { isPitchSceneBusy, lastResolutionRef } = wait
  /**
   * st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 루에 안 그린다(`hiddenStealBasesOf`, 0x520de → 0xa9bd4).
   * 진행기가 같은 걸음에 다음 공의 0xf 진입까지 돌려도 원본 0xf 진입은 0x12 뒤라 공이 날거나 0x12 인 동안은 숨긴다 —
   * 내 공이 날거나 0x12 인 동안(0x11 · 0x12) — 던진 걸음의 첫 그림은 위 효과가 대기 틱을 세우기 전이라 새 판정이 든 그림도 친다
   */
  const isPitchFlightShown =
    isPitchSceneBusy ||
    // oxlint-disable-next-line react/refs -- 새 판정이 든 첫 그림(위 효과가 ref 를 고치고 대기 틱을 세우기 전)을 가린다 — 효과가 다시 그리지 않고 끝나면 그 그림이 그대로 남는 것까지 예전과 같다
    lastResolutionRef.current !== wait.lastResolution ||
    holds.isHitSceneShowing ||
    holds.isArrivalHolding
  const hiddenRunnerBases = hiddenStealBasesOf(progress, isPitchFlightShown)
  const isRelaying = isRelayingOf(replay, wait.pitchWaitTicks, resolution !== null)
  const cover = { progress, isSceneShowing, isReplaying, isRelaying, isPitchSceneBusy, isPopupOpen, overlay, asksGiveUp }
  const confirm = usePitcherConfirm(session, cover)
  const { isAwaitingConfirm, sceneConfirm } = confirm
  const visibleBurstLines = visibleBurstLinesOf(burst, isAwaitingConfirm)
  const keyScene = { ...cover, canPitch, isAwaitingConfirm, phase, isMenuOpen: input.isMenuOpen, hasBurstLines: burst.burstLines !== null }
  usePickoffKeys(acceptsPickoffOf(keyScene), actions.pickoff, progress.game.bases)
  const acceptsGiveUpKey = acceptsGiveUpKeyOf(keyScene, sceneConfirm.isInConfirmState, visibleBurstLines !== null)
  const pressGiveUp = useGiveUpKey(acceptsGiveUpKey, input.setAsksGiveUp)
  const backdrop = pitcherBackdropOf(options)
  // 타석 바닥 · 수비 바탕을 미리 칠한다 — 원본은 구장 객체 적재 때 팔레트를 갈아 끼운다
  useWarmFieldBackgrounds(backdrop.grassPalette)
  const { burstResultTickRef, recordAlert } = usePitcherRecordAlert(progress, holds.pitchEnd.serial, {
    isInPlayShown: isInPlayShownOf(progress, holds, isReplaying),
    isFrozen: isPitchInputPaused,
    state: {
      ...{ isIntroDone: setup.closed.isIntroDone, isHalfInningBoardOpen, board: setup.board, isBenchClearing: walkers.isBenchClearing },
      ...{ summary, isEndBoardClosed: setup.closed.isEndBoardClosed, isAwaitingConfirm, isPitchFlightShown, phase },
    },
  })
  return {
    ...{ props, setup, walkers, isSceneShowing, input, burst, replay, isPitchInputPaused, holds, wait, hiddenRunnerBases, isRelaying },
    ...{ confirm, visibleBurstLines, burstBandRow: burstBandRowOf(burst), acceptsGiveUpKey, pressGiveUp, backdrop, burstResultTickRef, recordAlert },
  }
}

export type PitcherSceneModel = ReturnType<typeof usePitcherSceneModel>
