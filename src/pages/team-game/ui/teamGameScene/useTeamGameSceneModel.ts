import { useLayoutEffect } from 'react'
import { burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { teamMatchupCardsOf } from '@/pages/team-game/lib/teamMatchupCards'
import { usePitchInputOverlayRef } from './otherSlices'
import { acceptsChangeKeyOf, acceptsPickoffOf } from './sceneConditions'
import { burstBandRowOf, isRecordAlertDrawnOf, openBoardSerialOf, opposingAcePitcherOf, visibleBurstLinesOf } from './sceneDerived'
import type { TeamGameSceneProps } from './teamGameSceneProps'
import { useBurstState } from './useBurstState'
import { useChangeWindow } from './useChangeWindow'
import { useFieldWalkers } from './useFieldWalkers'
import { usePickoffKeys } from './usePickoffKeys'
import { usePitchPhaseReset } from './usePitchPhaseReset'
import { usePitchScenePlayHold } from './usePitchScenePlayHold'
import { useReplayFlow } from './useReplayFlow'
import { useSceneBackdrop } from './useSceneBackdrop'
import { useSceneConfirmFlow } from './useSceneConfirmFlow'
import { useSceneCovers } from './useSceneCovers'
import { useSceneKeys } from './useSceneKeys'
import { usePitchInputState, useSceneMenu } from './useSceneMenu'
import { useSceneRecordAlert } from './useSceneRecordAlert'
import { useSceneScopedParts } from './useSceneScopedParts'
import { useSceneSummary, useTeamWarmCast } from './useSceneSummary'
import { useThrowSettle } from './useThrowSettle'

/**
 * **팀 경기 장면의 상태 · 훅 차례** — 옛 `TeamGameScene` 몸통의 훅을 같은 차례로 부른다(effect · layout effect 차례가 곧 원본 틀 안 차례다).
 * 그림 갈래(`teamGameSceneBranches` · `teamGameStage`)는 여기서 돌려준 값으로 그리기만 한다.
 */
export function useTeamGameSceneModel(props: TeamGameSceneProps) {
  const { options, random, session } = props
  const { progress, canBat, canPitch, actions } = session
  const { play, shownPlay, finishPlayback, isBurstResultHeld, summary } = useSceneSummary(session, props.onHalfInningSave)
  const opposingAcePitcher = opposingAcePitcherOf(progress)
  const warmCast = useTeamWarmCast(progress)
  const pitchInput = usePitchInputState()
  const { phase } = pitchInput
  const sceneMenu = useSceneMenu()
  const { menu, isMenuOpen, overlay } = sceneMenu
  /** 구질 · 조준 · 게이지 그림 재료 — 사람 수비 타석 장면이 그 위에 그린다 (0x4c4bc · 0x4d780 · 0x4d2ac) */
  const inputOverlayRef = usePitchInputOverlayRef()
  /** 일시정지 팝업(경기 중 메뉴 · 조작방법) — 장면 틱이 멈춘다 (0x52cc6) */
  const isPopupFrozen = isMenuOpen || overlay === '조작방법'
  const throwSettle = useThrowSettle(session, isPopupFrozen)
  const { isPitchSceneBusy } = throwSettle
  const covers = useSceneCovers({ mode: options.mode, progress, summary, isBurstResultHeld })
  const { isSceneCovering, isHalfInningBoardOpen } = covers
  const walkers = useFieldWalkers(options, session, play)
  const change = useChangeWindow(actions)
  const { changeWindow } = change
  usePitchPhaseReset(canPitch, progress, pitchInput.setPhase)
  const scoped = useSceneScopedParts(options, progress)
  const playHold = usePitchScenePlayHold(session, isPopupFrozen)
  const { isDefenseInPlay } = playHold
  const { isAwaitingConfirmRef, isInConfirmStateRef } = useSceneKeys({
    session,
    summary,
    menu,
    overlay,
    phase,
    changeWindow,
    setChangeWindow: change.setChangeWindow,
    closeChangeWindow: change.closeChangeWindow,
    isSceneCovering,
    isDefenseInPlay,
    isPlayKeyBlocked: playHold.isPlayKeyBlocked,
    pitchBusyTicks: throwSettle.pitchBusyTicks,
    flightProbeRef: scoped.flightProbeRef,
  })
  const burstState = useBurstState(progress, change.shownProposal)
  const { resolution, burstLines } = burstState
  const replay = useReplayFlow({ session, random, play, shownPlay, isMenuOpen, isFrozen: isPopupFrozen })
  const { isReplaying } = replay
  const confirmFlow = useSceneConfirmFlow({
    session,
    isPlayShown: isDefenseInPlay || isReplaying,
    isFrozen: isPopupFrozen,
    humanArrivalPlay: playHold.humanArrivalPlay,
    setPitchBusyTicks: throwSettle.setPitchBusyTicks,
    cover: {
      isIntroDone: covers.isIntroDone,
      hasSummary: summary !== null,
      isHalfInningBoardOpen,
      hasBenchClearing: progress.pendingBenchClearing !== null,
      isDefenseInPlay,
      isReplaying,
      isMenuOpen,
      overlay,
      changeWindow,
      isPitchSceneBusy,
      hasBurstResolution: resolution !== null,
    },
  })
  const { sceneConfirm, isAwaitingConfirm } = confirmFlow
  const backdrop = useSceneBackdrop(options, progress, props.seasonStadium)
  useLayoutEffect(() => {
    isAwaitingConfirmRef.current = isAwaitingConfirm
    isInConfirmStateRef.current = sceneConfirm.isInConfirmState
  })
  /** 0xd 두 그림을 지나 0xe 에 들어섰으면 소개 판을 그린다 (0x4d9ec → 0x44944) */
  const isMatchupShown = isAwaitingConfirm && sceneConfirm.isInConfirmState
  /**
   * 소개 판 값 — 투수 `0xae83c(수비 팀)` · 타자 `0xae89c(공격 팀)` 레코드에서 (`teamMatchupCardsOf`).
   * 팀 글자는 `0xb6c20(st, 측)`(사람 팀 PLAYER · CPU 팀 COM): 우리가 치면 타자가 PLAYER, 던지면 투수가 PLAYER.
   */
  const matchup = teamMatchupCardsOf(progress, props.matchupRecords)
  const visibleBurstLines = visibleBurstLinesOf(burstState, isAwaitingConfirm)
  const burstBandRow = burstBandRowOf(burstState)
  /** 띠 아이콘 0x8e8c4 — 화면 갈래가 아니라 진행 상태의 공격 측(g[9])과 사람 측(g[0x31 + 측] == 0)으로 고른다 */
  const burstBandRole = burstBandRoleOf(progress.game.half, progress.game.playerSide)
  const pickoffScene = { canPitch, isAwaitingConfirm, isReplaying, isSceneCovering, isDefenseInPlay, phase, isPitchSceneBusy, isMenuOpen }
  const acceptsPickoff = acceptsPickoffOf({ ...pickoffScene, overlay, changeWindow, hasBurstLines: burstLines !== null })
  usePickoffKeys(acceptsPickoff, actions.pickoff, progress.game.bases)
  const { burstResultTickRef, recordAlert } = useSceneRecordAlert({
    session,
    pitchEnd: confirmFlow.pitchEnd,
    atBatBeforeThrowRef: throwSettle.atBatBeforeThrowRef,
    isThrowPitchEndPendingRef: throwSettle.isThrowPitchEndPendingRef,
    isThrowPendingRef: throwSettle.isThrowPendingRef,
    isDrawing: isRecordAlertDrawnOf({
      isIntroDone: covers.isIntroDone,
      summary,
      isDefenseInPlay,
      isPitchSceneBeforePlay: playHold.isPitchSceneBeforePlay,
      isReplaying,
    }),
    isFrozen: isPopupFrozen || sceneMenu.isRelayAsking,
    openBoardSerial: openBoardSerialOf(isHalfInningBoardOpen, covers.board),
    humanSceneKind: humanSceneKindOf(canBat, canPitch, phase),
    isPitchSceneBusy,
    isAwaitingConfirm,
  })
  const acceptsChangeKey = acceptsChangeKeyOf({
    ...{ changeWindow, isSceneCovering, isDefenseInPlay, isMenuOpen, overlay, isAwaitingConfirm, isPitchSceneBusy, canPitch, phase },
    isInConfirmState: sceneConfirm.isInConfirmState,
    canChangePitcher: session.canChangePitcher,
    canPinchHit: session.canPinchHit,
  })
  // 점수판 틀 0x41440 의 두 측 — 사람 팀(우리) PLAYER · 상대 COM
  const scoreboardSides = humanVsComputerSidesOf(options.playerSide, options.ourTeamId, options.opponentTeamId)
  return {
    ...{ props, play, finishPlayback, isBurstResultHeld, summary, opposingAcePitcher, warmCast, pitchInput, sceneMenu, inputOverlayRef },
    ...{ throwSettle, covers, walkers, change, scoped, playHold, burstState, replay, confirmFlow, backdrop, isMatchupShown, matchup },
    ...{ visibleBurstLines, burstBandRow, burstBandRole, burstResultTickRef, recordAlert, acceptsChangeKey, scoreboardSides },
  }
}

/** 상태 틱 0 점을 가르는 사람 장면 — 타석 'bat' · 투구는 그 입력 단계 · 사람 차례가 아니면 null */
function humanSceneKindOf(canBat: boolean, canPitch: boolean, phase: string): string | null {
  if (canBat) return 'bat'
  return canPitch ? phase : null
}

export type TeamGameSceneModel = ReturnType<typeof useTeamGameSceneModel>
