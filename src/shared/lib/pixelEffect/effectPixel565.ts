import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/effectNumbers'
import { isTranslucentLevelDrawn, translucentPixel565 } from '@/shared/lib/pixelEffect/translucent565'
import {
  addColorPixel565,
  additivePixel565,
  grayPixel565,
  halfMixPixel565,
  isAdditiveWeightDrawn,
  solidPixel565,
} from '@/shared/lib/pixelEffect/colorEffects565'

/** 이 효과 · 인자로 그림이 그려지는가 (인자 검사로 통째로 건너뛰는 경우) */
export function isEffectDrawn(effect: number, argument: number): boolean {
  if (effect === DRAW_EFFECT.TRANSLUCENT) return isTranslucentLevelDrawn(argument)
  if (effect === DRAW_EFFECT.ADDITIVE) return isAdditiveWeightDrawn(argument)
  if (effect === DRAW_EFFECT.JITTER) return argument !== 0
  if (effect === DRAW_EFFECT.ADD_COLOR) return argument !== 0
  return true
}

/**
 * 한 픽셀 — 그림 픽셀(투명 아님)과 그 자리 화면 픽셀로 새 화면 픽셀을 낸다. 효과 4(흔들기)는 줄 단위라 여기서 다루지 않는다.
 * 0x10 · 0x11 은 자리만 바꾸는 효과라 색은 그대로(복사)다.
 */
export function effectPixel565(effect: number, argument: number, source: number, screen: number): number {
  switch (effect) {
    case DRAW_EFFECT.TRANSLUCENT:
      return translucentPixel565(argument, source, screen)
    case DRAW_EFFECT.ADDITIVE:
      return additivePixel565(argument, source, screen)
    case DRAW_EFFECT.GRAY:
      return grayPixel565(source)
    case DRAW_EFFECT.SOLID:
      return solidPixel565(argument)
    case DRAW_EFFECT.HALF_MIX:
      return halfMixPixel565(source, argument)
    case DRAW_EFFECT.ADD_COLOR:
      return argument === 0 ? screen : addColorPixel565(source, argument)
    default:
      return source
  }
}
