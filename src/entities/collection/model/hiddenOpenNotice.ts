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
 * 이름 0x61e8c (k ≤ 12, 표를 StrCOMMON 으로 바꿔 읽는다 — 0x61f40 `cmp r2,#0xc; bgt`): 0~3 → StrCOMMON[k + 0x10] ·
 * 4~7 → [k + 0x11](마선수, 싸이커 15 · 메디카 20 은 건너뜀) · 8~12 → [k + 2](히든 팀 대한민국 … 외인구단).
 * k ≤ 12 는 0x623fc 에서 곧장 창으로 가 "!N!N" · 쓰는 곳 줄이 없다.
 * 어느 구간에도 안 드는 k(< 0 · ≥ 51)는 r1 = −1 로 0x702b5 를 불러 [표+8] = 0x100 을 적고 0(NULL)을 돌려받는다(0x702b6~0x702c8)
 * — ⚠️ 미확인: 그 NULL 을 받은 sprintf 가 무엇을 쓰는지는 안 읽었다. 웹은 null 로 두고 창을 안 띄운다.
 * 대전 승리 팝업 0x4b100(4b28c)도 같은 함수를 비트 0..50 으로 부른다(`versusWinPopupTextOf`).
 *
 * 웹에 StrCOMMON 표가 없어 쓰는 줄을 원문 그대로 적는다.
 */
const HIDDEN_ITEM_OPEN = (name: string) => `!C히든 아이템 오픈!!!N[!cFFFF00${name}!cFFFFFF]` // StrCOMMON[139]
const HIDDEN_TEAM_OPEN = (name: string) => `!C히든 팀 오픈!!!N[!cFFFF00${name}!cFFFFFF]` // StrCOMMON[138]
const ACE_OPEN = (name: string) => `!C마선수 오픈!!N[!cFFFF00${name}!cFFFFFF]` // StrCOMMON[140]
/** 0x61e8c 의 k ≤ 12 — StrCOMMON[16~19] · [21~24] 마선수 · [10~14] 히든 팀 (원문) */
const LOW_NAMES: readonly string[] = [
  '레오니', '붕붕머신', '발렌타인', '드래고나', // k 0~3 → StrCOMMON[16~19]
  '어거지죠', '로제', '크라이져', '킹타이거', // k 4~7 → StrCOMMON[21~24]
  '대한민국', '일본', '쿠바', '미국', '외인구단', // k 8~12 → StrCOMMON[10~14]
]
const LAST_ACE_ID = 7
const LAST_TEAM_ID = 12
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

/** 0x61e8c — 해금 k(0~50)의 이름. 표 밖이면 null */
export function hiddenNameOf(id: number): string | null {
  if (Number.isInteger(id) && id >= 0 && id <= LAST_TEAM_ID) return LOW_NAMES[id] ?? null
  return hiddenItemNameOf(id)
}

/** 첫 줄 — k ≤ 7 StrCOMMON[140] · ≤ 12 [138] · 그 밖 [139] (0x623ca~0x6241c · 0x622d4~0x622f4 같은 갈래) */
function headLineOf(id: number, name: string): string {
  if (id <= LAST_ACE_ID) return ACE_OPEN(name)
  return id <= LAST_TEAM_ID ? HIDDEN_TEAM_OPEN(name) : HIDDEN_ITEM_OPEN(name)
}

/** 0x62368 이 공용 창에 띄우는 글 (원문 마크업). 웹이 짓지 못하는 k(< 0 · ≥ 51)면 null */
export function hiddenOpenNoticeTextOf(id: number): string | null {
  const name = hiddenNameOf(id)
  if (name === null) return null
  if (id <= LAST_TEAM_ID) return headLineOf(id, name)
  const usage = USAGE_LINES.find((line) => id <= line.last)
  return `${HIDDEN_ITEM_OPEN(name)}${LINE_BREAK}${LINE_BREAK}${usage?.text ?? ''}`
}

/**
 * **기록달성 누계 해금 0x62234 의 글** — 0x62368 과 첫 줄 갈래는 같지만(0x622d4~0x622f4) "!N!N" · 쓰는 곳 줄을 **잇지 않는다**
 * (0x622f8 sprintf 뒤 곧장 0x1f1b9 · 0x74ef5). 표 밖이면 null
 */
export function recordUnlockNoticeTextOf(id: number): string | null {
  const name = hiddenNameOf(id)
  return name === null ? null : headLineOf(id, name)
}

/**
 * 해금 k 를 웹 전역 해금표(`Collection.openedHiddenIds`)에 적는 번호. 원본 0x620b8 은 k 8~12(히든 팀)를 전역 +0x7a + (k − 8)
 * 에 켜는데, 웹 표는 히든 팀을 **팀 번호 10~14** 로 들고 있다(국가대항전 `openCupHiddenTeams` · 팀 고르기 `isTeamOpened`).
 * 그래서 k 8~12 는 k + 2 로 옮겨 적는다. 그 밖은 k 그대로. 마선수(k 0~7)는 이 표가 아니라 마선수 칸이라 부르는 쪽이 따로 연다.
 */
export function hiddenOpenStoredIdOf(id: number): number {
  return id > LAST_ACE_ID && id <= LAST_TEAM_ID ? id + 2 : id
}

/**
 * 공용 창 [0x140005c] 의 줄 — 0x74ef4 는 창이 떠 있으면([창+9] ≠ 0) 새 글을 **대기 한 칸**(+0x2a4 = 1 · +0x2a8 에 글 복사)에
 * 덮어 두고, 창이 닫힐 때 0x75440 이 그 글로 다시 띄운다. 곧 떠 있는 것 하나 + 대기 하나 — 셋째부터는 대기를 덮는다.
 */
export interface HiddenOpenWindow {
  readonly shown: string | null
  readonly pending: string | null
  /**
   * 그 글의 창을 닫은 뒤 부르는 쪽이 이어 할 일 — 원본 꼬리표 `[창+0x248]`(대기 칸은 `+0x3ac`)를 장면이 닫힘 틀에서 보고 다음
   * 상태로 가는 자리다(예: 나리 명전 등록 145 의 0x31 → 메인 메뉴, 0x1ca4c). 없으면 null
   */
  readonly shownThen?: (() => void) | null
  readonly pendingThen?: (() => void) | null
}

export const EMPTY_HIDDEN_OPEN_WINDOW: HiddenOpenWindow = { shown: null, pending: null }

export function pushHiddenOpenWindow(
  window: HiddenOpenWindow,
  text: string,
  then: (() => void) | null = null,
): HiddenOpenWindow {
  return window.shown === null
    ? { shown: text, pending: null, shownThen: then, pendingThen: null }
    : { ...window, pending: text, pendingThen: then }
}

/** 창을 닫는다 — 대기 글이 있으면 그것을 띄운다 (0x742a8 → 0x75440) */
export function closeHiddenOpenWindow(window: HiddenOpenWindow): HiddenOpenWindow {
  return window.pending === null
    ? EMPTY_HIDDEN_OPEN_WINDOW
    : { shown: window.pending, pending: null, shownThen: window.pendingThen ?? null, pendingThen: null }
}

/** 새로 연 히든 k 들을 차례로 창에 넣는다 — 글을 못 짓는 k 는 건너뛴다. `then` 은 마지막 글의 창에 단다 */
export function announceHiddenOpens(
  window: HiddenOpenWindow,
  ids: readonly number[],
  then: (() => void) | null = null,
): HiddenOpenWindow {
  return ids.reduce((current, id, index) => {
    const text = hiddenOpenNoticeTextOf(id)
    return text === null ? current : pushHiddenOpenWindow(current, text, index === ids.length - 1 ? then : null)
  }, window)
}
