import { drawStrengthOf, particlePixelOf } from '@/entities/particle/model/particleEmitter'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { PTC_IMAGE_FRAMES, ptcPartOf, PTC_PART_IMAGE } from '@/widgets/particles/lib/ptcImageFrames'

/** A 가 그리기로 넘어갈 때의 최대 (8.8 로 잘라 0~256, 0x6dd26) */
export const DRAW_STRENGTH_MAX = 256

/**
 * A 값(0~256)을 캔버스 알파로 바꾼다.
 *
 * ⚠️ **유력**: A 가 불투명도인지 세기인지는 아직 못 밝혔고(그리는 쪽 +0x14 구현 미확인),
 * `mode` 도 "0 = 그냥 그리기 / 2 = A 를 쓰는 섞기" 가 유력일 뿐이다 (R5 8절).
 * 그래서 mode 2 일 때만 A 를 알파로 쓰고, 그 밖(파일 001 의 0)은 그냥 그린다.
 */
export function drawAlphaOf(mode: number, strength: number): number {
  if (mode !== 2) return 1
  const clamped = Math.min(DRAW_STRENGTH_MAX, Math.max(0, strength))
  return clamped / DRAW_STRENGTH_MAX
}

/**
 * 파트 그림을 미리 받아 둔다.
 * 연출은 대여섯 틱이면 끝나는데 `sprite` 는 그릴 때 비로소 요청을 내보내므로,
 * 미리 안 받아 두면 **첫 한 번은 통째로 안 보인다**. 화면을 열 때 한 번 부른다.
 * (파트 51장은 한 장에 몇백 바이트라 한꺼번에 받아도 부담이 없다.)
 */
export function preloadPtcParts(): void {
  for (const parts of PTC_IMAGE_FRAMES) {
    for (const part of parts) sprite(PTC_PART_IMAGE(part.image))
  }
}

/**
 * 파티클을 캔버스에 그린다 (0x6dd68 → 0x6dc4c).
 * 입자마다 `x = p.x + (off >> 9) + 파트.dx`, 그림은 `프레임[img].파트[ life % 파트수 ]` 다.
 * (카메라 칸 `relCam`·`followCam` 은 타석 화면 호출지가 전부 0 이라 옮기지 않았다 — R5 7절.)
 */
export function drawParticles(context: CanvasRenderingContext2D, scene: ParticleScene): void {
  const previousAlpha = context.globalAlpha
  for (const emitter of scene.emitters) {
    const { mode } = emitter.config
    for (const particle of emitter.particles) {
      const part = ptcPartOf(emitter.img, particle.life)
      if (part === null) continue
      const image = sprite(PTC_PART_IMAGE(part.image))
      if (image === null) continue

      const { x, y } = particlePixelOf(particle)
      context.globalAlpha = drawAlphaOf(mode, drawStrengthOf(particle))
      if (part.flip === true) {
        // 파트 효과 3 = 좌우 뒤집기. 파트 원점을 축으로 거울을 놓는다
        context.save()
        context.translate((x + part.dx + image.width / 2) * 2, 0)
        context.scale(-1, 1)
        context.drawImage(image, x + part.dx, y + part.dy)
        context.restore()
        continue
      }
      context.drawImage(image, x + part.dx, y + part.dy)
    }
  }
  context.globalAlpha = previousAlpha
}
