/**
 * **팀경기 정산 판** — 경기 상태 0x19 그리기 `0x4a384` 의 "그 밖 모드"(5·6 이 아닌) 갈래 `0x4a948` · 키 `0x407f0` (직접 떴다).
 *
 * ## 그리기 0x4a384 (W = 240 · H = 320)
 * ```
 * 4a38a  0x457cc · 4a3be 구름 0x78448 · 4a3ce 배경 0x40ff0(장면, +0x17e2)                ; `settlementBackdrop`
 * 4a3d2  이겼나 sp+0x98: 상태 [+0x1c] == 0x20 이면 0, 모드 5·6 이면 [미션+0xbc], 아니면 0x4a350 (0xb6c21(경기, 0xb6a0d) == 0)
 * 4a404  ── 진 판(sp+0x98 == 0) 갈래 ──
 *        [0x15605d0] 색 덮기(0, 0, W, H, 0x1400748(0,0,0), 단계 8)                       ; 검정 9/16 (`stepCover`)
 * 4a448  ── 이긴 판도 여기서 합친다 ──
 *        0x901a1([0x1400064], 0, 0) · fillRect(0, 40, W, 30, 0x80304EA2)                  ; 반투명 파란 띠
 * 4a48e  game_ui 프레임 8 (171×25) 을 (W/2 − 폭/2, 35)                                     ; = (34, 35)
 * 4a4d2  result 프레임 이겼으면 0 "YOU WIN" · 아니면 1 "YOU LOSE" 를 (W/2, 50)
 * 4a562  모드 5·6 이면 0x4a576(미션 판 — 이 파일 밖), 아니면 4a948:
 * 4a97a  0x41440(장면, W/2 − 120, H/2 − 80, 0, 0, 0)                                       ; 점수판 틀 (`widgets/scoreboard-frame`)
 * 4a980  점수 0xb69b0(st, 0) · (st, 1) → 0xba689(x, y = H/2 − 80 + 칸4.y + 칸4.h + 10, 0, 값, num 70 + 자리, 정렬 0x12)
 *        x = W/2 − 120 + 칸.x + 칸.w/2 + 2 (칸 4) · W/2 + 칸.x + 칸.w/2 − 0x76 (칸 5) — 칸 = game_ui 프레임 16 의 박스 4·5
 *        정렬 0x12 의 비트 2 는 0xba51c 에서 x += (0 − 글폭)/2 → **x 가 글 가운데**, 위 = y
 * 4aa5e  [장면+0x17e8] == 0 이면 아래 "기본 화면"(4af50), 아니면 "기록 판":
 * ```
 * ### 기본 화면 4af50 (+0x17e8 == 0)
 * ```
 * game_ui 이미지 12 (41×12) 를 (W/2 − 폭/2, H − 높이 − 1)                                   ; = (100, 307)
 * img_text 프레임 167 "0:INFO" (31×5) 를 (W/2 − 폭/2, H − 12 + 2)                            ; = (105, 310)
 * [+0x17f4](이번에 번 G) > 0 이면 0x54a61(skin, 값, W/2 − 0x28, H − 12 − 0x13, 0x46, 0, 1, 2, 1, 1)
 * ```
 * ### 기록 판 (+0x17e8 ≠ 0) — 판 높이 h = 182, 대전모드(8·9)에서 이겼으면 202 (sp+0x64 = 1)
 * ```
 * 0x55e61(skin, W/2, H/2, 176, h, 0, 0x22, 0x10) — 가운데 창, r7 = H/2 − h/2
 * game_ui 이미지 30 "RESULT" (W/2 − 폭/2, r7 + 7)
 * 칸 0xbb28d(W/2, r7 + 0x17, 162, 0x55, 2) ; r7 += 0x13
 * 기록 수 [+0x17f8] > 0:  r7 −= 6
 *   0x58c11(…, skin, slt_frame 이미지 78, W/2 + 0x44, r7 + 0x15, 1) → 보이는 줄 [윗줄, 끝)   ; 스크롤 0x61c55(skin, 0x3a, 4, 개수)
 *   줄 i (k = i − 윗줄), y = r7 + 16k + 0x16:
 *     StrGAME[[+0x17ec][i] + 8] 흰 글 (W/2 − 0x51 + 0xf, y)
 *     "!R%d회"(0xd0970) ← [+0x17f0][i] 흰 글 (W/2 − 0x51 + 0x14, y, 폭 0x7a) — 오른쪽 맞춤
 *   r7 += 6
 * 기록 수 == 0:  "!C기록이 없습니다!"(0xd0978) 흰 글 (W/2 − 0x51, r7 + 0x28, 폭 162)
 * r7 += 0x5d ; 칸 0xbb28d(W/2, r7, 162, 0x2e, 2)
 *   img_text 256 "획득" (W/2 − 0x51 + 0xf, r7 + 8) · 252 "GP" (W/2 − 0x51 + 0x2c, r7 + 8)
 *   0x54a61(skin, [+0x17f4], W/2 − 0x51 + 0x46, r7 + 5, 0x50, 0x10, 1, 1, 1, 0)
 *   img_text 257 "보유" (…, r7 + 0x1c) · 252 "GP" · 0x54a61(skin, [app+0x64], …, r7 + 0x19, 0x50, 0x10, 1, 1, 0, 0)
 * r7 += 0x32
 * sp+0x64(대전모드 이김)이면:  글 = "승리 추가 보상[!cffff00"(0xd060c) + v + " G포인트!cffffff]"(0xd0624)
 *   v = 모드 8 이면 s16 [app+0x112], 아니면 s16 [app+0x138]          ; 서버에서 받는 값으로 보인다 (🌐, R14 4-1 미해결)
 *   칸 0xbb28d(W/2, r7, 162, 0x12, 2) · **흐르는 글 0x5a8c8(skin, 글, W/2 − 0x51, r7 + 3, 162, 18, 1, 1, 1)** (0x4aef0)
 *   r7 += 0x14
 * popup 프레임 0 "OK" 를 (W/2 − 폭/2, r7)
 * ```
 * 기록 줄은 진입 0x4ea0c 가 채운다(4eb6c~4ec4a): 기록 k = 0..39 의 이번 경기 횟수가 0 이 아니면 차례대로 [+0x17ec] 에 k,
 * [+0x17f0] 에 횟수를 넣고 [+0x17f8] = 개수 · 0x61c55(skin, 0x3a, 4, 개수) · [+0x17e8] = 0.
 *
 * ## 키 0x407f0 (모드 5·6 이 아닐 때 0x40948)
 * ```
 * [+0x17e8] == 0:  '0'(0x30) → [+0x17e8] = 1 (기록 판을 연다)
 *                  그 밖 키 → [+0x17ec]·[+0x17f0] 을 풀고 메시지 0x3f3 (정산을 나간다)
 * [+0x17e8] ≠ 0:   0x61ce5(skin, 키) — 기록 줄 스크롤, 그 뒤 OK(−5)·CLR(−16)·'0'·'5' 면 [+0x17e8] = 0 (판을 닫는다)
 * ```
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const CENTER_X = SCREEN_WIDTH / 2
const CENTER_Y = SCREEN_HEIGHT / 2

/** 진 판 덮개 — [0x15605d0] 색 덮기(검정) 단계 8 (0x4a436) */
export const SETTLEMENT_LOSE_DIM_STEP = 8

/** 띠 fillRect(0, 40, W, 30, 0x80304EA2) — RGB(48,78,162) 알파 0x80 (0x4a466) */
export const SETTLEMENT_BAND = { x: 0, y: 40, width: SCREEN_WIDTH, height: 30, color: 'rgba(48, 78, 162, 0.5)' } as const

/** game_ui 프레임 8 (171×25) 을 (W/2 − 폭/2, 35) (0x4a48e~0x4a4c4) */
export const SETTLEMENT_TITLE_BAR = { frame: 8, centerX: CENTER_X, y: 35, width: 171 } as const

/** result 프레임 0 "YOU WIN" · 1 "YOU LOSE" 를 원점 (W/2, 50) 에 (0x4a4d2 · 0x4a55c) */
export const SETTLEMENT_RESULT_SPRITE = { winFrame: 0, loseFrame: 1, x: CENTER_X, y: 50 } as const

/**
 * 점수 두 개 — game_ui 프레임 16 의 박스 4 = [14, 120, 82, 15] · 박스 5 = [144, 119, 82, 15] (boxes.json).
 * 왼쪽(측 0) x = W/2 − 120 + 14 + 41 + 2 = 57 · 오른쪽(측 1) x = W/2 + 144 + 41 − 0x76 = 187, 둘 다 y = H/2 − 80 + 135 + 10 = 225.
 * 글자는 num 70 + 자리 숫자(0xba51c 기준 0x46), x 가 글 가운데다.
 */
export const SETTLEMENT_SCORE = {
  digitBaseFrame: 0x46,
  side0: { centerX: CENTER_X - 120 + 14 + Math.trunc(82 / 2) + 2, y: CENTER_Y - 80 + 120 + 15 + 10 },
  side1: { centerX: CENTER_X + 144 + Math.trunc(82 / 2) - 0x76, y: CENTER_Y - 80 + 120 + 15 + 10 },
} as const

/** 기본 화면 바닥 — game_ui 이미지 12 (41×12) · img_text 프레임 167 "0:INFO" (31×5) */
export const SETTLEMENT_INFO_BAR = {
  image: 12,
  imageWidth: 41,
  imageHeight: 12,
  x: CENTER_X - (41 >> 1),
  y: SCREEN_HEIGHT - 12 - 1,
  labelFrame: 167,
  labelX: CENTER_X - (31 >> 1),
  labelY: SCREEN_HEIGHT - 12 + 2,
} as const

/** 기본 화면의 이번에 번 G — 0x54a61(skin, 값, W/2 − 0x28, H − 12 − 0x13, 0x46, 0, …) */
export const SETTLEMENT_INFO_POINT = { x: CENTER_X - 0x28, y: SCREEN_HEIGHT - 12 - 0x13, width: 0x46 } as const

/** 대전모드(8·9) — 0x4aa88 `mode − 8 ≤ 1` */
export const isVersusMode = (mode: number) => mode === 8 || mode === 9

/** 기록 판 높이 — 182, 대전모드에서 이겼으면 202 (0x4aa84~0x4aa9e) */
export function settlementPanelHeightOf(mode: number, isWin: boolean): number {
  return isVersusMode(mode) && isWin ? 0xca : 0xb6
}

const BOX_LEFT = CENTER_X - 0x51
const BOX_WIDTH = 162

/** 기록 판의 칸·글 자리를 판 높이로 풀어 낸다 (r7 의 흐름 그대로) */
export function settlementPanelLayoutOf(height: number, recordCount: number, hasRewardLine: boolean) {
  const top = CENTER_Y - (height >> 1)
  let r7 = top
  const window = { x: CENTER_X - 88, y: top, width: 176, height }
  const title = { image: 30, width: 56, x: CENTER_X - 28, y: r7 + 7 }
  const recordBox = { x: BOX_LEFT, y: r7 + 0x17, width: BOX_WIDTH, height: 0x55 }
  r7 += 0x13
  const listTop = r7 - 6
  const records = {
    scrollBar: { x: CENTER_X + 0x44, y: listTop + 0x15 },
    firstRowY: listTop + 0x16,
    rowStep: 16,
    nameX: BOX_LEFT + 0xf,
    countX: BOX_LEFT + 0x14,
    countWidth: 0x7a,
  }
  const emptyText = { x: BOX_LEFT, y: r7 + 0x28, width: BOX_WIDTH }
  r7 += 0x5d
  const pointBox = { x: BOX_LEFT, y: r7, width: BOX_WIDTH, height: 0x2e }
  const pointRows = [
    { label: 256, name: '획득', labelY: r7 + 8, valueY: r7 + 5 },
    { label: 257, name: '보유', labelY: r7 + 0x1c, valueY: r7 + 0x19 },
  ] as const
  const pointLabelX = BOX_LEFT + 0xf
  const pointGpX = BOX_LEFT + 0x2c
  const pointValue = { x: BOX_LEFT + 0x46, width: 0x50, height: 0x10 }
  r7 += 0x32
  const rewardBox = hasRewardLine ? { x: BOX_LEFT, y: r7, width: BOX_WIDTH, height: 0x12 } : null
  const ticker = hasRewardLine ? { x: BOX_LEFT, y: r7 + 3, width: BOX_WIDTH, height: 18 } : null
  if (hasRewardLine) r7 += 0x14
  const okButton = { frame: 0, width: 41, x: CENTER_X - (41 >> 1), y: r7 }
  return {
    window, title, recordBox, records, emptyText, pointBox, pointRows, pointLabelX, pointGpX, pointValue,
    rewardBox, ticker, okButton, hasRecords: recordCount > 0,
  }
}

/** 이번 경기 기록 줄 — 진입 0x4ea0c 4ebe0~4ec36: 기록 0..39 가운데 횟수가 있는 것만 번호 차례로 */
export function settlementRecordRowsOf(recordIds: readonly number[]): { id: number; count: number }[] {
  const counts = new Map<number, number>()
  for (const id of recordIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([id]) => id >= 0 && id <= 0x27)
    .sort(([a], [b]) => a - b)
    .map(([id, count]) => ({ id, count }))
}

/** "!R%d회" (0xd0970) */
export const recordCountTextOf = (count: number) => `${count}회`
/** "!C기록이 없습니다!" (0xd0978) */
export const NO_RECORD_TEXT = '기록이 없습니다!'
/** "승리 추가 보상[!cffff00"(0xd060c) + v + " G포인트!cffffff]"(0xd0624) */
export const versusRewardTextOf = (bonus: number) => `승리 추가 보상[!cffff00${bonus} G포인트!cffffff]`

/**
 * 기록 줄 스크롤 — 0x61c55(skin, 0x3a, 4, 개수) · 0x61ce5(skin, 키). 꼴은 기록연감 탭 3 과 같은 스크롤 객체다
 * (`pages/record/lib/annalsGrid` 의 0x61c54 · 0x61ce4 풀이): 길 = 0x3a − 2, 보임 = 4.
 */
export const SETTLEMENT_VISIBLE_ROWS = 4
export const SETTLEMENT_SCROLL_TRACK = 0x3a - 2

export interface SettlementScroll {
  readonly top: number
  readonly total: number
  readonly thumb: number
  readonly step: number
  readonly thumbLength: number
}

export function startSettlementScroll(total: number): SettlementScroll {
  const hidden = total - SETTLEMENT_VISIBLE_ROWS
  if (hidden <= 0) return { top: 0, total, thumb: 0, step: 0, thumbLength: SETTLEMENT_SCROLL_TRACK }
  const step = Math.trunc(SETTLEMENT_SCROLL_TRACK / SETTLEMENT_VISIBLE_ROWS)
  const thumbLength = SETTLEMENT_SCROLL_TRACK - hidden * step
  if (thumbLength >= step) return { top: 0, total, thumb: 0, step, thumbLength }
  return { top: 0, total, thumb: 0, step: 3, thumbLength: SETTLEMENT_SCROLL_TRACK - 3 * hidden }
}

export function scrollSettlementRecords(scroll: SettlementScroll, direction: 'up' | 'down'): SettlementScroll {
  if (scroll.total <= SETTLEMENT_VISIBLE_ROWS) return scroll
  if (direction === 'up') {
    if (scroll.top <= 0) return scroll
    return { ...scroll, top: scroll.top - 1, thumb: Math.max(0, scroll.thumb - scroll.step) }
  }
  if (scroll.top + SETTLEMENT_VISIBLE_ROWS >= scroll.total) return scroll
  return {
    ...scroll,
    top: scroll.top + 1,
    thumb: Math.min(SETTLEMENT_SCROLL_TRACK - 10, scroll.thumb + scroll.step),
  }
}

/** 키 0x407f0 — 지금 판이 닫혀 있으면 '0' 만 판을 열고 나머지는 정산을 나간다. 열려 있으면 OK·CLR·'0'·'5' 가 닫는다 */
export type SettlementKeyAction = '판열기' | '나가기' | '판닫기' | '위로' | '아래로' | null

/** 원본 키패드에 있는 키만 본다 (방향·숫자·OK·CLR·'*'·'#') */
const KEYPAD_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace', '*', '#',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
])

export function settlementKeyActionOf(key: string, isPanelOpen: boolean): SettlementKeyAction {
  if (!KEYPAD_KEYS.has(key)) return null
  if (!isPanelOpen) return key === '0' ? '판열기' : '나가기'
  // 0x61ce5 가 먼저 받는다: 위(−1)·'2' / 아래(−2)·'8'
  if (key === 'ArrowUp' || key === '2') return '위로'
  if (key === 'ArrowDown' || key === '8') return '아래로'
  // 그 뒤 −5(OK)·−16(CLR)·0x30·0x35 면 닫는다 (0x4099c~0x409b6)
  if (key === 'Enter' || key === ' ' || key === 'Escape' || key === 'Backspace' || key === '0' || key === '5') return '판닫기'
  return null
}
