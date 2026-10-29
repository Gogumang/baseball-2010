import { BOUNCE_BY_UPDATE, NO_DISABLED_IDS, SPECIAL_SWING_MENU_ID } from './menuTypes'
import type { MenuContext } from './menuContext'
import type { useMenuSlots } from './useMenuSlots'

interface MenuViewInput {
  readonly m: MenuContext
  readonly menuSlots: ReturnType<typeof useMenuSlots>
  readonly update: number
  readonly playback: { readonly playingMenuId: string | null; readonly start: (menuId: string) => void; readonly finish: () => void }
  readonly answer: (isYes: boolean) => void
  readonly select: (id: string) => void
  readonly back: () => void
}

/** 화면(`ManagementScreen`)이 읽는 값 · 손잡이 */
export function menuViewOf({ m, menuSlots, update, playback, answer, select, back }: MenuViewInput) {
  const { movedAt, openedAt } = menuSlots
  return {
    kind: m.kind,
    isShowingBasicInfo: m.isShowingBasicInfo,
    abilityDetailOffset: m.abilityDetailOffset,
    closeAbilityDetail: () => m.setAbilityDetailOffset(null),
    overlay: m.overlay,
    closeOverlay: () => m.setOverlay(null),
    /** 필살타법 창(상태 0x6c)의 StrMODE[66] "예" — 원본은 상태 0x7d → 0x17f5c(연출 뒤 0xa3bac) */
    startSpecialSwingTraining: () => {
      m.setOverlay(null)
      playback.start(SPECIAL_SWING_MENU_ID)
    },
    cursor: m.cursor,
    parent: menuSlots.parent,
    disabledIds: NO_DISABLED_IDS,
    bounce: movedAt === null ? 0 : (BOUNCE_BY_UPDATE[update - movedAt] ?? 0),
    slideUpdates: Math.max(0, update - openedAt),
    playingMenuId: playback.playingMenuId,
    /** 상태 125(연출 · 결과 창) — 가운데 판 0x7f814 를 뺀다 */
    isTrainingState: m.isTrainingState,
    finishTraining: playback.finish,
    restPhase: m.restPhase,
    /** 127 틀 0x19080 — 연출 끝(0x84e58)을 본 틀에 0x18e3c(사기 굴림 · 결과 창 · 저장) */
    finishRest: () => {
      if (m.restPhase !== 'playing') return
      m.setRestPhase('result')
      m.props.onSelect('휴식')
    },
    question: m.question,
    answer,
    moveCursor: m.moveCursor,
    select,
    /** 커맨드 줄 칸 누름(터치) — 커서가 설 수 없는 칸(켬 표 0 · 119 카드 아래)은 원본에 고를 길이 없다 */
    hoverSlot: (index: number) => {
      if (m.isCommandBarIdle() && !m.isSliding() && !m.isOffSlot(index)) m.moveCursor(index)
    },
    tapSlot: (id: string) => {
      if (m.isCommandBarIdle() && !m.isSliding() && !m.isOffSlot(m.slots.findIndex((slot) => slot.id === id))) select(id)
    },
    back,
  }
}
