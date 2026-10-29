import { useEffect, useState } from 'react'
import { COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'
import { clearNariReturnSubMenu, createNariMainMenuCursor, nariReturnSubMenuOf } from '@/pages/management/model/nariMainMenuCursor'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
import { SETTLED_UPDATES, type MenuKind } from './menuTypes'

/** 커맨드 줄 칸 — 메뉴 종류 · 커서 · 부모 칸 · 튐(옮긴 갱신) · 펼침(연 갱신). 111 상점 · 121 장비착용에서 돌아왔으면 그 하위 메뉴 그 칸 */
export function useMenuSlots(heldCursor: NariMainMenuCursor | undefined) {
  /** 관리 메뉴 [this+0x8c] 커서 — 루트가 들고 있으면 그것(다른 화면을 다녀와도 남는다), 아니면 이 화면 몫 */
  const [ownMainCursor] = useState(createNariMainMenuCursor)
  const mainCursor = heldCursor ?? ownMainCursor
  /** 111 상점 · 121 장비착용에서 돌아왔으면 그 하위 메뉴(110 · 106) 그 칸, 다 펼쳐진 채 (`nariReturnSubMenuOf`) */
  const [returned] = useState(() => nariReturnSubMenuOf(mainCursor))
  const [kind, setKind] = useState<MenuKind>(returned?.kind ?? 'main')
  const [cursor, setCursor] = useState(() => returned?.cursor ?? mainCursor.current)
  const [parent, setParent] = useState<MenuSlot | null>(() =>
    returned === null ? null : (COMMAND_SLOTS.find((slot) => slot.id === returned.kind) ?? null),
  )
  const [movedAt, setMovedAt] = useState<number | null>(null)
  const [openedAt, setOpenedAt] = useState(returned === null ? 0 : -SETTLED_UPDATES)
  useEffect(() => clearNariReturnSubMenu(mainCursor), [mainCursor])
  return { mainCursor, kind, setKind, cursor, setCursor, parent, setParent, movedAt, setMovedAt, openedAt, setOpenedAt }
}
