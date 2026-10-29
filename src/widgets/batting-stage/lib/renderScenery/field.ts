import { fieldBackground } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_LAYOUT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { RIGHT_HANDED_MIRROR_X } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'

/**
 * 바닥(그라운드) — 원본 `0x7725c` 가 구장 객체 `+0x2c` 에 달린 `stadium/attack` 그림을 그린다.
 * `grassPalette` 가 있으면 그 `.mpl` 줄로 칠한 그림을 쓴다 (잔디 = 팔레트, `0x786c8`).
 * 칠하는 동안에는 구운 그림이 나가므로 첫 몇 프레임은 기본색이 보인다.
 */
export function drawField(context: CanvasRenderingContext2D, grassPalette: number | null, offsetY: number, isMirrored = false, shiftX = 0): void {
  const field = fieldBackground(grassPalette)
  if (field === null) return
  if (isMirrored) {
    // 0x772ca — 우타는 x = 구장+4 − 0x21 에 효과 0x11(제 상자 안 뒤집기). 폭 585 라 좌타 자리(−193)의 238 − x 거울과 같다
    context.save()
    context.translate(RIGHT_HANDED_MIRROR_X + shiftX, 0)
    context.scale(-1, 1)
    context.drawImage(field, -STAGE_LAYOUT.fieldSourceX, STAGE_LAYOUT.fieldTopY + offsetY)
    context.restore()
    return
  }
  if (shiftX !== 0) {
    // 0x13 카메라가 옮긴 가로 — 화면 폭만 잘라 그리던 그림을 통째로 구장+4 자리에서 그린다
    context.drawImage(field, -STAGE_LAYOUT.fieldSourceX + shiftX, STAGE_LAYOUT.fieldTopY + offsetY)
    return
  }
  context.drawImage(field, STAGE_LAYOUT.fieldSourceX, 0, STAGE_WIDTH, field.height, 0, STAGE_LAYOUT.fieldTopY + offsetY, STAGE_WIDTH, field.height)
}
