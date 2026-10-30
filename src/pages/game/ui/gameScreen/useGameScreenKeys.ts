import { useEffect, type RefObject } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { useInGameMenuOpenOnHide, type InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { MenuOverlay } from './gameScreenProps'

/**
 * 도루 키를 장면 키 칸에 넣는다 — 다음 틀의 키 0x498d4 → 0x53670 → 0x53610 이 그 틀의 상태(0x11)를 보고 출발시킨다.
 * `flightProbeRef` 는 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다.
 * `event` — 누름 칸의 사건(닿은 시각이 붙어 있다 — `PressArea`). 키는 창 잡기 단계가 이미 사건 시각으로 칸을 넣었다
 */
export function pushStealKey(
  flightProbeRef: RefObject<(() => boolean) | null>,
  onSteal: ((base: StealBase) => void) | undefined,
  base: StealBase,
  event?: Event,
): void {
  pushSceneKey(
    () => {
      if (flightProbeRef.current?.() !== true) return
      onSteal?.(base)
    },
    'press',
    event === undefined ? undefined : inputTimeOf(event),
  )
}

/**
 * 경기 화면의 키 — 단말 일시정지 · 원본 공용 키 처리 0x498d4('*' 메뉴 · 도루 '3'/'2'/'1').
 * `isStageReplaced` — 벤치 클리어링(0x1e)·1회초 판(0x18)이 타석 대신 섰다.
 */
export function useGameScreenKeys(
  menu: InGameMenuState,
  overlay: MenuOverlay | null,
  isStageReplaced: boolean,
  stealableBases: readonly StealBase[],
  stealIfFlying: (base: StealBase) => void,
): void {
  // 단말 일시정지 0x463ac — '*' 가 열리는 때(벤치 클리어링 · 1회초 판 밖)이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, !isStageReplaced && overlay === null)
  // 벤치 클리어링(0x1e)·1회초 판(0x18) 중에는 공용 키가 안 열린다 (0x498d4 의 상태 범위 밖).
  // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
  const isCommonKeyClosed = isStageReplaced || overlay === '조작방법'
  const isStealKeyOpen = !menu.isOpen && overlay === null
  /** 도루 칸 목록이 그림마다 새 배열이라 예전에도 그림마다 다시 걸었다 — deps 없이 같다 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isCommonKeyClosed) return
      if (event.key === '*') {
        event.preventDefault()
        return menu.pressStar()
      }
      if (!isStealKeyOpen) return
      const base = stealBaseOfKey(event.key)
      if (base === null || !stealableBases.includes(base)) return
      event.preventDefault()
      // 공이 나는 동안(상태 0x11)만 — 그 밖의 키는 원본도 먹고 끝난다
      stealIfFlying(base)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
