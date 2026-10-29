/** 0x13 카메라(`hitCamera`) — 고정 오프셋(−120, −70) 그림에서 옮길 차이. 0x13 이 아니면 (0, 0) */
export interface CameraShift {
  readonly dx: number
  readonly dy: number
}

/** 카메라 (+0xff4, +0xff8) 을 더해 그리는 한 그림을 0x13 카메라만큼 옮겨 그린다 */
export function withCameraShift(context: CanvasRenderingContext2D, shift: CameraShift, draw: () => void): void {
  if (shift.dx === 0 && shift.dy === 0) {
    draw()
    return
  }
  context.save()
  context.translate(shift.dx, shift.dy)
  draw()
  context.restore()
}
