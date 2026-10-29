import { useState } from 'react'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import type { MenuOverlay, PitchPhase } from './teamGameSceneProps'

/** 투구 세 단계(구질 0xf → 코스 0x10 → 게이지 0x11)의 고른 칸 */
export function usePitchInputState() {
  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  /** 0x10 에서 확정한 조준점 `+0x10b8` — 게이지(0x11) 뒤 놓을 때 쓴다 */
  const [aim, setAim] = useState<WorldPoint | null>(null)
  return { phase, setPhase, slot, setSlot, aim, setAim }
}

/** 경기 중 메뉴('*') · 그 하위 화면(조작방법 · 설정) · 중계 질문 창 — 공용 창 표지도 여기서 건다 */
export function useSceneMenu() {
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  // (두 번 거는 것도 옛 모양 그대로 — 장면 표지 셈 `markGameSceneUp` 이 둘 선다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /** 자동진행 중계(0x21)의 CLR 중단 질문 창이 서 있다 — 기록 달성 알림이 멈춘다 (`TeamAutoRelay.onAskingChange`) */
  const [isRelayAsking, setRelayAsking] = useState(false)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  return { menu, isMenuOpen, overlay, setOverlay, isRelayAsking, setRelayAsking }
}
