import type { ReactNode } from 'react'
import { ITEM_WINDOW_KIND } from '@/widgets/season/lib/seasonItemMenu'
import { SeasonItemMenuScreen } from '@/pages/season'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { PLAYER_PICK_PURPOSE } from '@/entities/season-mode/model/playerPick'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

export function itemMenuBranch({
  scene,
  state,
  session,
  actions,
  setShopKind,
  setShopCursor,
  setPlayerPick,
  backToManagement,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.아이템) return null
  return (
    <SeasonItemMenuScreen
      state={state}
      cursor={session.menuCursors.itemMenu}
      onCursorChange={(index) => actions.moveMenuCursor('itemMenu', index)}
      // 0xdc 는 칸마다 다른 창(0x5f3c)을 연다 — 칸 1 구장(종류 4) · 2 서브아이템(1) · 3 GP(2).
      // 칸 0 장착아이템은 먼저 선수 고르기 0xdf(this+0x110 = 1, 키 0x4da4)다
      onSelect={(_item, target, windowKind) => {
        if (target === SEASON_SCENE_STATE.선수고르기) {
          // 이전 상태가 0xd0 이라 탭은 1(투수) · 커서 0 (0x5980)
          setPlayerPick({ purpose: PLAYER_PICK_PURPOSE.장착아이템, tab: ENTRY_TAB.투수, cursor: 0 })
          return actions.goto(target)
        }
        // 구장·서브·GP 창은 선수 고르기를 안 거친다 — 장비 창 갈래(0xdf 목적 1)로 잘못 들어가지 않게 지운다
        setPlayerPick(null)
        if (windowKind === ITEM_WINDOW_KIND.서브아이템 || windowKind === ITEM_WINDOW_KIND.GP아이템) {
          setShopKind(windowKind)
          setShopCursor(0)
          return actions.goto(target)
        }
        setShopKind(null)
        // 남은 칸은 구장(종류 4)뿐이다 — 장비(3)는 위 0xdf 로 먼저 빠진다 (`SEASON_ITEM_MENU` 네 칸)
        return actions.goto(target)
      }}
      onBack={backToManagement}
      gamePoint={session.gamePoints}
    />
  )
}
