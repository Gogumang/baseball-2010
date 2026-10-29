import { type RefObject, useEffect, useEffectEvent, useRef } from 'react'
import { useInGameMenuOpenOnHide, type useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { handleSceneKeyDown, hashKeyActionOf } from './sceneKeyDown'
import type { ChangeWindowKind, MenuOverlay, PitchPhase } from './teamGameSceneProps'

export interface SceneKeysInput {
  readonly session: TeamGameSession
  readonly summary: TeamGameSummary | null
  readonly menu: ReturnType<typeof useInGameMenuState>
  readonly overlay: MenuOverlay | null
  readonly phase: PitchPhase
  readonly changeWindow: ChangeWindowKind | null
  readonly setChangeWindow: (kind: ChangeWindowKind | null) => void
  readonly closeChangeWindow: () => void
  readonly isSceneCovering: boolean
  readonly isDefenseInPlay: boolean
  readonly isPlayKeyBlocked: boolean
  readonly pitchBusyTicks: number
  readonly flightProbeRef: RefObject<(() => boolean) | null>
}

/**
 * 원본 공용 키 처리 `0x498d4` — '\*' 경기 중 메뉴 · '#' 교체 · 도루 '3'/'2'/'1' (`handleSceneKeyDown`).
 * 0xe 대기 두 칸(`isAwaitingConfirmRef` · `isInConfirmStateRef`)은 확인 대기(`useSceneConfirm`)가 선 뒤 커밋 때 적는다.
 */
export function useSceneKeys(input: SceneKeysInput) {
  const { session, menu, overlay, changeWindow, setChangeWindow, closeChangeWindow, isSceneCovering, isPlayKeyBlocked } = input
  const { progress, canPitch, actions } = session
  const isMenuOpen = menu.isOpen
  const isStealable = session.stealableBases
  /** 상태 0xe 에서 OK 를 기다리는 중인가 — 아래 `useSceneConfirm` 의 값을 커밋 때 적는다 */
  const isAwaitingConfirmRef = useRef(false)
  /** 대기 중 0xd 두 그림을 지나 0xe 에 들어섰는가 — '#' 는 0xe·0xf 에서만 열린다 */
  const isInConfirmStateRef = useRef(false)
  /** '#' 키 — 받은 다음 틀에 처리한다(`pushSceneKey`, `hashKeyActionOf`) */
  const pressHashKey = useEffectEvent(() => {
    const action = hashKeyActionOf({
      isSceneCovering,
      isDefenseInPlay: input.isDefenseInPlay,
      overlay,
      isMenuOpen,
      changeWindow,
      isAwaitingConfirm: isAwaitingConfirmRef.current,
      isInConfirmState: isInConfirmStateRef.current,
      pitchBusyTicks: input.pitchBusyTicks,
      canChangePitcher: session.canChangePitcher,
      canPinchHit: session.canPinchHit,
    })
    if (action === '닫기') return closeChangeWindow()
    if (action !== null) setChangeWindow(action)
  })
  /** 교체 창(0xb)의 CLR — 0x495fc 가 받은 다음 틀에 닫는다 */
  const pressChangeWindowClear = useEffectEvent(() => {
    if (changeWindow !== null && !isMenuOpen && overlay === null) closeChangeWindow()
  })
  // 단말 일시정지 0x463ac — '*' 가 메뉴를 여는 때(경기 끝 판 · 중계 0x21 · 교대 판 · 수비 진행 · 교체 창 0xb 밖)이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(
    menu,
    input.summary === null && progress.autoRelay == null && !isSceneCovering && !isPlayKeyBlocked && overlay === null && changeWindow === null,
  )
  const { pressStar, close: closeMenu } = menu
  const { flightProbeRef } = input
  useEffect(() => {
    const state = {
      isSceneCovering,
      isPlayKeyBlocked,
      overlay,
      isMenuOpen,
      changeWindow,
      stealableBases: isStealable,
      pressStar,
      closeMenu,
      pressHashKey: () => pressHashKey(),
      pressChangeWindowClear: () => pressChangeWindowClear(),
      steal: (base: (typeof isStealable)[number]) => {
        if (flightProbeRef.current?.() === true) actions.steal(base)
      },
    }
    const onKeyDown = (event: KeyboardEvent) => handleSceneKeyDown(event, state)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    actions,
    canPitch,
    changeWindow,
    closeChangeWindow,
    isPlayKeyBlocked,
    isSceneCovering,
    isMenuOpen,
    isStealable,
    closeMenu,
    pressStar,
    overlay,
    input.phase,
    session.canChangePitcher,
    session.canPinchHit,
    flightProbeRef,
  ])
  return { isAwaitingConfirmRef, isInConfirmStateRef }
}
