/** 0xf 구질 목록 그리기 — 빛 지도 · 칸 틀 · 고리 · 머리글자 · 이름 · 마구 판 · 반짝임 (타석 공용 그리기 0x4c4bc 4c528~4c8de) */
import { MAGIC_TYPE_NUMBER, NUM_IMAGE, SLT_FRAMES, SLT_IMAGE } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayAssets'
import { drawFrame, frameBoxes, onceLength, onceStepAt } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayFrames'
import type { PitchMenuOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayTypes'
import {
  LIGHT_BASE,
  LIGHT_SCALE,
  LIGHT_SPOT,
  MAGIC_BADGE_ANIMATION,
  MAGIC_COUNT_OFFSET,
  RING_BOX_FRAME,
  SHINE_ANIMATION,
  SPOTLIGHT_RAISE,
  SPOT_MASK_SIZE,
  SPOT_MASK_SPANS,
  TYPE_ICON_IMAGES,
  pitchMenuFrameOf,
  pitchMenuLabelX,
  pitchMenuShineStepOf,
} from '@/widgets/batting-stage/lib/pitchInputOverlay/pitchMenuLayout'
import { frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 0xf 구질 목록 — 존 자리(0x4c53c)에 그린다. `anchor` 는 투수 앵커(`stageLayout.pitcherAnchor`).
 * 빛 지도는 그 앞까지 그린 화면(배경 · 선수 · 공 · HUD)을 어둡게 한다 — 소프트키 글자는 그 뒤라 안 어두워진다.
 */
export function drawPitchMenu(context: CanvasRenderingContext2D, overlay: PitchMenuOverlay, side: number): void {
  const anchor = stageLayoutOf(side).pitcherAnchor
  drawSpotlight(context, anchor)
  const menu = pitchMenuFrameOf(overlay.tick, overlay.typeNumbers)
  for (const frame of menu.slotFrames) if (frame !== null) drawFrame(context, SLT_FRAMES, frame, anchor.x, anchor.y)
  drawFrame(context, SLT_FRAMES, menu.ring, anchor.x, anchor.y)
  if (!menu.showsSlots) return
  const boxes = frameBoxes(SLT_FRAMES)?.[String(RING_BOX_FRAME).padStart(3, '0')] ?? null
  for (let slot = 1; slot <= MENU_SLOT_COUNT; slot += 1) drawMenuSlot(context, overlay, slot, anchor, boxes)
  drawMenuShine(context, overlay.tick, anchor)
}

type Anchor = { readonly x: number; readonly y: number }
type FrameBoxList = readonly (readonly number[])[]

/** 칸 1..5 (구질 [+0xfac + 4i]) — 칸 0(OK) 은 고리 프레임 25 에 그려져 있다 */
const MENU_SLOT_COUNT = 5

function drawMenuSlot(context: CanvasRenderingContext2D, overlay: PitchMenuOverlay, slot: number, anchor: Anchor, boxes: FrameBoxList | null): void {
  const typeNumber = overlay.typeNumbers[slot] ?? 0
  if (typeNumber === MAGIC_TYPE_NUMBER) {
    drawMagicSlot(context, overlay.magicRemaining, anchor)
    return
  }
  if (typeNumber === 0 || boxes === null) return
  drawTypeSlot(context, typeNumber, slot, anchor, boxes)
}

/** 마구 칸 — 남은 마구 0xaea11 > 0 일 때만 애니 5 와 남은 수 */
function drawMagicSlot(context: CanvasRenderingContext2D, magicRemaining: number, anchor: Anchor): void {
  if (magicRemaining <= 0) return
  // 애니 5 는 늘 첫 칸 (확인 r112): 4c6ba 0xba759(slt, 5, 종류 2, …, 진행 1)가 0x93c45 로 그리고 0x93d91 로 진행하지만,
  // 애니 객체는 만들 때 0x938d4 가 +2 = 1(멈춤 비트)로 두고 0x93d90 은 비트 0 이 서 있으면 안 나간다(93da8). 비트 0 을 내리는
  // 켜기 0x93cfd 는 +0x1010 을 읽는 곳(0x35afc · 0x398da 애니 1 · 0x3db20 애니 0 · 0x48900 적재 · 0x4c4bc · 0x4ce9c · 0x4d2ac ·
  // 0x4d780 · 0x4dc78) 중 애니 0 · 1 에만 건다 → 애니 5 는 멈춘 첫 칸 그대로다.
  const entries = frameAnimations(SLT_FRAMES)?.[MAGIC_BADGE_ANIMATION]
  if (entries?.[0] !== undefined) drawFrame(context, SLT_FRAMES, entries[0].frame, anchor.x, anchor.y)
  const digit = sprite(NUM_IMAGE(magicRemaining))
  if (digit !== null) context.drawImage(digit, anchor.x + MAGIC_COUNT_OFFSET.x, anchor.y + MAGIC_COUNT_OFFSET.y)
}

/** 구질 칸 — 머리글자 그림을 상자 [i − 1] 에, 이름 프레임 (구질 − 1) 을 상자 [i + 3] 의 y 에 (`pitchMenuLabelX`) */
function drawTypeSlot(context: CanvasRenderingContext2D, typeNumber: number, slot: number, anchor: Anchor, boxes: FrameBoxList): void {
  const iconBox = boxes[slot - 1]
  const icon = sprite(SLT_IMAGE(TYPE_ICON_IMAGES[typeNumber] ?? 0))
  if (iconBox !== undefined && icon !== null) context.drawImage(icon, anchor.x + iconBox[0], anchor.y + iconBox[1])
  const labelBox = boxes[slot + 3]
  const label = placedFrame(SLT_FRAMES, typeNumber - 1)
  if (labelBox === undefined || label === null) return
  context.drawImage(label.image, pitchMenuLabelX(slot, anchor.x, labelBox, label.image.width) + label.offsetX, anchor.y + labelBox[1] + label.offsetY)
}

/** 반짝임 — 애니 2 를 반복 없이 (`pitchMenuShineStepOf`) */
function drawMenuShine(context: CanvasRenderingContext2D, tick: number, anchor: Anchor): void {
  const shine = frameAnimations(SLT_FRAMES)?.[SHINE_ANIMATION]
  if (shine === undefined) return
  const step = pitchMenuShineStepOf(tick, onceLength(shine))
  const entry = step === null ? null : onceStepAt(shine, step)
  if (entry !== null) drawFrame(context, SLT_FRAMES, entry.frame, anchor.x, anchor.y)
}

/** 빛 지도 0x9ce71 — 칸(2×2) 마다 (1 − 값/32) 만큼 검게 덮는다 */
function drawSpotlight(context: CanvasRenderingContext2D, anchor: { readonly x: number; readonly y: number }): void {
  context.fillStyle = `rgba(0, 0, 0, ${1 - LIGHT_BASE / LIGHT_SCALE})`
  const left = (anchor.x >> 1) - (SPOT_MASK_SIZE >> 1)
  const top = ((anchor.y - SPOTLIGHT_RAISE) >> 1) - (SPOT_MASK_SIZE >> 1)
  const halfWidth = STAGE_WIDTH >> 1
  const halfHeight = STAGE_HEIGHT >> 1
  for (let cellY = 0; cellY < halfHeight; cellY += 1) {
    const span = SPOT_MASK_SPANS[cellY - top]
    if (span === undefined) {
      context.fillRect(0, cellY * 2, STAGE_WIDTH, 2)
      continue
    }
    const start = Math.max(0, left + span[0])
    const end = Math.min(halfWidth, left + span[1])
    if (start > 0) context.fillRect(0, cellY * 2, start * 2, 2)
    if (end < halfWidth) context.fillRect(end * 2, cellY * 2, STAGE_WIDTH - end * 2, 2)
  }
  context.fillStyle = `rgba(0, 0, 0, ${1 - LIGHT_SPOT / LIGHT_SCALE})`
  for (let row = 0; row < SPOT_MASK_SPANS.length; row += 1) {
    const span = SPOT_MASK_SPANS[row]
    context.fillRect((left + span[0]) * 2, (top + row) * 2, (span[1] - span[0]) * 2, 2)
  }
}
