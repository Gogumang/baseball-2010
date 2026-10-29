/**
 * **그리기 효과의 픽셀 식 — 효과 번호별 공용 모듈** (2026-10-15 직접 뜸, 웹 round6-r75).
 *
 * 원본 그리기는 프레임 그리기 0xbe810 의 **효과 번호**로 갈리고, 번호마다 픽셀 함수가 시작 코드 0x3054~0x3120 에서 등록된다:
 * `0x985ed(k, 16비트판)` · `0x9869d(k, 팔레트판, 팔레트판2)` (R6 3a · 3b).
 * ```
 * 효과   16비트      팔레트 / 팔레트2     식 (모두 RGB565, 그림 픽셀이 투명이면 건너뜀)
 * 0      0x9a275    0x9a9b5 / 0x9aa1d    그대로 복사
 * 1      0x9a449    0x97769 / 0x9786d    반투명 단계 L(1~15): 표 0xd5e58(마스크) · 0xd5de0(밀기)로 화면 (16−L)/16 + 그림 L/16
 * 2      0x9a2f1    0x973c5 / 0x9754d    더하기 b(1~255): 채널마다 화면 + (그림·b) >> 8, 끝에서 자름 · b = 255 는 그냥 더하기
 * 4      0x9b1cd    0x98499 / 0x98511    흔들기 b: 줄마다 r = 난수(b + 1), 그림 칸 자리에 화면[x + r] 을 옮긴다
 * 0xa    0x9ae25    0x97f01 / 0x97f95    회색: s = R5 + G 위 5비트 + B5 + 3, g = s/4 + s/16 + s/64 (내림), g<<11 | g<<6 | g
 * 0xb    0x9ae95    0x98075 / 0x980d9    단색: 인자 색(565 아래 16비트)을 찍는다
 * 0xc    0x9af71    0x98351 / 0x983d1    반반: (그림 & 0xf7de) >> 1 + (색 & 0xf7de) >> 1 — 화면은 안 본다
 * 0xd    0x9aed9    0x98181 / 0x9823d    색 더하기: 채널마다 그림 + 인자 색, 끝에서 자름 — 화면은 안 본다
 * 0x10   0x9afd1    0x979d9 / 0x97abd    확대 · 축소 (자리 식은 프레임 0x944b4, R6 3b) — 픽셀 색은 그대로
 * 0x11   0x9b0e1    0x97c15 / 0x97d31    뒤집기 (R6 3b) — 픽셀 색은 그대로
 * ```
 * 따로 `0x987f9(k, 몸통, 감싸개)` 표(0x3110 · 0x3118)는 **그림 효과가 아니라 단계 덮기**(사각형 칠하기)다 — 2026-10-15 직접 뜸(웹 r83):
 * k = 0 → [0x15605e4] = 0x9aac4 몸통 · [0x15605d4] = 0x9b234 검정 덮기, k = 1 → [0x15605e0] = 0x9a52c 몸통 · [0x15605d0] = 0x9b3f4 색 덮기.
 * 몸통 칸은 감싸개만 읽는다(0x9b248 · 0x9b3aa → +0x5e4, 0x9b408 · 0x9b562 → +0x5e0). k = 2 · 3 칸(+0x5dc · +0x5d8 · +0x5cc)은
 * 0x987f8 밖에서 읽는 곳도 거는 곳도 없다. 덮기 식과 쓰는 곳(창 뒤 어둡게 0x746cc · 결과 패배 0x4a384 · 스토리 0xbd844 …)은 `shared/lib/stepCover`.
 *
 * 같은 식을 쓰는 다른 길:
 * - **0xc37a8** 흑백(화면 사각형을 제자리에서 회색으로) — 효과 0xa 와 같은 식(c3802~c382c). 커맨드 줄 0x7e418 · 필살 창 0x803d4 ·
 *   0x882b4 가 함수 포인터로 부른다. 이미 그린 **화면**을 바꾸므로 DOM 은 그 사각형 안의 겹마다 회색 그림을 잘라 다시 얹는다
 *   (겹이 불투명 복사라 `회색(겹친 결과) = 겹친 결과(회색 겹)`).
 * - **0xbb91d** 종류 비트(홈런 글자 · 맞수 띠) — 4 회색(효과 0xa 식) · 8 밝게(채널 8비트에 +b, 255 자름) · 0x10 섞기 0xbb8d4 (R6 3c).
 *
 * 웹 그림은 565 를 비트 복제로 늘린 8비트라 `rgbTo565` 로 원래 값이 돌아온다. 결과는 다시 비트 복제로 편다(`rgbOf565`).
 * ⚠️ 8비트 → 565 (0x1400748) 와 화면 출력은 단말 몫이라 바이너리에 없다 — 위 비트를 남기는 보통 식으로 둔다.
 *
 * 쪼갠 파일: `effectNumbers`(효과 번호) · `translucent565`(효과 1 · 표 0xd5e58 · 0xd5de0) · `colorEffects565`(효과 2 · 0xa~0xd · 0xbb91d 종류 · 0xc37a8 · 원본 난수) ·
 * `effectPixel565`(번호별 한 픽셀) · `rgbaEffects`(웹 RGBA 칠하기 · CSS 색) · `composeRgba`(화면 RGBA 에 섞기) · `spriteRgba`(그림 픽셀 읽기 캐시) ·
 * `effectDraws`(캔버스 읽기 · 쓰기 모으기) · `imageEffects`(그림 그리기 · 다시 칠한 그림) · `scaledBlend`(0xbb91d 종류 0x12) · `effectUrl`(칠한 그림 주소)
 */
export { DRAW_EFFECT } from '@/shared/lib/pixelEffect/effectNumbers'
export { TRANSLUCENT_MASKS, TRANSLUCENT_SHIFTS, translucentOpacityOf, translucentPixel565 } from '@/shared/lib/pixelEffect/translucent565'
export {
  addColorPixel565,
  additivePixel565,
  blendPixel565,
  brightenPixel565,
  grayPixel565,
  grayRect565,
  halfMixPixel565,
  nextOriginalRandom,
  solidPixel565,
} from '@/shared/lib/pixelEffect/colorEffects565'
export { effectPixel565, isEffectDrawn } from '@/shared/lib/pixelEffect/effectPixel565'
export { color565Of, composeOverSolidRgba, css565, recolorRgba, solidColorCss } from '@/shared/lib/pixelEffect/rgbaEffects'
export { composeRgba, type RgbaSurface } from '@/shared/lib/pixelEffect/composeRgba'
export { createReadCache, effectContextOf, markCanvasImmutable } from '@/shared/lib/pixelEffect/spriteRgba'
export { drawRgbasWithEffect, drawRgbaWithEffect, type EffectCanvasContext, type EffectDraw } from '@/shared/lib/pixelEffect/effectDraws'
export {
  brightenedImageOf,
  drawImagesWithEffect,
  drawImageWithEffect,
  recoloredImageOf,
  type ImageEffectDraw,
} from '@/shared/lib/pixelEffect/imageEffects'
export { drawImageScaledBlend } from '@/shared/lib/pixelEffect/scaledBlend'
export { effectSpriteUrl, paintedEffectSpriteUrlOf } from '@/shared/lib/pixelEffect/effectUrl'
