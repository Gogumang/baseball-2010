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
}

export function createNariMainMenuCursor(): NariMainMenuCursor {
  return { current: 0 }
}

/**
 * 105 진입 0x11910 의 1194a~11970: S+4(행동함) 이고 이전 상태 [this+0x24](0xbcb48 이 예약 때 남긴 그때 상태)가
 * 0x6d(109 다음 경기 순위표) · 0x6e(110 아이템 하위 메뉴)가 아니면 메뉴 vtable +0x14 = 0x6c00c(메뉴, 0, 0) — 커서를 첫 칸으로.
 * 그 밖은 남는다.
 */
export function nariMainCursorOnEntry(cursor: number, hasActed: boolean, isFromStandingsOrItemMenu: boolean): number {
  return hasActed && !isFromStandingsOrItemMenu ? 0 : cursor
}
