/**
 * **화면 버퍼 합성 (RGB565)** — 원본처럼 16비트 화면 버퍼 하나에 그리기를 차례로 덮어 쓴다.
 *
 * DOM 겹치기는 아래 화면 픽셀을 못 읽어 반투명(효과 1 0x9a449) · 단계 덮기(0x9aac4 · 0x9a52c)를 CSS 불투명도로 근사한다.
 * 아래 화면을 모두 아는 자리(지도 · 판처럼 그 장면이 다 그리는 밑그림)는 이 버퍼에 원본 식 그대로 그려 캔버스 한 장으로 놓는다
 * (`shared/ui/ComposedScreen`). 식은 효과 번호별 `effectPixel565`(그림 0x985ed 표) · 단계 덮기 `stepCover` 의 픽셀 식이다.
 *
 * 쪼갠 파일: `composeTypes`(그림 · 그리기 칸) · `sprite565Draw`(그림 읽기 · 한 장 그리기 · 사각형 덮기) · `composeScreen`(화면 · 겹 합성 · RGBA 펴기)
 */
export type { ComposeImageOp, ComposeOp, Sprite565 } from '@/shared/lib/pixelEffect/composeTypes'
export { sprite565Of } from '@/shared/lib/pixelEffect/sprite565Draw'
export { composeOverlay565, composeScreen565, frameComposeOps, rgbaOfScreen565 } from '@/shared/lib/pixelEffect/composeScreen'
