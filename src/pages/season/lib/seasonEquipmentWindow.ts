import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import {
  SEASON_EQUIPMENT_LEVEL_COUNT, SEASON_FIRST_HIDDEN_LEVEL, seasonEquipmentHiddenIdOf, seasonEquipmentNameOf,
  seasonEquipmentPriceOf, seasonEquipmentRequiredPopularityOf,
} from '@/entities/season-mode/model/seasonEquipment'

/**
 * **시즌 장비 창 0xdc · 창 종류 3** 의 그림 — 그리기 0xb1f8 b296~b346 (직접 떴다, 0x83378 은 에뮬레이터로 그리기 호출을 맞춰 봤다):
 * ```
 * 0xb1f8   [this+0x88] 메뉴 칸 ≠ 1 이고 [창+0x1a4] == 3 이면  0x8453c(창, 틱) → 0x83378 · 카드 0x7ba44 · 선수 그림(0xd9 와 같다) · 머리띠 0x7f4ec
 *          (상태판 · 커맨드 줄은 그리지 않는다)
 * 0x83378  프레임 = mode_ui (0x7b970 모드 4 ? 30 : 31) — 시즌은 늘 31(투수 쪽 부위 아이콘, 타자여도 — 원본 그대로)
 *   판   0x7c110(창, 박스 6, 1)                                   ; `tabPanelRectsOf`
 *   박스 0 (h − 2) 네 칸: 세로선 (x, y)~(x, y + h) #4A7BDE · x + 1 #29318C, x += w + 2
 *   박스 4 설명 상자: 윗선 #18244A · 채움 (x, y + 1, w, h − 6) #1D44A8 · 왼선 (x, y)~(x, y + h) #18244A ·
 *         오른선 (x + w − 1, y + 1)~(…, y + h − 6) #4A7DDE · 깎인 귀 다섯 줄 · 밑선 #4A7DDE  ; `descriptionBoxRectsOf`
 *   프레임 그림 vt+0x10(프레임, 0, 0)
 *   박스 1 세 줄 (y += h + 2): img_text 302 소지금 · 303 가격 · 333 효과 — 정렬 0x24 · ox −2
 *   박스 2 줄 0: 소지금 0x63331(SR+2 × 100 만원, 정렬 0x24, ox −2)
 *   부위 표시 mode_ui 51 을 (박스 0 x + 2 + 부위 × (w + 2), y, w, h) 가운데 — 칸 목록이 아니면 틱 % 10 == 0 에 끈다
 *   줄 i = 맨 윗줄 … +4 (칸 수 [창+0x1b0] = 11 까지), 박스 3 에서 y += h + 2:
 *     글색 (0x87, 0xf8, 0xff) · 그 선수의 진짜 니블 − 1 == 칸 이면 mode_ui 44 막대 + 글색 (0xce, 0xc7, 0xbd)
 *     칸 > 6 이고 0x9f69d(app, 타자?, 부위, 칸 − 7) == 0 이면 "????"(0xd4c18), 아니면 StrITEM 이름 — 칸 가운데(0x22)
 *     칸 목록 [창+0x1a8] 이고 커서 줄이면: 틱 % 10 ≠ 0 에 노랑 테두리 0xb9ed5 · 글색 노랑(255, 255, 0) 으로
 *       박스 2 줄 1 가격 0x63331(0xd4510[11 × 부위 + 칸 (+44 타자)] × 1000 만원, 0x24, −2)
 *       박스 2 줄 2 효과 — d = 0x6c805(v, 10)(자릿수 − 1), v = 0xd41ae[칸]:
 *         img_text (타자 336 · 투수 340) + 부위 를 0x24 · ox −(7d + 19) · num 105 "+" 를 0x24 · ox −(7d + 10) · oy 1 ·
 *         숫자 0xba719(자간 1, v, num 20, 0x24, ox −2)
 *       박스 4 설명 (0xba411 정렬 0x11, 안쪽 5 · 5):
 *         칸 > 6 — 잠겼으면 StrITEM[(타자 202 · 투수 186) + 4 × 부위 + 칸 − 7] 힌트, 열렸으면 아무것도 없다
 *         칸 ≤ 6 — 0xd44ae[칸] == 0 이면 StrITEM[184] "인기도 제한 없음", 아니면 StrITEM[185] "인기도 %d 이상"
 *   박스 5 굴림 막대: 바탕 #102152 · 칸 수 ≤ 5 면 통째, 아니면 높이 t = (5h + 칸수 − 1) / 칸수 · 자리 (윗줄 × h) / 칸수 —
 *         흰 (x + 1, y + p, w − 2, t − 1) · #1D44A8 (x + 2, y + p + 1, w − 4, t − 3)
 * ```
 * 목록 두 개(0x81618 종류 3): 부위 [창+0x198] = 4 열 × 1 줄, 칸 [창+0x19c] = 1 열 × 11 줄 · 보이는 줄 [+0x38] = 5 — 둘 다 깃발 0x30(끝에서 감는다).
 */

export interface WindowBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** mode_ui 프레임 31 의 박스 0~6 */
export const EQUIPMENT_WINDOW = {
  frame: 31,
  partSlots: { x: 134, y: 164, width: 19, height: 13 },
  labels: { x: 26, y: 180, width: 37, height: 15 },
  values: { x: 64, y: 180, width: 63, height: 15 },
  items: { x: 134, y: 180, width: 70, height: 15 },
  description: { x: 27, y: 233, width: 100, height: 37 },
  scroll: { x: 207, y: 185, width: 7, height: 73 },
  panel: { x: 18, y: 176, width: 203, height: 90 },
  /** 줄 사이 — y += h + 2 */
  rowGap: 2,
  visibleRows: 5,
  /** 이름표 img_text — 302 소지금 · 303 가격 · 333 효과 (표 0xd495c) */
  labelFrames: [302, 303, 333],
  /** 부위 표시 mode_ui 51 · 낀 칸 막대 mode_ui 44 */
  partMarkerFrame: 51,
  equippedBarFrame: 44,
  /** 정렬 0x24 의 ox */
  valueInset: 2,
  /** num 105 "+" */
  plusFrame: 105,
  /** 효과 이름표 img_text — 타자 336 + 부위 · 투수 340 + 부위 (0x83f48) */
  effectLabelBase: { 타자: 336, 투수: 340 },
  /** 0x83378 의 설명 상자 안쪽 (0xba411 인자 5 · 5) */
  descriptionInset: 5,
  /** 커서 테두리 · 부위 표시가 틱 % 10 == 0 에 꺼진다 */
  blinkPeriod: 10,
} as const

export const EQUIPMENT_COLORS = {
  separator: '#4a7bde',
  separatorShade: '#29318c',
  boxEdge: '#18244a',
  boxFill: '#1d44a8',
  boxLight: '#4a7dde',
  itemText: '#87f8ff',
  equippedText: '#cec7bd',
  cursor: '#ffff00',
  scrollTrack: '#102152',
  scrollThumb: '#ffffff',
} as const

/** 1px 넓이까지 칠하는 사각 — 선 · 점도 이걸로 편다 */
export interface WindowRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

const hline = (x1: number, x2: number, y: number, color: string): WindowRect =>
  ({ x: Math.min(x1, x2), y, width: Math.abs(x2 - x1) + 1, height: 1, color })
const vline = (x: number, y1: number, y2: number, color: string): WindowRect =>
  ({ x, y: Math.min(y1, y2), width: 1, height: Math.abs(y2 - y1) + 1, color })
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

/** 줄 r 의 박스 (y += h + 2) */
export function windowRowOf(box: WindowBox, row: number): WindowBox {
  return { ...box, y: box.y + row * (box.height + EQUIPMENT_WINDOW.rowGap) }
}

/** 부위 표시 칸 — (박스 0 x + 2 + 부위 × (w + 2), y, w, h) */
export function partMarkerBoxOf(part: number): WindowBox {
  const box = EQUIPMENT_WINDOW.partSlots
  return { ...box, x: box.x + 2 + part * (box.width + 2) }
}

/** 0xb9e05 · 0xb9d35 의 정렬 0x22 가운데 — 가로 trunc(d / 2) + d % 2 · 세로 같은 식 (C 나머지) */
export function centeredOffsetOf(boxSize: number, imageSize: number): number {
  const d = boxSize - imageSize
  return Math.trunc(d / 2) + (d % 2)
}

/** 틱 % 10 ≠ 0 — 커서 테두리 · 부위 표시가 켜진 틱 */
export const isBlinkOn = (tick: number) => tick % EQUIPMENT_WINDOW.blinkPeriod !== 0

/* ── 칸 목록 ─────────────────────────────────────────────────────────────── */

/** 칸 목록 커서 한 걸음 — 1 열 × 11 줄, 깃발 0x30 이라 끝에서 감는다 */
export function moveEquipmentLevel(level: number, step: -1 | 1): number {
  return (level + step + SEASON_EQUIPMENT_LEVEL_COUNT) % SEASON_EQUIPMENT_LEVEL_COUNT
}

/** 부위 목록 커서 한 걸음 — 4 열 × 1 줄, 감는다 */
export function moveEquipmentPart(part: number, step: -1 | 1): number {
  return (part + step + 4) % 4
}

/** 굴림 0x6c2bd — 커서가 보이는 다섯 줄 밖이면 겨우 보이게만 맨 윗줄을 옮긴다 */
export function scrolledEquipmentTopOf(top: number, cursor: number): number {
  if (cursor < top) return cursor
  if (cursor >= top + EQUIPMENT_WINDOW.visibleRows) return cursor - EQUIPMENT_WINDOW.visibleRows + 1
  return top
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

/* ── 칸 글 ──────────────────────────────────────────────────────────────── */

/** 잠긴 히든 칸 이름 (0xd4c18) */
export const LOCKED_ITEM_NAME = '????'

const isLockedLevel = (isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean) =>
  level >= SEASON_FIRST_HIDDEN_LEVEL && !isHiddenOpen(seasonEquipmentHiddenIdOf(isBatter, part, level))

/** 칸 이름 — 잠긴 히든 칸은 "????" */
export function equipmentItemNameOf(isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean): string {
  return isLockedLevel(isBatter, part, level, isHiddenOpen) ? LOCKED_ITEM_NAME : seasonEquipmentNameOf(isBatter, part, level)
}

/** 가격 칸 — 0xd4510 × 1000 만원 (= 0xcbca8 × 10 백만 원과 같은 표) */
export function equipmentPriceTenThousandsOf(isBatter: boolean, part: number, level: number): number {
  return seasonEquipmentPriceOf(isBatter, part, level) * 1000
}

/** 보너스 표 0xd41ae — 칸마다 (부위와 무관) */
const EFFECT_BONUS: readonly number[] = [30, 50, 70, 90, 110, 125, 140, 190, 210, 230, 250]

export function equipmentEffectBonusOf(level: number): number {
  return EFFECT_BONUS[level] ?? 0
}

/** 0x6c805(v, 10) — 10 으로 나눠 0 이 될 때까지 센다(자릿수 − 1) */
export function divisionsOf(value: number): number {
  let count = 0
  let left = Math.trunc(value / 10)
  while (left !== 0) {
    count += 1
    left = Math.trunc(left / 10)
  }
  return count
}

/** 효과 줄 ox — 이름표 −(7d + 19) · "+" −(7d + 10) */
export function effectOffsetsOf(bonus: number): { readonly label: number; readonly plus: number } {
  const d = divisionsOf(bonus)
  return { label: -(7 * d + 19), plus: -(7 * d + 10) }
}

/** 히든 힌트 첫 칸 — StrITEM 186(투수) · 202(타자) */
const HIDDEN_HINT_BASE = { 타자: 202, 투수: 186 } as const
const HINTS_PER_PART = 4
/** StrITEM[184] "인기도 제한 없음" · [185] "인기도 %d 이상" */
const NO_POPULARITY_LIMIT = 184
const POPULARITY_LIMIT_FORMAT = 185

/** 설명 상자 글 — 없으면 null (열린 히든 칸) */
export function equipmentDescriptionOf(
  isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean,
): string | null {
  if (level >= SEASON_FIRST_HIDDEN_LEVEL) {
    if (!isLockedLevel(isBatter, part, level, isHiddenOpen)) return null
    const base = HIDDEN_HINT_BASE[isBatter ? '타자' : '투수']
    return ORIGINAL_ITEMS[base + HINTS_PER_PART * part + level - SEASON_FIRST_HIDDEN_LEVEL] ?? ''
  }
  // 0xd44ae — 0xcbd58 과 같은 값(필요 인기도)
  const required = seasonEquipmentRequiredPopularityOf(level)
  if (required === 0) return ORIGINAL_ITEMS[NO_POPULARITY_LIMIT] ?? ''
  return (ORIGINAL_ITEMS[POPULARITY_LIMIT_FORMAT] ?? '').replace('%d', String(required))
}
