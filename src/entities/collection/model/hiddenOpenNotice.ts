import { ORIGINAL_ITEMS } from '@/shared/config/original/items'

/**
 * **히든 오픈 알림 창 글 — `0x62368(ui, k, 강제)`** (직접 떴다, 0x62368~0x624c0):
 * ```
 * 강제 == 0: k == −1 → 끝 ; 0x61f5c(ui, k)(이미 열렸나) 참 → 끝        ; 0 을 돌려준다
 * 0x620b8(ui, k)                                  ; 해금표에 켠다
 * 이름 = 0x61e8c(StrITEM, k)                       ; k ≤ 12 는 StrCOMMON
 * k ≤ 7  : sprintf(글, StrCOMMON[140], 이름)        ; "!C마선수 오픈!!N[…]"
 * k ≤ 12 : sprintf(글, StrCOMMON[138], 이름)        ; "!C히든 팀 오픈!!!N[…]"
 * 그 밖  : sprintf(글, StrCOMMON[139], 이름) ; strcat "!N" 두 번(0xd1720)
 *          k ≤ 18 [141] · ≤ 34 [142] · ≤ 50 [143] 를 잇는다 (51 이상은 뒷줄 없음)
 * 0x74ef5([0x140005c] 공용 창, 글, 종류 1, 0, 0) ; 0x1f1b9 전역 저장
 * ```
 * 이름 0x61e8c (k ≥ 13): 13~15 → StrITEM[k + 0x75] 관중석 · 16~18 → [k + 0x79] 전광판 · 19~22 [k + 0x20] · 23~26 [k + 0x27] ·
 * 27~30 [k + 0x2e] · 31~34 [k + 0x35](투수 장비) · 35~38 [k − 0x1c] · 39~42 [k − 0x15] · 43~46 [k − 0xe] · 47~50 [k − 7](타자 장비).
 *
 * 웹에 StrCOMMON 표가 없어 쓰는 네 줄을 원문 그대로 적는다. 마선수 · 히든 팀(k ≤ 12)은 이 창을 쓰는 웹 자리가 없어 null.
 */
const HIDDEN_ITEM_OPEN = (name: string) => `!C히든 아이템 오픈!!!N[!cFFFF00${name}!cFFFFFF]` // StrCOMMON[139]
const LINE_BREAK = '!N' // 0xd1720
const USAGE_LINES: readonly { readonly last: number; readonly text: string }[] = [
  { last: 18, text: '시즌모드에서!N사용가능합니다' }, // StrCOMMON[141]
  { last: 34, text: '나만의리그 투수편!N에서 사용가능합니다' }, // StrCOMMON[142]
  { last: 50, text: '나만의리그 타자편!N에서 사용가능합니다' }, // StrCOMMON[143]
]

/** 0x61e8c 의 k ≥ 13 갈래 — [첫 k, 마지막 k, StrITEM 더하기] */
const NAME_RANGES: readonly (readonly [number, number, number])[] = [
  [13, 15, 0x75],
  [16, 18, 0x79],
  [19, 22, 0x20],
  [23, 26, 0x27],
  [27, 30, 0x2e],
  [31, 34, 0x35],
  [35, 38, -0x1c],
  [39, 42, -0x15],
  [43, 46, -0xe],
  [47, 50, -7],
]

/** 0x61e8c — 히든 아이템 k(13~50)의 StrITEM 이름. 표 밖이면 null */
export function hiddenItemNameOf(id: number): string | null {
  const range = NAME_RANGES.find(([first, last]) => id >= first && id <= last)
  return range === undefined ? null : (ORIGINAL_ITEMS[id + range[2]] ?? null)
}

/** 0x62368 이 공용 창에 띄우는 글 (원문 마크업). 웹이 짓지 못하는 k(≤ 12 · ≥ 51)면 null */
export function hiddenOpenNoticeTextOf(id: number): string | null {
  const name = hiddenItemNameOf(id)
  if (name === null) return null
  const usage = USAGE_LINES.find((line) => id <= line.last)
  return `${HIDDEN_ITEM_OPEN(name)}${LINE_BREAK}${LINE_BREAK}${usage?.text ?? ''}`
}

/**
 * 공용 창 [0x140005c] 의 줄 — 0x74ef4 는 창이 떠 있으면([창+9] ≠ 0) 새 글을 **대기 한 칸**(+0x2a4 = 1 · +0x2a8 에 글 복사)에
 * 덮어 두고, 창이 닫힐 때 0x75440 이 그 글로 다시 띄운다. 곧 떠 있는 것 하나 + 대기 하나 — 셋째부터는 대기를 덮는다.
 */
export interface HiddenOpenWindow {
  readonly shown: string | null
  readonly pending: string | null
}

export const EMPTY_HIDDEN_OPEN_WINDOW: HiddenOpenWindow = { shown: null, pending: null }

export function pushHiddenOpenWindow(window: HiddenOpenWindow, text: string): HiddenOpenWindow {
  return window.shown === null ? { shown: text, pending: null } : { shown: window.shown, pending: text }
}

/** 창을 닫는다 — 대기 글이 있으면 그것을 띄운다 (0x742a8 → 0x75440) */
export function closeHiddenOpenWindow(window: HiddenOpenWindow): HiddenOpenWindow {
  return { shown: window.pending, pending: null }
}

/** 새로 연 히든 k 들을 차례로 창에 넣는다 — 글을 못 짓는 k 는 건너뛴다 */
export function announceHiddenOpens(window: HiddenOpenWindow, ids: readonly number[]): HiddenOpenWindow {
  return ids.reduce((current, id) => {
    const text = hiddenOpenNoticeTextOf(id)
    return text === null ? current : pushHiddenOpenWindow(current, text)
  }, window)
}
