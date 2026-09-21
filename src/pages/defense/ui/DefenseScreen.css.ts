import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 화면 한 장 — RawScreen 안쪽과 같은 240×320 이다 */
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320

/** 카메라를 움직여도 빈 곳이 검게 보이지 않게 바탕을 깐다 */
export const field = style({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: ORIGINAL_COLORS.black,
})

/** stadium/defense.pzx 310×500 두 장 (오른쪽은 좌우 반전) */
export const background = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

export const backgroundMirrored = style([background, { transform: 'scaleX(-1)' }])

/**
 * 팀 팔레트로 다시 칠한 그림 한 장 — `FrameSprite` 와 같은 모양이지만 주소(src)를
 * 교체 엔진에서 받아 오므로 여기서 따로 낸다 (`shared/ui/FrameSprite` 는 읽기 전용).
 */
export const paintedSprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 야수·주자·공 한 칸 — 크기 0 인 기준점이고 그림은 원점만큼 비껴 놓인다 */
export const actor = style({
  position: 'absolute',
  width: 0,
  height: 0,
})

/*
 * 좌우 반전 칸은 지웠다 — 원본 야수 그리기(0x79b48)에 뒤집기가 없다(S12 8절).
 * `+0x11` 은 프레임 +17 이고, 좌/우는 동작 3·4 가 다른 프레임 묶음으로 처리한다.
 */
