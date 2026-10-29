/**
 * 존 표시 0x35ae8 (직접 떴다) — 선이 아니라 slt_pitch 프레임 0x49(73, 빨간 모서리)를 찍는다.
 * ```
 * 35aea  상태 [+0x1c] ∈ {0xd, 0xe, 0x13} 이면 안 그린다
 * 35b06  (w, h) = 0xba815(slt_pitch, 0x49, 종류 1)            ; 프레임 상자 37 × 37
 * 35b12  t = 표 0xcfb7c[+0x17e1] (타자 좌우)
 * 35b2c  x = 카메라 x + t.x + (w >> 1) − 2 ; y = 카메라 y + t.y + (h >> 1) − 2
 * 35b68  0xba759(slt_pitch, 0x49, 종류 1, x, y)               ; 프레임 원점(−18, −18)대로
 * ```
 * 카메라 (−120, −70) → 앵커 우타 (122, 256) · 좌타 (117, 256), 그림 왼쪽 위 우타 (104, 238) · 좌타 (99, 238).
 */
import { placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { GAUGE_TARGET_FRAME } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const ZONE_FRAME_FOLDER = assetUrl('./sprites/slt_pitch/frames')
const ZONE_FRAME_INDEX = 0x49
const ZONE_ANCHOR_INSET = 2

/** 존을 그리는 단계인가 — 0xd · 0xe(웹 '대기' 의 쉬는 동안, 근사) · 0x13('타격')에선 안 그린다. 단계를 모르면 그린다 */
export function showsStrikeZone(phase: StagePhaseSnapshot | undefined): boolean {
  if (phase === undefined) return true
  if (phase.kind === '타격') return false
  return !(phase.kind === '대기' && phase.isPaused)
}

/** 존 그림의 앵커 (프레임 원점을 더하기 전) — 존 표 왼쪽 위 + (상자 >> 1) − 2 */
export function strikeZoneAnchorOf(side: number, frameSize: { readonly width: number; readonly height: number }): { x: number; y: number } {
  const { zoneLeft, zoneTop } = stageLayoutOf(side)
  return {
    x: zoneLeft + (frameSize.width >> 1) - ZONE_ANCHOR_INSET,
    y: zoneTop + (frameSize.height >> 1) - ZONE_ANCHOR_INSET,
  }
}

export function drawStrikeZone(context: CanvasRenderingContext2D, side: number): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, ZONE_FRAME_INDEX)
  if (frame === null) return
  const anchor = strikeZoneAnchorOf(side, frame.image)
  context.drawImage(frame.image, anchor.x + frame.offsetX, anchor.y + frame.offsetY)
}

/**
 * 이글아이 — 원본은 0x11 그리기 0x4d2ac 가 목표점에 ui/slt_pitch 프레임 0x23 을 넣는다(모드 4 · 레코드 +0x54 > 0, 0x4d380 ·
 * `pitchInputOverlay.showsGaugeTargetFrameOf`). 예전 웹이 그리던 원 · 십자는 원본에 없다.
 * 놓은 뒤에도 오차 전 0x10 목표점(+0x10b8)이다 — `eagleEyePixelOf`. ⚠️ +0xff4/+0xff8 흔들림은 안 얹는다.
 */
export function drawEagleEyeMarker(context: CanvasRenderingContext2D, center: { x: number; y: number }): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, GAUGE_TARGET_FRAME)
  if (frame === null) return
  context.drawImage(frame.image, Math.round(center.x) + frame.offsetX, Math.round(center.y) + frame.offsetY)
}
