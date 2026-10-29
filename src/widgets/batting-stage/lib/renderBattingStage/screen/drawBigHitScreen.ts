/**
 * 큰 타구 0x13 의 화면 연출 — 차례와 근거는 `bigHitScreen` 머리말. 뒤 갈래의 애니 3 자리 = 타격점 투영 + (+0xff4, +0xff8)(4cb8c)이라
 * 0x13 카메라만큼 옮긴다. 멈춤 갈래는 막음 동안이라 카메라가 가운데 그대로다(0x3f060 3f1ea)
 */
import { drawFrameAt, frameAnimations, GAME_EFFECT_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { judgeFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { linePixels, scanlineSpans } from '@/features/play-game/model/aceCutIn'
import { applyZoom565, blurRightDown565, editScreen565OnCanvas, zoomSourceIndexes } from '@/shared/lib/screen565/screen565'
import {
  BIG_HIT_FLASH_COLOR,
  BIG_HIT_FLASH_TRIANGLES,
  BIG_HIT_FOLLOW_ANIMATION,
  BIG_HIT_FOLLOW_BLUR,
  BIG_HIT_HOLD_BLUR,
  bigHitBorderRectsOf,
  bigHitFlashesAt,
  bigHitZoomCenterOf,
  bigHitZoomPercentOf,
  type BigHitScreen,
} from '@/widgets/batting-stage/lib/bigHitScreen'
import type { CameraShift } from '@/widgets/batting-stage/lib/renderBattingStage/screen/cameraShift'

type FollowScreen = Extract<BigHitScreen, { readonly kind: '뒤' }>
type HoldScreen = Extract<BigHitScreen, { readonly kind: '멈춤' }>

export function drawBigHitScreen(context: CanvasRenderingContext2D, effect: BigHitScreen, cameraShift: CameraShift): void {
  if (effect.kind === '뒤') drawFollowScreen(context, effect, cameraShift)
  else drawHoldScreen(context, effect)
}

/** 4cdd6 0xc3469(0, 0, W, H, 1) → 4cdfa 애니 3 을 타격점에 (0x93c45 효과 0) → 0x93d91 */
function drawFollowScreen(context: CanvasRenderingContext2D, effect: FollowScreen, cameraShift: CameraShift): void {
  const width = STAGE_WIDTH
  const height = STAGE_HEIGHT
  editScreen565OnCanvas(context, width, height, (pixels) => blurRightDown565(pixels, width, height, 0, 0, width, height, BIG_HIT_FOLLOW_BLUR))
  const entries = frameAnimations(GAME_EFFECT_FRAMES)?.[BIG_HIT_FOLLOW_ANIMATION]
  const frameIndex = entries === undefined ? null : judgeFrameAt(entries, effect.drawCall)
  if (frameIndex === null || effect.point === null) return
  drawFrameAt(context, GAME_EFFECT_FRAMES, frameIndex, Math.round(effect.point.x) + cameraShift.dx, Math.round(effect.point.y) + cameraShift.dy)
}

/** 4cc34 0xbb43c 확대 → 4cc62 0xc3469(…, 2) 흐리기 — 둘 다 화면 버퍼(565)를 제자리에서 고친다. 그 위에 번쩍임 · 검은 테두리 */
function drawHoldScreen(context: CanvasRenderingContext2D, effect: HoldScreen): void {
  const width = STAGE_WIDTH
  const height = STAGE_HEIGHT
  const center = bigHitZoomCenterOf(effect.side, width, height)
  const zoom = zoomSourceIndexes(width, height, bigHitZoomPercentOf(effect.counter), center.x, center.y)
  editScreen565OnCanvas(context, width, height, (pixels) => {
    applyZoom565(pixels, zoom)
    blurRightDown565(pixels, width, height, 0, 0, width, height, BIG_HIT_HOLD_BLUR)
  })
  if (bigHitFlashesAt(effect.counter)) drawFlashTriangles(context)
  // 4cd18~4cda6 — 검은 테두리 4 줄
  context.fillStyle = '#000000'
  for (const [x, y, w, h] of bigHitBorderRectsOf(width, height)) context.fillRect(x, y, w, h)
}

/**
 * 4cc8a~4ccb6 — 세모마다 0x75e31: 0x75c70 스캔라인 채우기 뒤 0x75dc4 테두리, 채우기 · 테두리 같은 색 0x78FFFFFF.
 * ⚠️ 미확인: 반투명 섞기(0x1400698(gc, 4, 알파))는 알파/255 로 섞는다(`RivalryBandCanvas` 와 같다)(남김 — 단말 몫이라 바이너리에 없다)
 */
function drawFlashTriangles(context: CanvasRenderingContext2D): void {
  const { r, g, b, alpha } = BIG_HIT_FLASH_COLOR
  context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`
  for (const triangle of BIG_HIT_FLASH_TRIANGLES) {
    for (const span of scanlineSpans(triangle)) context.fillRect(span.x0, span.y, span.x1 - span.x0 + 1, 1)
    triangle.forEach((point, index) => {
      for (const pixel of linePixels(point, triangle[(index + 1) % triangle.length])) context.fillRect(pixel.x, pixel.y, 1, 1)
    })
  }
}
