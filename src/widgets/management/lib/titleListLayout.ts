/**
 * 칭호(닉네임) 목록 창 배치 — 나만의리그 관리 장면 **하위 상태 129** (P3 10-1 · R9 「119·129·120」).
 *
 * 그리기 0x198fc (직접 떴다, 0x198fc~0x19d96). 배치는 `[장면+0xec]` 그림(mode_ui)의 **프레임 63** 박스 다섯 개다:
 * ```
 * 19902  0x166cc — 기본정보 카드 0x15e20 + 머리띠 (창은 그 위에 선다)
 * 19974  박스 0 (24,56,192,196) 공용 판 0x55e61(skin, 박스, 0, 정렬 0x11, 0x10, 0, 1, 0)
 * 199c4  박스 1 (26,58,189,15)  img_text 279 "닉네임" — 팔레트 3(0x913e5(애니, 3)) · 0xb9e05 정렬 0x21 · ox 28
 * 199f8  박스 2 (199,85,7,155)  #20309E 칠 (0xb9f75)
 * 19a0a  프레임 63 그림을 (0, 0) 에 (0xba19d) — ▲▼ 두 개
 * 19a38  박스 3 (34,79,26,15) ∪ 박스 4 (63,79,133,15) = 0x6f731 → (x − 1, y − 1, w, h) — 고른 줄 테두리 자리
 * 19a5e  줄 k = 0..8 (dy = (박스3.h + 4)·k = 19k), 번호 i = 윗줄 + k:
 *          프레임 64(번호칸 + 이름칸 파란 막대 162×15) 를 박스 3 에 정렬 0x21 · oy dy   ; 빈 줄도 막대는 깐다
 *          i < 개수([장면+0x26c]) 면:
 *            칭호 번호 n = [장면+0x16c + 4i] — n > 31 이고 투수편이면 n + 16 (0x19abe~0x19ad4)
 *            n == 선수+0x1c4(s8) 이면 프레임 65(이름칸 주황) 를 덧깔고 글 검정, 아니면 글 흰색 (0x19ae8~0x19b44)
 *            이름 StrNICKNAME[n] 0xba411(박스 4, 정렬 0x22, oy dy)
 *            번호 i + 1 0xba719(박스 3, 자간 0, 기준 0 = num 흰 숫자 0~9, 정렬 0x22, oy dy)
 *            i == 커서 이고 틱 % 10 ≠ 0 이면 노랑 (255,255,0) 사각 테두리 0xb9ed5(위 합친 자리, dy)
 * 19c06  스크롤 막대 (박스 2) — 개수 ≤ 9 면 흰 (x+1, y, w−2, h) · #1D44A8 (x+2, y+1, w−4, h−2),
 *        아니면 L = (9h + 개수 − 1) / 개수 · d = 윗줄·h / 개수 로 흰 (x+1, y+d, w−2, L−1) · #1D44A8 (x+2, y+d+1, w−4, L−3)
 * ```
 * 앞서 이 창은 필살타법 창(0x803d4) 자리를 빌린 근사였다.
 */
export interface TitleListBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** mode_ui 프레임 63 박스 (`public/sprites/mode_ui/frames/boxes.json` 의 "063") */
export const TITLE_LIST_BOXES = {
  window: { x: 24, y: 56, width: 192, height: 196 },
  header: { x: 26, y: 58, width: 189, height: 15 },
  scrollBar: { x: 199, y: 85, width: 7, height: 155 },
  number: { x: 34, y: 79, width: 26, height: 15 },
  name: { x: 63, y: 79, width: 133, height: 15 },
} as const satisfies Record<string, TitleListBox>

export const TITLE_LIST_FRAME = {
  /** ▲▼ 그림 (프레임 63) */
  arrows: 63,
  /** 번호칸 + 이름칸 파란 막대 */
  row: 64,
  /** 이름칸이 주황인 막대 — 지금 단 칭호 */
  equippedRow: 65,
} as const

/** 머리 글 img_text 279 "닉네임" · 팔레트 3 · 정렬 0x21 · ox 28 */
export const TITLE_HEADER_FRAME = 279
export const TITLE_HEADER_OX = 28

/** 줄 간격 박스3.h + 4 = 19 (한 화면 9줄은 0x104cc 가 `min(개수, 9)` 로 넣는다) */
export const TITLE_ROW_STEP = TITLE_LIST_BOXES.number.height + 4

export const TITLE_LIST_COLORS = {
  scrollTrack: '#20309E',
  scrollThumbEdge: '#FFFFFF',
  scrollThumb: '#1D44A8',
  text: '#FFFFFF',
  equippedText: '#000000',
  cursor: '#FFFF00',
} as const

/** 고른 줄 테두리 자리 — 박스 3 ∪ 박스 4 를 (x − 1, y − 1) 로 (폭·높이는 그대로) */
export const TITLE_CURSOR_BOX: TitleListBox = {
  x: TITLE_LIST_BOXES.number.x - 1,
  y: TITLE_LIST_BOXES.number.y - 1,
  width: TITLE_LIST_BOXES.name.x + TITLE_LIST_BOXES.name.width - TITLE_LIST_BOXES.number.x,
  height: TITLE_LIST_BOXES.number.height,
}

export interface TitleScrollRect extends TitleListBox {
  readonly color: string
}

/** 스크롤 막대 손잡이 (0x19c06~0x19d8c) — 바탕은 박스 2 칠(#20309E)이 먼저 깔려 있다 */
export function titleScrollBarRectsOf(count: number, top: number, visible: number): readonly TitleScrollRect[] {
  const { x, y, width, height } = TITLE_LIST_BOXES.scrollBar
  if (count <= visible) {
    return [
      { x: x + 1, y, width: width - 2, height, color: TITLE_LIST_COLORS.scrollThumbEdge },
      { x: x + 2, y: y + 1, width: width - 4, height: height - 2, color: TITLE_LIST_COLORS.scrollThumb },
    ]
  }
  const length = Math.trunc((height * visible + count - 1) / count)
  const offset = Math.trunc((top * height) / count)
  return [
    { x: x + 1, y: y + offset, width: width - 2, height: length - 1, color: TITLE_LIST_COLORS.scrollThumbEdge },
    { x: x + 2, y: y + offset + 1, width: width - 4, height: length - 3, color: TITLE_LIST_COLORS.scrollThumb },
  ]
}

/** num 흰 숫자 0~9 (기준 0) — 1 만 폭 4, 나머지 8 · 높이 10 · 자간 0 */
export const TITLE_NUMBER_HEIGHT = 10
export const titleNumberWidthOf = (digit: string) => (digit === '1' ? 4 : 8)

/** 번호를 박스 3 가운데(정렬 0x22, 자간 0)에 — 가로 `(w − Σ) >> 1` */
export function titleNumberLeftOf(value: number): number {
  const total = [...String(value)].reduce((sum, digit) => sum + titleNumberWidthOf(digit), 0)
  return TITLE_LIST_BOXES.number.x + ((TITLE_LIST_BOXES.number.width - total) >> 1)
}

/** 세로 가운데 올림 — e = 박스 h − 높이 → trunc(e/2) + e % 2 */
export const centeredTopOf = (box: TitleListBox, height: number) => {
  const extra = box.height - height
  return box.y + Math.trunc(extra / 2) + (extra % 2)
}

/**
 * **윗줄 옮기기 — 한 줄씩 (쪽 단위가 아니다)**. 목록 [장면+0xa4] 는 0x3c 바이트 스크롤 격자(생성자 0x6c219, vtable 0xd2ea0)이고
 * 키 vt+0x18 = 0x6c299 가 바탕 키 0x6c521 로 커서를 옮긴 뒤 vt+0x20 = 0x6c2bd 로 보이는 칸을 맞춘다(직접 떴다):
 * ```
 * 6c2e2  r = 커서 줄 +0x10 · t = 윗줄 +0x30 · v = 보이는 줄 수 +0x38
 *        r < t 이거나 r ≥ t + v 일 때만: d = r − t ; d > 0 이면 t = r − v + 1 · 아니면 t = r
 * ```
 * 곧 커서가 보이는 칸을 벗어날 때 **그 줄이 막 보일 만큼만** 굴린다 — 아래로 넘으면 커서가 맨 아랫줄, 위로 넘으면 맨 윗줄.
 * 감아서 0 으로 가면 t = 0, 맨 끝으로 가면 t = 끝 − v + 1 이다. 그리기 0x198fc 는 t + 줄(0x19a50~0x19a5c)을 9 줄 그린다.
 */
export function titleListTopAfter(top: number, cursor: number, visible: number): number {
  if (cursor >= top && cursor < top + visible) return top
  return cursor - top > 0 ? cursor - visible + 1 : cursor
}
