/**
 * 홈런 글자 연출 그리기 — 좌표·단계는 homeRunBanner.ts 가 셈한다 (원본 0x40b18, R2 3-2).
 *
 * 원본 0xbb91d 는 PZX 를 픽셀 단위로 풀어 화면 버퍼에 직접 쓴다 (R6 3c):
 *   종류 2 = 최근접 표본으로 a/10 배 확대 · 종류 8 = 채널마다 +b 밝게.
 * 웹은 캔버스라 확대는 imageSmoothingEnabled 를 꺼 최근접으로 맞추고,
 * 밝히기는 공용 `pixelEffect` 의 0xbb91d 종류 8 식(비트 복제 없이 펴서 +b · 255 자름 · 565 내림)으로 칠한다.
 */
import { drawFrameAt, GAME_EFFECT_FRAMES, GAME_EFFECT_IMAGE, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { homeRunBurstFrameAt, homeRunLettersAt, type HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import { brightenedImageOf } from '@/shared/lib/pixelEffect/pixelEffect'

/** 0xbb91d 종류 8 — 채널마다 +b (그림이 있는 칸만, 255 에서 자름) — 공용 `brightenedImageOf` (565 내림까지 원본대로) */
const brightened = brightenedImageOf

/** tick = 연출이 켜진 뒤 흐른 틱 (일반 홈런 — 칸 5+i · 셈 0 에서 켠 연출) */
export function drawHomeRunBanner(context: CanvasRenderingContext2D, tick: number): void {
  drawHomeRunTextFrame(context, { letters: homeRunLettersAt(tick), burstFrame: homeRunBurstFrameAt(tick) })
}

/**
 * 그림 한 번(0x40b18) — 글자를 먼저 그리고, 단계 1·2·3 이면 **그 위에** 화면 가운데 game_effect 프레임 18·19·20 을 얹는다
 * (글자 고리 0x40bca~0x40d7a 가 끝난 뒤 0x40d7c~0x40de4 — 2026-10-07 직접 뜸. 예전 웹은 프레임을 먼저 깔았다).
 */
export function drawHomeRunTextFrame(context: CanvasRenderingContext2D, frame: HomeRunTextFrame): void {
  const smoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  for (const letter of frame.letters) {
    const image = sprite(GAME_EFFECT_IMAGE(letter.image))
    if (image === null) continue
    const source = letter.brighten > 0 ? brightened(image, letter.brighten) : image
    context.drawImage(source, letter.x, letter.y, image.width * letter.scale, image.height * letter.scale)
  }
  context.imageSmoothingEnabled = smoothing

  if (frame.burstFrame !== null) {
    // 40de4 0xba759(그림, 0x11 + 단계, 종류 1, W/2, H/2, 효과 0, …) — 칸 18~20 은 모두 0x67 파트라 화면에 더한다(0xc9f98 ca198)
    drawFrameAt(context, GAME_EFFECT_FRAMES, frame.burstFrame, Math.floor(STAGE_WIDTH / 2), Math.floor(STAGE_HEIGHT / 2))
  }
}
