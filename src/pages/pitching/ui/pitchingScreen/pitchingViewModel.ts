import type { Dispatch, SetStateAction } from 'react'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchPhase } from './missionPitching'
import type { PitchingScreenProps } from './pitchingScreenProps'
import type { PitchingMenu } from './usePitchingMenu'

/** 기본값을 채운 화면 props — 조준 칸 1 · 교체 연출 없음 · 도루 표시 없음 */
export type ResolvedPitchingProps = PitchingScreenProps & {
  readonly aimSide: number
  readonly substitutionScene: SubstitutionScene | null
  readonly stealDisplay: NonNullable<PitchingScreenProps['stealDisplay']> | null
}

/** 경기 중 화면을 그리는 부품들이 함께 보는 값 — 화면 상태 고리가 만든다 */
export interface PitchingViewModel {
  readonly props: ResolvedPitchingProps
  readonly phase: PitchPhase
  readonly setPhase: Dispatch<SetStateAction<PitchPhase>>
  /** 0xf 에서 고른 구질 */
  readonly pitchType: PitchTypeInfo | null
  readonly setPitchType: Dispatch<SetStateAction<PitchTypeInfo | null>>
  /** 0x10 에서 확정한 조준점 — 게이지(0x11) 뒤 놓을 때 쓴다 */
  readonly aim: WorldPoint | null
  readonly setAim: Dispatch<SetStateAction<WorldPoint | null>>
  /** 구질 · 조준 · 게이지 그림 재료 — 장면이 그 위에 그린다 (0x4c4bc · 0x4d780 · 0x4d2ac) */
  readonly inputOverlayRef: PitchInputOverlayRef
  readonly menuState: PitchingMenu
  readonly sceneConfirm: ReturnType<typeof useSceneConfirm>
  /** 상태 0xe — 새 타석의 OK 를 기다리는 중 */
  readonly isAwaitingConfirm: boolean
  /** 공이 날거나 0x12 · 0x13 인 동안 (`usePitchSceneBusy`) */
  readonly isPitchSceneBusy: boolean
}

/** 0xf 구질 목록이 실린 동안 — 빛 지도(4c5a6)가 HUD 까지 어둡게 한다 */
export const isPitchMenuShownOf = (model: PitchingViewModel) => model.phase === '구질' && !model.isAwaitingConfirm && !model.isPitchSceneBusy
