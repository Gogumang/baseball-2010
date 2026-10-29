import type { Dispatch, SetStateAction } from 'react'
import type { MenuSlot, SubMenuKind } from '@/pages/management/lib/managementLayout'
import type { ManagementScreenProps } from '@/pages/management/ui/ManagementScreen'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
import type { ManagementOverlay, MenuKind, MenuQuestion } from './menuTypes'

/** 한 그림의 관리 메뉴 칸 · 고치기 — 고르기 · 취소 · 키 처리기가 읽는다(그 그림의 값 그대로) */
export interface MenuContext {
  readonly props: ManagementScreenProps
  readonly mainCursor: NariMainMenuCursor
  readonly kind: MenuKind
  readonly cursor: number
  readonly slots: readonly MenuSlot[]
  readonly isShowingBasicInfo: boolean
  readonly overlay: ManagementOverlay | null
  readonly abilityDetailOffset: number | null
  readonly question: MenuQuestion | null
  readonly isTrainingState: boolean
  readonly restPhase: 'playing' | 'result' | null
  readonly setIsShowingBasicInfo: Dispatch<SetStateAction<boolean>>
  readonly setAbilityDetailOffset: Dispatch<SetStateAction<number | null>>
  readonly setOverlay: Dispatch<SetStateAction<ManagementOverlay | null>>
  readonly setRestPhase: Dispatch<SetStateAction<'playing' | 'result' | null>>
  /** 훈련 연출 시작 (`useTrainingPlayback().start`) */
  readonly startTraining: (menuId: string) => void
  readonly open: (next: MenuKind, parent: MenuSlot | null) => void
  readonly openSubMenu: (kind: SubMenuKind) => void
  readonly setMainCursor: (index: number) => void
  readonly moveCursor: (index: number) => void
  readonly ask: (text: string, onYes: () => void) => void
  /** 105 켬 표가 0 인 칸 — 커서가 서지 못한다 */
  readonly isOffSlot: (index: number) => boolean
  /** 119 카드 · 하위 창 · 연출이 없어 커맨드 줄이 키를 받는 때 */
  readonly isCommandBarIdle: () => boolean
  /** [gfx+0x99] · [+0x9a] — 칸이 펼쳐지는 중 */
  readonly isSliding: () => boolean
}
