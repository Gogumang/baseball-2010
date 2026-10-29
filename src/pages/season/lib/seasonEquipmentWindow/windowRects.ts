import { SEASON_EQUIPMENT_LEVEL_COUNT } from '@/entities/season-mode/model/seasonEquipment'
import { EQUIPMENT_COLORS, EQUIPMENT_WINDOW, type WindowBox, type WindowRect } from './layout'

const hline = (x1: number, x2: number, y: number, color: string): WindowRect => ({
  x: Math.min(x1, x2),
  y,
  width: Math.abs(x2 - x1) + 1,
  height: 1,
  color,
})
const vline = (x: number, y1: number, y2: number, color: string): WindowRect => ({
  x,
  y: Math.min(y1, y2),
  width: 1,
  height: Math.abs(y2 - y1) + 1,
  color,
})
const pixel = (x: number, y: number, color: string): WindowRect => ({ x, y, width: 1, height: 1, color })

const PANEL_COLORS = { fill: '#335fcd', light: '#4f7ef3', edge: '#244cae', tab: '#1d44a8' } as const
/** 판 0x7c110 의 계단 수 */
const PANEL_STEPS = 12

/**
 * **판 0x7c110(창, 박스, 꼴)** — 윗변 가운데에서 계단 12 칸으로 올라가는 탭, 아랫변 가운데에서 내려가는 탭.
 * s = 꼴 ? 1 : 10 · 반 = trunc(w / 2) · 탭 칠 = 꼴 ? #1D44A8 : #335FCD.
 * 아랫탭의 꺾이는 자리는 x 를 **두 번** 더한다 — 0x7c2d4 가 [sp+0xc] = x + 반 − s 로 두고 0x7c2f0 · 0x7c34c 가 다시 x 를 더한다
 * (원본 그대로: x = 18 이면 아랫탭이 윗탭보다 18 오른쪽에서 꺾인다).
 */
export function tabPanelRectsOf(box: WindowBox, isStyled: boolean): readonly WindowRect[] {
  const { x, y, width: w, height: h } = box
  const s = isStyled ? 1 : 10
  const half = Math.trunc(w / 2)
  const top = x + half + s
  const bottom = x + (x + half - s)
  const tab = isStyled ? PANEL_COLORS.tab : PANEL_COLORS.fill
  const rects: WindowRect[] = [
    { x, y, width: w, height: h, color: PANEL_COLORS.fill },
    hline(x, top, y - 1, PANEL_COLORS.light),
    hline(x - 1, top, y - 2, PANEL_COLORS.edge),
  ]
  for (let step = 1; step <= PANEL_STEPS; step += 1) {
    rects.push(
      pixel(top + step, y - step, PANEL_COLORS.light),
      pixel(top + step, y - step - 1, PANEL_COLORS.edge),
      hline(top + step + 1, x + w - 1, y - step, tab),
    )
  }
  rects.push(
    hline(top + PANEL_STEPS + 1, x + w - 1, y - PANEL_STEPS, PANEL_COLORS.light),
    hline(top + PANEL_STEPS + 1, x + w, y - PANEL_STEPS - 1, PANEL_COLORS.edge),
    hline(bottom + 2, x + w, y + h + 1, PANEL_COLORS.edge),
    hline(bottom + 2, x + w, y + h, PANEL_COLORS.edge),
  )
  for (let step = 1; step <= PANEL_STEPS; step += 1) {
    const row = y + h - 1 + step
    const edge = bottom + 1 - step
    rects.push(hline(x, edge, row, PANEL_COLORS.fill), hline(edge, edge + 2, row, PANEL_COLORS.edge))
  }
  rects.push(
    hline(x - 1, bottom - PANEL_STEPS + 1, y + h + PANEL_STEPS + 1, PANEL_COLORS.edge),
    hline(x - 1, bottom - PANEL_STEPS + 2, y + h + PANEL_STEPS, PANEL_COLORS.edge),
    { x: x - 2, y: y - 1, width: 2, height: h + 14, color: PANEL_COLORS.edge },
    { x: x + w, y: y - PANEL_STEPS, width: 2, height: h + 13, color: PANEL_COLORS.edge },
  )
  return rects
}

/** 박스 0 의 칸 사이 세로선 넷 (0x83426~0x83486) */
export function partSeparatorRectsOf(box: WindowBox = EQUIPMENT_WINDOW.partSlots): readonly WindowRect[] {
  const height = box.height - 2
  return [0, 1, 2, 3].flatMap((slot) => {
    const x = box.x + slot * (box.width + 2)
    return [vline(x, box.y, box.y + height, EQUIPMENT_COLORS.separator), vline(x + 1, box.y, box.y + height, EQUIPMENT_COLORS.separatorShade)]
  })
}

/** 박스 4 설명 상자 (0x83488~0x835f4) */
export function descriptionBoxRectsOf(box: WindowBox = EQUIPMENT_WINDOW.description): readonly WindowRect[] {
  const { x, y, width: w, height: h } = box
  const rects: WindowRect[] = [
    hline(x, x + w - 1, y, EQUIPMENT_COLORS.boxEdge),
    { x, y: y + 1, width: w, height: h - 6, color: EQUIPMENT_COLORS.boxFill },
    vline(x, y, y + h, EQUIPMENT_COLORS.boxEdge),
    vline(x + w - 1, y + 1, y + h - 6, EQUIPMENT_COLORS.boxLight),
  ]
  let right = x + w - 1
  let row = y + h - 5
  for (let step = 0; step < 5; step += 1) {
    rects.push(hline(x + 1, right, row, EQUIPMENT_COLORS.boxFill), pixel(right, row, EQUIPMENT_COLORS.boxLight))
    row += 1
    right -= 1
  }
  rects.push(hline(x + 1, right, row, EQUIPMENT_COLORS.boxLight))
  return rects
}

/** 굴림 막대 (0x8437c~0x84522) */
export function scrollThumbRectsOf(top: number, count: number = SEASON_EQUIPMENT_LEVEL_COUNT): readonly WindowRect[] {
  const box = EQUIPMENT_WINDOW.scroll
  const track: WindowRect = { ...box, color: EQUIPMENT_COLORS.scrollTrack }
  if (count <= EQUIPMENT_WINDOW.visibleRows) {
    return [
      track,
      { x: box.x + 1, y: box.y, width: box.width - 2, height: box.height, color: EQUIPMENT_COLORS.scrollThumb },
      { x: box.x + 2, y: box.y + 1, width: box.width - 4, height: box.height - 2, color: EQUIPMENT_COLORS.boxFill },
    ]
  }
  const thumb = Math.trunc((box.height * EQUIPMENT_WINDOW.visibleRows + count - 1) / count)
  const offset = Math.trunc((top * box.height) / count)
  return [
    track,
    { x: box.x + 1, y: box.y + offset, width: box.width - 2, height: thumb - 1, color: EQUIPMENT_COLORS.scrollThumb },
    { x: box.x + 2, y: box.y + offset + 1, width: box.width - 4, height: thumb - 3, color: EQUIPMENT_COLORS.boxFill },
  ]
}
