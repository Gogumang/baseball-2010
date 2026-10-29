import { useState } from 'react'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { usePitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { MenuOverlay, PitchPhase } from './pitcherGameSceneProps'

/** 투구 단계 · 경기 중 메뉴 · 하위 화면 · 고른 칸 · 본 돌발 제안 · 강판 물음 — 사람 조작 칸 */
export function usePitcherInputState() {
  const [phase, setPhase] = useState<PitchPhase>('구질')
  /** 구질 · 조준 · 게이지 그림 재료 — 장면이 그 위에 그린다 (0x4c4bc · 0x4d780 · 0x4d2ac) */
  const inputOverlayRef = usePitchInputOverlayRef()
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /** 일시정지 팝업이 떠 있는가 — 경기 중 메뉴, 또는 그 하위 4 [조작방법] 뷰어 (둘 다 0x741a0 팝업이라 경기 키·갱신이 멈춘다) */
  const isPopupOpen = isMenuOpen || overlay === '조작방법'
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  /** 0x10 에서 확정한 조준점 `+0x10b8` — 게이지(0x11) 뒤 놓을 때 쓴다 */
  const [aim, setAim] = useState<WorldPoint | null>(null)
  /** 제안 대사를 이미 보여 준 돌발 행 */
  const [shownProposal, setShownProposal] = useState<BurstMissionRow | null>(null)
  /** `#` 강판 물음이 떠 있는가 */
  const [asksGiveUp, setAsksGiveUp] = useState(false)
  return {
    ...{ phase, setPhase, inputOverlayRef, menu, isMenuOpen, overlay, setOverlay, isPopupOpen },
    ...{ slot, setSlot, aim, setAim, shownProposal, setShownProposal, asksGiveUp, setAsksGiveUp },
  }
}
