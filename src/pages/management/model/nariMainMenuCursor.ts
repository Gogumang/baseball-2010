/**
 * **나리 관리 메뉴 [this+0x8c] 의 커서** — 타자편 · 투수편 공용(장면 0x106).
 *
 * 메뉴 객체는 장면이 서 있는 동안 남고 커서는 객체의 +0xc · +0x10 이다(0x6c00c 가 쓴다). 그래서 다른 상태(경기 · 이벤트 ·
 * 순위표 · 상점 …)를 다녀와도 커서가 그대로고, 커맨드 줄 0x7e418 은 [gfx+0x158](= 105 진입 0x11ae0 의 [this+0x8c])의
 * +0x14 × +0x10 + +0xc 칸에 커서를 그린다. 이벤트 재생이 끝난 틀(0x19da4 — 앞 상태 105)도 같은 객체 커서다.
 *
 * 웹 관리 화면은 다른 화면을 다녀오면 다시 마운트되므로 이 값을 루트가 들고(`current`), 화면 · 끝 틀이 함께 본다.
 */
export interface NariMainMenuCursor {
  current: number
  /**
   * 열린 하위 메뉴 객체의 커서 — 106 [this+0x90] · 107 [+0x94] · 110 [+0x98]. 하위 창(119 · 121~124 · 108)이나 상점 111 을 다녀와도
   * 남는다(106 진입 0x11530 은 이전 상태 [this+0x28] 가 105 일 때만 · 107 진입 0x10468 · 110 진입 0x107e0 은 아예 커서를 안 건드린다).
   * 105 에서 들어갈 때는 늘 0 이다 — 106 진입이 0 으로, 107 · 110 은 105 진입 0x11910(1191a~11936)이 늘 0 으로 되감아 둔다.
   * 그래서 한 번에 하나만 열리는 웹은 이 값 하나로 셋을 대신한다. 없으면 0.
   */
  subCursor?: number
  /**
   * 하위 메뉴가 선 채로 화면 밖 상태로 갔다 — 110 확인 → 111 상점(키 0x11478), 106 칸 1 → 121 장비착용(키 0x13010). 그 취소는 105 가
   * 아니라 하위 메뉴로 돌아온다(111 키 0x13460 의 13b1e → 0x6e · 121 키 0x17ad0 의 17aee → 0x6a). 웹은 그 화면이 관리 화면을 내리므로
   * 다시 마운트될 때 이 값을 보고 그 하위 메뉴(`subCursor` 칸)에 선다(`nariReturnSubMenuOf`).
   */
  returnSubMenu?: NariReturnSubMenu | null
}

/** 화면 밖 상태에서 돌아오는 하위 메뉴 — 110 아이템(111 상점에서) · 106 선수정보(121 장비착용에서) */
export type NariReturnSubMenu = '아이템' | '선수정보'

export function createNariMainMenuCursor(): NariMainMenuCursor {
  return { current: 0, subCursor: 0, returnSubMenu: null }
}

/** 하위 메뉴 칸 `subCursor` 에서 화면 밖 상태(111 · 121)로 간다 — 돌아오면 그 하위 메뉴 그 칸 */
export function leaveNariSubMenu(cursor: NariMainMenuCursor, kind: NariReturnSubMenu, subCursor: number): void {
  cursor.returnSubMenu = kind
  cursor.subCursor = subCursor
}

/**
 * 관리 화면이 다시 마운트될 때 — 111 · 121 에서 돌아왔으면 그 하위 메뉴와 칸. 110 진입 0x107e0 · 106 진입 0x11530(이전 ≠ 105)은
 * 하위 메뉴 객체를 [gfx+0x15c] 에 다시 걸 뿐 커서도 펼침(0x7ff55 — 105 키만 부른다)도 안 건드려, 칸은 다 펼쳐진 채 그 커서다.
 */
export function nariReturnSubMenuOf(cursor: NariMainMenuCursor): { readonly kind: NariReturnSubMenu; readonly cursor: number } | null {
  const kind = cursor.returnSubMenu ?? null
  return kind === null ? null : { kind, cursor: cursor.subCursor ?? 0 }
}

/**
 * 105 진입 0x11910 의 1194a~11970: S+4(행동함) 이고 이전 상태 [this+0x24](0xbcb48 이 예약 때 남긴 그때 상태)가
 * 0x6d(109 다음 경기 순위표) · 0x6e(110 아이템 하위 메뉴)가 아니면 메뉴 vtable +0x14 = 0x6c00c(메뉴, 0, 0) — 커서를 첫 칸으로.
 * 그 밖은 남는다.
 */
export function nariMainCursorOnEntry(cursor: number, hasActed: boolean, isFromStandingsOrItemMenu: boolean): number {
  return hasActed && !isFromStandingsOrItemMenu ? 0 : cursor
}
