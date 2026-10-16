import { drawStrengthOf, particlePixelOf } from '@/entities/particle/model/particleEmitter'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { PTC_IMAGE_FRAMES, ptcPartOf, PTC_PART_IMAGE } from '@/widgets/particles/lib/ptcImageFrames'
import { DRAW_EFFECT, drawImagesWithEffect, markCanvasImmutable } from '@/shared/lib/pixelEffect/pixelEffect'
import type { ImageEffectDraw } from '@/shared/lib/pixelEffect/pixelEffect'

/** A 가 그리기로 넘어갈 때의 최대 (8.8 로 잘라 0~256, 0x6dd26) */
export const DRAW_STRENGTH_MAX = 256

/**
 * 입자 그리기의 효과 번호 · 인자 — 2026-10-15 직접 뜸(웹 r83):
 * 0x6dc4c 가 파트 그림의 vtbl+0x14(그림, x, y, **mode**, **A >> 8**, 0)을 부른다(0x6dd26~0x6dd38). 팔레트 그림 클래스
 * vtable 0xda914 의 +0x14 = 0xc9f08 은 제 vtbl+0xc(0xc9e48 → 블릿 0x990e0)에 (x, y, −1, −1, 0, 0, **e, b**, c) 로 넘긴다 —
 * 곧 mode 는 그리기 효과 번호, A >> 8 은 그 인자다(다른 그림 클래스 vtable 0xda960 의 +0x14 = 0xca54c 도 셋째~다섯째 인자를
 * 0xca238 에 그대로 넘긴다 — 파트 그림이 어느 클래스인지는 ⚠️ 미확인이나 두 갈래 모두 효과 · 인자로 쓴다). mode 2 = 효과 2 더하기(화면 + (그림·b) >> 8, 채널 끝에서 자름 —
 * 팔레트 0x973c5 · 16비트 0x9a2f1), mode 0 = 효과 0 그냥 복사.
 * 효과 2 는 b 가 0 이나 255 넘으면 **안 그린다**(0x973d2~0x973dc) — A 가 1.0(b = 256)인 입자는 보이지 않는다(원본 그대로).
 */
export function particleEffectOf(mode: number, strength: number): { readonly effect: number; readonly argument: number } {
  return { effect: mode, argument: strength }
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
  // 효과 입자는 모아 두었다가 한꺼번에 그린다 — 화면 읽기 · 쓰기를 모을 뿐 차례 · 픽셀은 하나씩 그린 것과 같다(`drawImagesWithEffect`).
  // 그냥 복사(효과 0) 입자가 끼면 그 앞까지 먼저 그려 겹침 차례를 지킨다
  const effectDraws: ImageEffectDraw[] = []
  for (const emitter of scene.emitters) {
    const { mode } = emitter.config
    for (const particle of emitter.particles) {
      const part = ptcPartOf(emitter.img, particle.life)
      if (part === null) continue
      const image = sprite(PTC_PART_IMAGE(part.image))
      if (image === null) continue

      const { x, y } = particlePixelOf(particle)
      const { effect, argument } = particleEffectOf(mode, drawStrengthOf(particle))
      // 파트 효과 3 = 좌우 뒤집기 — 파트 원점을 축으로 거울을 놓은 그림을 같은 자리에
      const drawn = part.flip === true ? mirroredOf(image) : image
      if (effect === DRAW_EFFECT.COPY) {
        drawImagesWithEffect(context, effectDraws.splice(0))
        context.drawImage(drawn, x + part.dx, y + part.dy)
      }
      // 화면 칸을 읽어 원본 식으로 섞는다(`drawImageWithEffect` — 565 · 내림 · 끝에서 자름)
      else effectDraws.push({ image: drawn, x: x + part.dx, y: y + part.dy, effect, argument })
    }
  }
  drawImagesWithEffect(context, effectDraws)
}

const mirrored = new WeakMap<CanvasImageSource, HTMLCanvasElement>()

/** 좌우로 뒤집은 그림 (한 번만 만든다) */
function mirroredOf(image: HTMLImageElement | HTMLCanvasElement): HTMLImageElement | HTMLCanvasElement {
  const cached = mirrored.get(image)
  if (cached !== undefined) return cached
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return image
  context.translate(image.width, 0)
  context.scale(-1, 1)
  context.drawImage(image, 0, 0)
  markCanvasImmutable(canvas)
  mirrored.set(image, canvas)
  return canvas
}
