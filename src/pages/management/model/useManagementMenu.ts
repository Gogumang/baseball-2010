import { useEffect, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'
import type { ManagementScreenProps } from '@/pages/management/ui/ManagementScreen'
import { ABILITY_DETAIL_VISIBLE_LINES, batterAbilityDetailViewOf } from '@/pages/management/lib/abilityDetail'
import { moveNariMainCursor, nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
import { SLIDE_KEY_LOCK_UPDATES, type ManagementOverlay, type MenuKind, type MenuQuestion } from './managementMenu/menuTypes'
import type { MenuContext } from './managementMenu/menuContext'
import { useMenuSlots } from './managementMenu/useMenuSlots'
import { useTrainingResult } from './managementMenu/useTrainingResult'
import { useRestPhase } from './managementMenu/useRestPhase'
import { useActedEntry } from './managementMenu/useActedEntry'
import { menuBackOf, menuSelectOf } from './managementMenu/menuSelect'
import { menuKeyHandlerOf } from './managementMenu/menuKeys'
import { menuViewOf } from './managementMenu/menuView'

export type { ManagementOverlay } from './managementMenu/menuTypes'

/** 결과 창 · 연출 · 질문 · 창이 다 걷혀 메인 메뉴만 남은 때 */
const isIdleMainOf = (m: MenuContext) =>
  m.kind === 'main' &&
  !m.isTrainingState &&
  m.restPhase === null &&
  m.props.detail === null &&
  m.question === null &&
  m.overlay === null &&
  !m.isShowingBasicInfo

/** 관리 화면 커서·하위 메뉴·훈련 연출 상태 — 훅 차례는 옛 몸통 그대로(칸 → 창 → 틱 → 훈련 결과 → 휴식 → 행동함 → 키 → 터치) */
export function useManagementMenu(props: ManagementScreenProps) {
  const menuSlots = useMenuSlots(props.mainCursor)
  const { mainCursor, kind, cursor, openedAt } = menuSlots
  /** 선수정보 하위 메뉴에서 연 카드 — 상태판 자리에 그린다 (0x15e20) */
  const [isShowingBasicInfo, setIsShowingBasicInfo] = useState(false)
  /**
   * 능력치 상세 창(상태 120) 글 상자 첫 줄 — 창 +0x380 (진입 0x1b624 가 0 으로). null 이면 창이 없다.
   * 119 에서 '0' 으로 열고, 취소·'0' 이면 119 로 (키 0x1b654).
   */
  const [abilityDetailOffset, setAbilityDetailOffset] = useState<number | null>(null)
  /** 선수정보 하위 메뉴에서 관리 화면 위에 띄우는 창 — 기록실(팝업 0x80 → 124) · 필살타법 0x803d4 */
  const [overlay, setOverlay] = useState<ManagementOverlay | null>(null)
  const [question, setQuestion] = useState<MenuQuestion | null>(null)
  const update = useUpdateCounter()
  const setMainCursor = (index: number) => {
    moveNariMainCursor(mainCursor, index)
    menuSlots.setCursor(index)
  }
  const open = (next: MenuKind, nextParent: MenuSlot | null) => {
    setIsShowingBasicInfo(false)
    setAbilityDetailOffset(null)
    setOverlay(null)
    menuSlots.setKind(next)
    menuSlots.setParent(nextParent)
    menuSlots.setCursor(0)
    menuSlots.setOpenedAt(update)
  }
  const { playback, isTrainingState } = useTrainingResult({
    hasDetail: props.detail !== null,
    hasNotice: props.noticeText !== '',
    onTraining: props.onTraining,
    onClosed: () => {
      open('main', null)
      // 커서는 메뉴 객체 그대로(트레이닝 칸). 행동함이면 105 진입이 첫 칸으로 (`useActedEntry`)
      setMainCursor(COMMAND_SLOTS.findIndex((slot) => slot.id === '트레이닝'))
    },
  })
  // 결과 창이 닫혀 105 에 다시 든다(0x1b308 1b466 · 틀 0x19080 190cc `0xbcb49(0x69)`) — 진입 0x11910 은 늘 11c26 에서
  // 0x7ff21 로 여섯 칸을 처음 자리에 되돌리고 [gfx+0x99] = 1 이라 다시 펼친다(그동안 키를 버린다, A-50). 줄 표는 그대로고
  // 커서는 행동함 진입이 첫 칸으로 (`useActedEntry`)
  const { restPhase, setRestPhase } = useRestPhase(props.detail !== null, () => menuSlots.setOpenedAt(update))
  const slots = kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[kind]

  /** 105 켬 표가 0 인 칸 — 하위 메뉴(106 · 107 · 110)의 표는 늘 켜져 있다 */
  const mainOffIds = nariMainMenuOffIdsOf(props.career)
  const isOffSlot = (index: number) => kind === 'main' && mainOffIds.has(slots[index]?.id ?? '')
  /** 119 기본정보 카드 · 하위 창이 떠 있으면 그 상태의 키만 돈다(119 는 0x1056c 의 취소 · '*' · '0') — 커맨드 줄은 키를 안 받는다 */
  const isCommandBarIdle = () => !isShowingBasicInfo && overlay === null && abilityDetailOffset === null && !isTrainingState && restPhase === null
  /** [gfx+0x99] · [+0x9a] — 칸이 펼쳐지는 중이면 커맨드 줄 키(취소 포함) · 누름을 버린다 */
  const isSliding = () => isCommandBarIdle() && update - openedAt < SLIDE_KEY_LOCK_UPDATES
  const moveCursor = (index: number) => {
    if (index === cursor) return
    if (kind === 'main') moveNariMainCursor(mainCursor, index)
    menuSlots.setCursor(index)
    menuSlots.setMovedAt(update)
  }
  const m: MenuContext = {
    props,
    mainCursor,
    kind,
    cursor,
    slots,
    isShowingBasicInfo,
    overlay,
    abilityDetailOffset,
    question,
    isTrainingState,
    restPhase,
    setIsShowingBasicInfo,
    setAbilityDetailOffset,
    setOverlay,
    setRestPhase,
    startTraining: playback.start,
    open,
    openSubMenu: (subKind) => open(subKind, COMMAND_SLOTS.find((slot) => slot.id === subKind) ?? null),
    setMainCursor,
    moveCursor,
    ask: (text, onYes) => setQuestion({ text, onYes }),
    isOffSlot,
    isCommandBarIdle,
    isSliding,
  }
  const back = menuBackOf(m)

  useActedEntry(props.career.hasActedThisCycle, isIdleMainOf(m), () =>
    setMainCursor(nariMainCursorOnEntry(mainCursor.current, props.career.hasActedThisCycle, false)),
  )

  const select = menuSelectOf(m)
  useEffect(() => {
    const onKey = menuKeyHandlerOf(m, back, select)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 터치 기기 — 120 글이 4줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건 → 위 0x8a044 스크롤). 원본 그림에는 막대뿐이다
  useTouchScrollKeys(
    props.detail === null && abilityDetailOffset !== null && batterAbilityDetailViewOf(props.career).messages.length > ABILITY_DETAIL_VISIBLE_LINES,
  )

  const answer = (isYes: boolean) => {
    const pending = question
    setQuestion(null)
    if (isYes) pending?.onYes()
  }
  return menuViewOf({ m, menuSlots, update, playback, answer, select, back })
}
