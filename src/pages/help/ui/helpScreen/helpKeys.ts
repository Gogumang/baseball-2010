import type { HelpViewerKey } from '@/pages/help/lib/helpViewer'

/**
 * 웹 키 → 원본 키 (위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16) — **격자가 바꾼 키**다 (Q-14, 직접 떴다).
 * 뷰어 키 0x637d0 은 맨 앞(637d2~637e8)에서 날 키를 격자 [skin+0x454] 의 vt+0x18(0x6c299 → 0x6c521 → 0x6c031)에 넘기고
 * **돌려받은 값(r6)** 으로 줄 넘기기 0x61ce4 와 점프표 0xd1dbc(63816 `r6 + 0x10`)를 고른다. 그 격자는 뷰어 열기 0x63688 의
 * `vt+0x1c(3, 1, 숫자키 꼴 1, 0x10)`(6371a) 라 0x6c096 이 표 0xd2e7c 로 '2' → −1 · '8' → −2 · '4' → −3 · '6' → −4 · '5' → −5 로
 * 바꾼다. 그래서 숫자 '2' '8' 은 ↑ ↓ 와 똑같이 가고(장 고르기의 '8' 도 쪽 보기로 든다), '4' '6' 은 ← →, '5' 는 OK 다.
 * 0x61ce4 의 '2'(0x32) · '8'(0x38) 비교(61cf4 · 61cf8)는 날 키를 넘기는 다른 부르는 곳(0x2b7a0 · 0x2d370 · 0x407f0) 몫이고
 * 뷰어 길에서는 닿지 않는다 — r207 머리말의 "'4'·'5'·'6' 은 안 본다" 는 바꾸기 전 키를 본 잘못이었다.
 */
const VIEWER_KEYS = new Map<string, HelpViewerKey>([
  ['ArrowUp', '위'],
  ['2', '위'],
  ['ArrowDown', '아래'],
  ['8', '아래'],
  ['ArrowLeft', '왼'],
  ['4', '왼'],
  ['ArrowRight', '오른'],
  ['6', '오른'],
  ['Enter', 'OK'],
  [' ', 'OK'],
  ['5', 'OK'],
  ['Escape', 'CLR'],
  ['Backspace', 'CLR'],
])

export const viewerKeyOf = (key: string): HelpViewerKey | null => VIEWER_KEYS.get(key) ?? null

/** 숫자키 꼴 1 격자가 방향으로 돌려주는 키 (표 0xd2e7c) — 까딱임 방향 칸만 본다 */
export const HELP_GRID_DIRECTIONS: Readonly<Record<string, 'left' | 'right' | 'up' | 'down'>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  4: 'left',
  6: 'right',
  2: 'up',
  8: 'down',
}
