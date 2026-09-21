import { placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  DOT_IMAGE, MAP_ANCHOR, MAP_BORDER, MAP_COLORS, MAP_FRAME, MAP_FRAMES,
  dotCenterOf, runnerDotsOf,
} from '@/widgets/batting-stage/lib/fieldMap'
import type { BaseOccupancy } from '@/widgets/batting-stage/lib/fieldMap'

/**
 * 작은 지도 그리기 (0x395f4). 값·차례의 근거는 `fieldMap.ts` 머리말에 모아 두었다.
 *
 * HUD 의 1·2·3루 램프와는 **별개의 그림**이다 — 원본도 전광판(0x373d0)과 지도(0x395f4)를
 * 따로 그린다.
 */
export function drawFieldMap(context: CanvasRenderingContext2D, bases: BaseOccupancy): void {
  const frame = placedFrame(MAP_FRAMES, MAP_FRAME)
  if (frame === null) return

  // 프레임 상자 r = 앵커 + 프레임 원점, 크기는 그림 크기 (PZX 합성 프레임의 박스)
  const box = {
    x: MAP_ANCHOR.x + frame.offsetX,
    y: MAP_ANCHOR.y + frame.offsetY,
    width: frame.image.width,
    height: frame.image.height,
  }

  // 0x3965a~0x396f4: 사방 2 넓힌 상자에 세 겹 채우기
  context.fillStyle = MAP_COLORS.outer
  context.fillRect(box.x - MAP_BORDER, box.y - MAP_BORDER, box.width + MAP_BORDER * 2, box.height + MAP_BORDER * 2)
  context.fillStyle = MAP_COLORS.inner
  context.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2)
  context.fillStyle = MAP_COLORS.backdrop
  context.fillRect(box.x, box.y, box.width, box.height)

  context.drawImage(frame.image, box.x, box.y)

  const dot = sprite(DOT_IMAGE)
  if (dot === null) return
  for (const base of runnerDotsOf(bases)) {
    const center = dotCenterOf(base)
    // 0x397be: 그림 폭·높이의 절반만큼 당겨 중심을 루 자리에 맞춘다
    context.drawImage(dot, center.x - Math.floor(dot.width / 2), center.y - Math.floor(dot.height / 2))
  }
}
