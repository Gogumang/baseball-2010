/** 0xf 구질 목록의 배치 — 빛 지도 · 고리 · 칸 틀 · 머리글자 · 반짝임 (4c528~4c8de) */

/** 빛 지도 — 바탕 15 · 원 31 (0x3ed28 +0x1c = 16 → 0x9cb88 이 16 − 1 로 채운다) */
export const LIGHT_BASE = 15
export const LIGHT_SPOT = 31
export const LIGHT_SCALE = 32
/** 원 도장 중심은 투수 앵커에서 20 위 (4c5b8 `subs r2, #0x14`) */
export const SPOTLIGHT_RAISE = 20
/** ui/slt_pitch.raw 30×30 의 줄마다 [시작, 끝) — 값 31 인 칸 */
export const SPOT_MASK_SPANS: readonly (readonly [number, number])[] = [
  [11, 19],
  [8, 22],
  [7, 23],
  [5, 25],
  [4, 26],
  [3, 27],
  [3, 27],
  [2, 28],
  [1, 29],
  [1, 29],
  [1, 29],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [1, 29],
  [1, 29],
  [1, 29],
  [2, 28],
  [3, 27],
  [3, 27],
  [4, 26],
  [5, 25],
  [7, 23],
  [8, 22],
  [11, 19],
]
export const SPOT_MASK_SIZE = 30

/** 빛 지도 한 칸 (반 해상도) 의 밝기 — 화면 점 (x, y) 가 든 칸. 원 도장 왼쪽 위 = ((x0 >> 1) − 15, ((y0 − 20) >> 1) − 15) */
export function spotlightLevelAt(cellX: number, cellY: number, anchor: { readonly x: number; readonly y: number }): number {
  const left = (anchor.x >> 1) - (SPOT_MASK_SIZE >> 1)
  const top = ((anchor.y - SPOTLIGHT_RAISE) >> 1) - (SPOT_MASK_SIZE >> 1)
  const span = SPOT_MASK_SPANS[cellY - top]
  if (span === undefined) return LIGHT_BASE
  const column = cellX - left
  return column >= span[0] && column < span[1] ? LIGHT_SPOT : LIGHT_BASE
}

/** 고리 프레임 — 진입 0x16 에서 그림마다 +1, 0x19 에 멈춘다 */
const RING_FIRST_FRAME = 0x16
const RING_LAST_FRAME = 0x19
/** 칸 틀 첫 프레임 0x26 + 4(칸 − 1) */
const SLOT_FRAME_BASE = 0x26
const SLOT_FRAME_STEP = 4
/** 구질 → 머리글자 그림 (표 0xcfd37, s8) */
export const TYPE_ICON_IMAGES: readonly number[] = [15, 12, 22, 23, 24, 24, 24, 26, 33, 26, 26, 21, 24, 24, 24, 26, 24, 26, 34, 24, 24, 25]
/** 마구 판 애니 5 · 남은 수 (x0 + 0x34, y0 + 0x16) */
export const MAGIC_BADGE_ANIMATION = 5
export const MAGIC_COUNT_OFFSET = { x: 0x34, y: 0x16 } as const
/** 반짝임 애니 2 — 틱 4 · 70 의 배수에서 */
export const SHINE_ANIMATION = 2
const SHINE_FIRST_TICK = 4
const SHINE_PERIOD = 70
/** 고리 프레임 25 의 상자 (0x94a65) — 0..3 머리글자, 4..7 이름 */
export const RING_BOX_FRAME = RING_LAST_FRAME

export interface PitchMenuFrame {
  /** 고리 프레임 */
  readonly ring: number
  /** 칸 1..4 의 틀 프레임 (구질이 없는 칸은 null) */
  readonly slotFrames: readonly (number | null)[]
  /** 머리글자 · 이름을 그리는가 (그림 3 부터) */
  readonly showsSlots: boolean
}

/** 0xf 에 든 뒤 그림 k 의 고리 · 칸 틀 (4c5d4~4c66a) */
export function pitchMenuFrameOf(tick: number, typeNumbers: readonly number[]): PitchMenuFrame {
  const steps = Math.min(Math.max(0, tick), RING_LAST_FRAME - RING_FIRST_FRAME)
  const slotFrames = [1, 2, 3, 4].map((slot) => ((typeNumbers[slot] ?? 0) === 0 ? null : SLOT_FRAME_BASE + SLOT_FRAME_STEP * (slot - 1) + steps))
  return { ring: RING_FIRST_FRAME + steps, slotFrames, showsSlots: tick >= RING_LAST_FRAME - RING_FIRST_FRAME }
}

/** 반짝임 애니 2 의 칸 번호(0..) — 안 그리면 null. 켜는 검사는 칸을 그리는 그림(틱 ≥ 3)에서만 돈다 */
export function pitchMenuShineStepOf(tick: number, length: number): number | null {
  const start = tick >= SHINE_PERIOD ? Math.floor(tick / SHINE_PERIOD) * SHINE_PERIOD : SHINE_FIRST_TICK
  const step = tick - start
  return step >= 0 && step < length ? step : null
}

/** 칸 i(1..4) 의 이름 프레임 왼쪽 위 x — 1 · 3 왼쪽 맞춤, 2 · 4 오른쪽 맞춤 (4c772~4c7ae) */
export function pitchMenuLabelX(slot: number, anchorX: number, box: readonly number[], labelWidth: number): number {
  if (slot === 2 || slot === 4) return anchorX + box[0] + box[2] - labelWidth
  if (slot === 1 || slot === 3) return anchorX + box[0]
  return anchorX
}
