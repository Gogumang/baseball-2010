import { tradeMoneyChangeOf } from '@/entities/season-mode/model/playerTrade'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/**
 * **트레이드 확인 0xe7 그림 0xd4e8** (r89 — unicorn 으로 0xd4e8 을 돌려 그리기 인자를 받았다. 0xd4e8 · 0x94a65 · 0x55e61 ·
 * 0xb9e05 · 0xba411 · 0x802dd · 0xba015 · 0x55cf5 · 0xbc75d / 0xbc965 / 0xbc5a9 직접 뜸). 판 · 칸은 mode_ui 프레임 70 · 71 의 박스다.
 * ```
 * 박스 0 = 70[0] (24, 57, 192, 210) → 0x55e61(skin, 박스, 0, 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
 * 프레임 70 (칸 그림, 원점 (34, 80)) 을 (0, 0) 에
 * 제목 img_text 118 "트레이드" — 0xb9e05(글, 박스 0, 0x11, 효과 0xb 단색 #1D44A8, dx 25, dy 5) → (49, 62)
 * 머리 글 표 0xcbe80 [320 "이름", 323 "보직", 81 "팀명"] 을 팔레트 0 으로 박스 1 · 2 · 3 가운데
 * mode_ui 애니 3(프레임 77~82, 지연 4) 을 (0, 0) 에 · 그림마다 한 틀(0x93c45 · 0x93d91)
 * 흰 글: 박스 4 = 내 선수(0xb5695(내 팀, 탭, this+0x14c)) 이름 · 박스 6 = 상대 선수(this+0x150) 이름 — 0xba411(박스, 이름, 0x22)
 *        박스 5 · 7 = img_text 0x41 + 내 팀 / 상대 팀 (팔레트 0) 가운데
 * 딱지 박스 8(내 선수) · 9(상대 선수) — 탭 0(투수) 보직 0xb6705: 0 선발(mode_ui 0x49 · img_text 49) · 1 중계(0x4c · 170) ·
 *        2 구원(0x4a · 182) · 그 밖 없음 / 탭 1(타자) +0xb & 3: 0 내야(0x4a · 304) · 1 외야(0x49 · 305) · 그 밖 지명(0x4c · 183)
 * 단계 this+0x160 == 0 (고르기)이면:
 *   프레임 71 (원점 (34, 209)) · 0x802dd(창, 71[0] (33, 170, 174, 34)) — #1D44A8 칠 · 위 · 왼 #0A266F · 아래 · 오른 #5683F5 선
 *   비용 글 노랑: StrMODE[167] "트레이드 비용 : " + (d > 0 ? " +" : d < 0 ? " -" : "") + 0x55cf5(|d| × 100) 를 71[0] 가운데
 *     (d = (내.+0x1b − 상대.+0x1b) × 10, 음수면 × 2 — 성공 때 소지금에 더하는 그 값)
 *   커서 = 목록 [this+0x7c] 칸 c → 71[c + 1] 을 (x − 1, y − 1, w + 1, h + 1) 노란 둥근 테두리(0xba015 → 0x6aa65, 둥글기 1)
 *   흰 글 StrMODE[168 + k] 를 71[k + 1] 가운데 (k = 0 · 1 · 2)
 * 단계 1~3 은 진행 연출(`TradeProgress`)
 * 끝으로 머리띠 0x7f4ed (공통 앞그림 0xb810 이 세운 "시즌모드" · 되돌아가기)
 * ```
 */
export const TRADE_CONFIRM = {
  panel: { x: 24, y: 57, width: 192, height: 210, topBand: 0x10 },
  title: { frame: 118, x: 49, y: 62, color: '#1D44A8' },
  cellsFrame: 70,
  listFrame: 71,
  headers: [
    { frame: 320, box: { x: 34, y: 80, width: 54, height: 15 } },
    { frame: 323, box: { x: 91, y: 80, width: 36, height: 15 } },
    { frame: 81, box: { x: 130, y: 80, width: 75, height: 15 } },
  ],
  /** 박스 4 · 5 · 8 — 내 선수 줄 / 박스 6 · 7 · 9 — 상대 선수 줄 */
  myRow: { name: { x: 34, y: 94, width: 54, height: 15 }, team: { x: 130, y: 94, width: 75, height: 15 }, badge: { x: 91, y: 94, width: 36, height: 15 } },
  opponentRow: { name: { x: 34, y: 148, width: 54, height: 15 }, team: { x: 130, y: 148, width: 75, height: 15 }, badge: { x: 91, y: 148, width: 36, height: 15 } },
  /** mode_ui 애니 3 (77~82, 지연 4) */
  animation: 3,
  costBox: { x: 33, y: 170, width: 174, height: 34 },
  rows: [
    { x: 34, y: 209, width: 171, height: 15 },
    { x: 34, y: 226, width: 171, height: 15 },
    { x: 34, y: 243, width: 171, height: 15 },
  ],
} as const

/** 팀 이름 img_text — 0x41 + 팀 */
export const teamNameFrameOf = (teamId: number) => 0x41 + teamId

/** 딱지 — mode_ui 프레임 · img_text (0xd7d6~0xd82c 내 선수 · 0xd8ee~0xd940 상대 선수) */
export function tradeBadgeOf(isPitcherTab: boolean, profileLow: number): { readonly chip: number; readonly label: number } {
  if (isPitcherTab) {
    if (profileLow === 0) return { chip: 0x49, label: 0x31 }
    if (profileLow === 1) return { chip: 0x4c, label: 0xaa }
    if (profileLow === 2) return { chip: 0x4a, label: 0xb6 }
    // 그 밖(보직 3)은 r6 · r5 가 0 그대로(0xd7e0 · 0xd7e4 → 0xd82c) — mode_ui 프레임 0 · img_text 0 을 그린다. 보직은 0xb6704 =
    // 레코드 +0xb 하위 2비트인데 붙박이 투수 120 명(roster.json)은 0 · 1 · 2 뿐이라 실제로는 닿지 않는다 — 원본 그대로 둔다
    return { chip: 0, label: 0 }
  }
  if (profileLow === 0) return { chip: 0x4a, label: 0x130 }
  if (profileLow === 1) return { chip: 0x49, label: 0x131 }
  return { chip: 0x4c, label: 0xb7 }
}

/** 0x55cf5 — v ≤ 9999 "%d" · 그 밖 "%d억"(나머지 0) · "%d억%03d" */
export function moneyTextOf(value: number): string {
  if (value <= 9999) return String(value)
  const eok = Math.trunc(value / 10000)
  const rest = value % 10000
  return rest === 0 ? `${eok}억` : `${eok}억${String(rest).padStart(3, '0')}`
}

/** StrMODE[167] 원문 "트레이드 비용 : " — 끝에 빈칸이 하나 있다(생성 표가 원문 그대로 둔다, r223) */
const COST_LABEL = ORIGINAL_MODE_TEXT[167] ?? ''

/** 비용 글 — StrMODE[167] + 부호 + 0x55cf5(|d| × 100) */
export function tradeCostTextOf(myGrade: number, opponentGrade: number): string {
  const change = tradeMoneyChangeOf(myGrade, opponentGrade)
  const sign = change > 0 ? ' +' : change < 0 ? ' -' : ''
  return `${COST_LABEL}${sign}${moneyTextOf(Math.abs(change * 100))}`
}

/** 진행 비용 칸 글 — StrMODE[168 + k] */
export const tradeBoostTextOf = (which: number) => ORIGINAL_MODE_TEXT[168 + which] ?? ''

/**
 * 0x802dd 창 칠 — (x, y, w, h) #1D44A8 칠 · (x, y)–(x+w−1, y) · (x, y)–(x, y+h) #0A266F · (x+1, y+h)–(x+w−1, y+h) ·
 * (x+w−1, y+1)–(x+w−1, y+h) #5683F5
 */
export function tradeCostBoxPaintsOf(box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) {
  const { x, y, width: w, height: h } = box
  return [
    { x, y, width: w, height: h, color: '#1D44A8' },
    { x, y, width: w, height: 1, color: '#0A266F' },
    { x, y, width: 1, height: h + 1, color: '#0A266F' },
    { x: x + 1, y: y + h, width: w - 1, height: 1, color: '#5683F5' },
    { x: x + w - 1, y: y + 1, width: 1, height: h, color: '#5683F5' },
  ]
}
