/**
 * 교체 창 0x384b8 의 칸 배치 · 깜빡임 · 목록 커서 (근거 그리기는 `../substitutionWindow` 머리말).
 * 칸 배치(0x37904 · 0x37e5c): 칸 x = 29 + 6 = 35 에서 칸마다 폭 + 3 — 이름 54(game_ui 28) · 나머지 36(game_ui 35).
 * 0x37904(장면, 29, 74) 는 머리 y = 74 + 3 = 77 을 넘긴다(0x3795a · 0x37994). 값 줄은 머리 + 15 + 3 = 95. 벤치 줄은 154 에서 18 씩.
 */
export const SUBSTITUTION_WINDOW = {
  panel: { x: 24, y: 55, width: 192, height: 210, topBand: 16, bottomBand: 0 },
  title: { firstX: 41, secondX: 65, y: 60, pitcherFrame: 150, batterFrame: 149, changeFrame: 299 },
  arrows: { x: 114, upImage: 50, downImage: 51, upY: [43, 45], downY: [269, 267] },
  logo: { centerX: 120, centerY: 195, scale: 1.5, opacity: 7 / 32 },
  current: { headerY: 77, cellY: 95 },
  bench: { firstY: 154, step: 18, visibleRows: 6 },
  columnX: [35, 92, 131, 170],
  columnWidth: [54, 36, 36, 36],
  cellHeight: 15,
  nameCellFrame: 28,
  valueCellFrame: 35,
  /** 0x37dd4 — 커서 상자 (칸 x, y, 폭 합 + 9, 15) */
  cursorBox: { x: 35, width: 171, height: 15 },
  change: { x: 50, y: 122, frames: [41, 42, 43], delay: 4 },
  info: { image: 12, x: 100, y: 307, width: 41, height: 12, textFrame: 167, textX: 105, textY: 310 },
} as const

/** 머리 글 img_text — 표 0xcfe7e */
export const HEADER_TEXT_FRAMES = { pitcher: [27, 28, 171, 181], batter: [27, 28, 172, 61] } as const

/** 틱 [장면+0x2c] % 8 ≤ 3 — 화살이 2px 바깥 · 커서 상자는 노란 안쪽 (0x384b8 · 0x37dd4) */
export const isBlinkOut = (tick: number) => ((tick % 8) + 8) % 8 <= 3

/** 0x37dd4 노란 안쪽 테두리 0x80FFFF00 의 알파 */
const BLINK_IN_OPACITY = 0x80 / 0xff

/**
 * 커서 상자 0x37dd4 — 틱 % 8 ≤ 3 이면 둥근 테두리 0x6aa64(x + 1, y + 1, w − 2, h − 2, 1, 0x80FFFF00 반투명 노랑),
 * 아니면 (x, y, w, h, 1, 빨강 #FF0000).
 */
export function cursorBoxOf(rowY: number, tick: number): { x: number; y: number; width: number; height: number; color: string; opacity: number } {
  const box = SUBSTITUTION_WINDOW.cursorBox
  if (isBlinkOut(tick))
    return { x: box.x + 1, y: rowY + 1, width: box.width - 2, height: box.height - 2, color: '#FFFF00', opacity: BLINK_IN_OPACITY }
  return { x: box.x, y: rowY, width: box.width, height: box.height, color: '#FF0000', opacity: 1 }
}

/** "CHANGE" 애니 0 — 지연 4 의 세 칸 돌림 (0x93cfd(애니, 1) · 그릴 때마다 0x93d91 한 칸) */
export const changeFrameAt = (draw: number) =>
  SUBSTITUTION_WINDOW.change.frames[Math.floor(Math.max(0, draw) / SUBSTITUTION_WINDOW.change.delay) % SUBSTITUTION_WINDOW.change.frames.length]

/**
 * 목록 0x6c4bd(목록, 1열, n줄, 1, 꼴 0x330) — 위 · 아래는 세로로 감고(꼴 0x20), 윗줄은 0x6c2bd 가 보이는 6 줄 안으로 맞춘다.
 */
export function movedListCursor(cursor: number, top: number, count: number, dy: number): { cursor: number; top: number } {
  if (count <= 0) return { cursor, top }
  const next = (cursor + dy + count) % count
  const visible = Math.min(count, SUBSTITUTION_WINDOW.bench.visibleRows)
  if (next >= top && next < top + visible) return { cursor: next, top }
  return { cursor: next, top: next - top > 0 ? next - visible + 1 : next }
}
