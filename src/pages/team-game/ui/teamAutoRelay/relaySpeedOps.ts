import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { frameComposeOps, type ComposeImageOp, type ComposeOp } from '@/shared/lib/pixelEffect/screenCompose'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { relayFieldBackgroundAt } from './otherSlices'
import {
  ARROW_IMAGE,
  ARROW_SIZE,
  GAME_UI_FRAMES,
  SCREEN_WIDTH,
  SPEED_MARK_DIM_EFFECT_LEVEL,
  SPEED_MARK_INDEXES,
  SPEED_MARKS_Y,
  SPEED_PLATE_EFFECT_LEVEL,
  SPEED_PLATE_FRAME,
  SPEED_PLATE_Y,
  gameUiImageSrc,
} from './relayLayout'

/** 속도 세모 줄 왼쪽 — 세 개 폭 + 사이 3 의 가운데 */
export const SPEED_MARKS_X = SCREEN_WIDTH / 2 - Math.trunc((3 * ARROW_SIZE.width + 3) / 2)

/** 세모 하나의 x */
export const speedMarkXOf = (index: number) => SPEED_MARKS_X + index * (ARROW_SIZE.width + 1)

/**
 * 속도 칸 바탕(효과 1, 0xc) · 꺼진 세모(효과 1, 6) 아래는 0x41230 이 깐 수비 운동장뿐이다 — 운동장 그림(투수 발 y 190 · 타자 머리
 * y ≥ 238 이고 x 가 세모 줄 밖 · 주자 x 33 · 207 · 포수 y ≥ 250)도 중계 칸(y < 214)도 이 사각형에 안 닿는다. 그래서 운동장 두 장
 * (`AutoPlayRelayScreen` 의 왼쪽 · 뒤집은 오른쪽)을 같은 좌표로 다시 그려 원본 식으로 섞는다(Q-03 r301, `ComposedOverlay`)
 */
export function fieldUnderOpsOf(fieldUrl: string): readonly ComposeOp[] {
  const fieldAt = relayFieldBackgroundAt()
  return [
    { kind: 'image', src: fieldUrl, x: fieldAt.x, y: fieldAt.y },
    { kind: 'image', src: fieldUrl, x: fieldAt.mirroredX, y: fieldAt.y, flipX: true },
  ]
}

/** 속도 칸 바탕 game_ui 프레임 33 을 (W/2 − w/2, 216) 에 효과 (1, 0xc) 로 */
export function speedPlateOpsOf(gameUiOrigins: FrameOrigins | null, plateX: number) {
  return frameComposeOps(GAME_UI_FRAMES, SPEED_PLATE_FRAME, gameUiOrigins, plateX, SPEED_PLATE_Y, DRAW_EFFECT.TRANSLUCENT, SPEED_PLATE_EFFECT_LEVEL)
}

/** 42e7c~42efa — 세모 세 개를 효과 (1, 6) 으로 깐다 (그림마다 새 묶음 — 옛 그림과 같은 때 다시 섞는다) */
export function dimSpeedMarkOpsOf(): readonly ComposeImageOp[] {
  return SPEED_MARK_INDEXES.map((index) => ({
    kind: 'image',
    src: gameUiImageSrc(ARROW_IMAGE),
    x: speedMarkXOf(index),
    y: SPEED_MARKS_Y,
    effect: DRAW_EFFECT.TRANSLUCENT,
    argument: SPEED_MARK_DIM_EFFECT_LEVEL,
  }))
}
