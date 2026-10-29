/**
 * 표 0xd5e58 — 단계 L(1~15) 마다 u16 × 8. 앞 넷은 화면, 뒤 넷은 그림에 거는 채널 마스크다
 * (0xf7de · 0xe79c · 0xc718 · 0x8610 = ½ · ¼ · ⅛ · 1/16 용 — 밀기 전에 아래 비트를 떼어 채널끼리 안 섞이게 한다).
 */
export const TRANSLUCENT_MASKS: readonly (readonly number[])[] = [
  [0xf7de, 0xe79c, 0xc718, 0x8610, 0, 0, 0, 0x8610],
  [0xf7de, 0xe79c, 0xc718, 0, 0, 0, 0xc718, 0],
  [0xf7de, 0xe79c, 0, 0x8610, 0, 0, 0xc718, 0x8610],
  [0xf7de, 0xe79c, 0, 0, 0, 0xe79c, 0, 0],
  [0xf7de, 0, 0xc718, 0x8610, 0, 0xe79c, 0, 0x8610],
  [0xf7de, 0, 0xc718, 0, 0, 0xe79c, 0xc718, 0],
  [0xf7de, 0, 0, 0x8610, 0, 0xe79c, 0xc718, 0x8610],
  [0xf7de, 0, 0, 0, 0xf7de, 0, 0, 0],
  [0, 0xe79c, 0xc718, 0x8610, 0xf7de, 0, 0, 0x8610],
  [0, 0xe79c, 0xc718, 0, 0xf7de, 0, 0xc718, 0],
  [0, 0xe79c, 0, 0x8610, 0xf7de, 0, 0xc718, 0x8610],
  [0, 0xe79c, 0, 0, 0xf7de, 0xe79c, 0, 0],
  [0, 0, 0xc718, 0x8610, 0xf7de, 0xe79c, 0, 0x8610],
  [0, 0, 0xc718, 0, 0xf7de, 0xe79c, 0xc718, 0],
  [0, 0, 0, 0x8610, 0xf7de, 0xe79c, 0xc718, 0x8610],
]

/** 표 0xd5de0 — 단계마다 s8 × 8 (마스크와 짝인 오른쪽 밀기) */
export const TRANSLUCENT_SHIFTS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 0, 0, 0, 4],
  [1, 2, 3, 0, 0, 0, 3, 0],
  [1, 2, 0, 4, 0, 0, 3, 4],
  [1, 2, 0, 0, 0, 2, 0, 0],
  [1, 0, 3, 4, 0, 2, 0, 4],
  [1, 0, 3, 0, 0, 2, 3, 0],
  [1, 0, 0, 4, 0, 2, 3, 4],
  [1, 0, 0, 0, 1, 0, 0, 0],
  [0, 2, 3, 4, 1, 0, 0, 4],
  [0, 2, 3, 0, 1, 0, 3, 0],
  [0, 2, 0, 4, 1, 0, 3, 4],
  [0, 2, 0, 0, 1, 2, 0, 0],
  [0, 0, 3, 4, 1, 2, 0, 4],
  [0, 0, 3, 0, 1, 2, 3, 0],
  [0, 0, 0, 4, 1, 2, 3, 4],
]

/** 효과 1 이 그리는 단계 — 0x9a456~0x9a45c: 0 이나 15 넘으면 아무것도 안 한다. ⚠️ 음수 단계는 원본이 표 밖을 읽는다 — 안 그리는 것으로 둔다 */
export const isTranslucentLevelDrawn = (level: number) => Number.isInteger(level) && level >= 1 && level <= 15

/**
 * 효과 1 한 픽셀 — 0x9a48c~0x9a4ec:
 * `out = Σ_{i<4} (화면 & M[i]) >> S[i]  +  Σ_{i≥4} (그림 & M[i]) >> S[i]` (단계 L 의 줄).
 * 무게로 보면 화면 (16 − L)/16 · 그림 L/16 이지만 마스크마다 아래 비트를 버려 **내림이 여러 번** 들어간다.
 */
export function translucentPixel565(level: number, source: number, screen: number): number {
  if (!isTranslucentLevelDrawn(level)) return screen
  const masks = TRANSLUCENT_MASKS[level - 1]
  const shifts = TRANSLUCENT_SHIFTS[level - 1]
  let out = 0
  for (let index = 0; index < 8; index += 1) {
    const pixel = index < 4 ? screen : source
    out += (pixel & masks[index]) >> shifts[index]
  }
  return out & 0xffff
}

/**
 * DOM 겹치기용 효과 1 무게 — 그림 L/16.
 * ⚠️ 근사(남김 — 웹 DOM 한계): CSS opacity 는 화면 픽셀을 모르는 채 8비트로 섞어 마스크 내림 · 565 양자화를 못 따른다(캔버스면 `drawImageWithEffect`).
 * 아래 화면을 그 장면이 다 그리는 자리(외출 지도)는 RGB565 버퍼 합성(`screenCompose` · `ComposedScreen`)으로 원본 식 그대로 그린다.
 * r301 — 아래 겹을 같은 좌표로 다시 그릴 수 있는 자리도 옮겼다: 카드 로고(공 무늬 + 판, `BallPatternTranslucentImage`) · 중계 속도판
 * (운동장, `ComposedOverlay`) · 미션 띠(타석 캔버스 `missionStrips`) · 인트로(배경 캔버스 `introCanvasOverlayOf`).
 * 남은 DOM 자리는 아래가 바뀌는 여러 겹(수비 화면 야수 · 공, 창 뒤 장면 전체)이라 다시 그릴 수 없는 곳이다(`fieldMap` · `popupDim` 머리).
 */
export const translucentOpacityOf = (level: number) => (isTranslucentLevelDrawn(level) ? level / 16 : 0)
