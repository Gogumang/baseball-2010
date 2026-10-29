import { useEffect, useState } from 'react'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import type { MenuOverlay } from './missionPitching'

/**
 * 경기 중 메뉴와 그 하위 화면 — 일시정지 팝업(0x741a0)이 떠 있는지 바뀔 때마다 부르는 쪽에 알린다(그동안 0x12 상태 틱이 멈춘다, 0x52cc6).
 * 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
 */
export function usePitchingMenu(onPopupFrozenChange: ((isFrozen: boolean) => void) | undefined) {
  const menu = useInGameMenuState()
  useMarksGameScene()
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /** 일시정지 팝업(0x741a0)이 떠 있는가 — 경기 중 메뉴 또는 그 하위 [조작방법] 뷰어. 경기 키가 안 간다 */
  const isPopupOpen = menu.isOpen || overlay !== null
  useEffect(() => {
    onPopupFrozenChange?.(isPopupOpen)
  }, [isPopupOpen, onPopupFrozenChange])
  return { menu, overlay, setOverlay, isPopupOpen }
}

export type PitchingMenu = ReturnType<typeof usePitchingMenu>

/**
 * 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*' 로 읽는다, 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴를 연다.
 * 미션 장면도 같은 경기 장면 0x104 라 그대로다. 결과 화면(끝난 미션)에서는 안 열린다.
 * 단말 일시정지 0x463ac — '*' 가 받는 때이고 하위 창이 없으면 같은 메뉴를 연다
 */
export function useMenuStarKey({ menu, overlay }: PitchingMenu, isRunning: boolean): void {
  useInGameMenuOpenOnHide(menu, isRunning && overlay === null)
  const { pressStar } = menu
  useEffect(() => {
    if (!isRunning) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      pressStar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRunning, pressStar, overlay])
}
