/**
 * 효과 0x11(좌우 뒤집기)로 그리기 — 상태를 저장하고, 뒤집으면 x = `axisX` 를 축으로 거울을 놓은 뒤 그리고 되돌린다.
 * 투수 · 타자 · 투수 덧그림 · 필살 그림이 모두 이 모양이다(거울 축 잡기는 근사, `drawBatter` 주석).
 */
export function drawMirroredAt(context: CanvasRenderingContext2D, axisX: number, isMirrored: boolean, draw: () => void): void {
  context.save()
  if (isMirrored) {
    context.translate(axisX * 2, 0)
    context.scale(-1, 1)
  }
  draw()
  context.restore()
}
