/** 키 0x407f0 — 지금 판이 닫혀 있으면 '0' 만 판을 열고 나머지는 정산을 나간다. 열려 있으면 OK·CLR·'0'·'5' 가 닫는다 */
export type SettlementKeyAction = '판열기' | '나가기' | '판닫기' | '위로' | '아래로' | null

/** 기록 줄 스크롤 키 — 위(−1)·'2' / 아래(−2)·'8' (0x61ce5) */
const SCROLL_UP_KEYS = new Set(['ArrowUp', '2'])
const SCROLL_DOWN_KEYS = new Set(['ArrowDown', '8'])
/** 판을 닫는 키 — OK(−5)·−16(CLR)·0x30·0x35 (0x4099c~0x409b6) */
const PANEL_CLOSE_KEYS = new Set(['Enter', ' ', 'Escape', 'Backspace', '0', '5'])

/** 원본 키패드에 있는 키만 본다 (방향·숫자·OK·CLR·'*'·'#') */
const KEYPAD_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Escape',
  'Backspace',
  '*',
  '#',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
])

export function settlementKeyActionOf(key: string, isPanelOpen: boolean): SettlementKeyAction {
  if (!KEYPAD_KEYS.has(key)) return null
  if (!isPanelOpen) return key === '0' ? '판열기' : '나가기'
  // 0x61ce5 가 먼저 받는다: 위(−1)·'2' / 아래(−2)·'8'
  if (SCROLL_UP_KEYS.has(key)) return '위로'
  if (SCROLL_DOWN_KEYS.has(key)) return '아래로'
  // 그 뒤 −5(OK)·−16(CLR)·0x30·0x35 면 닫는다 (0x4099c~0x409b6)
  return PANEL_CLOSE_KEYS.has(key) ? '판닫기' : null
}
