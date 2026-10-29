/** 하늘 0x77fe8 · 구름 0x782d6 · 하늘 조명 0x78490 */
import {
  CLOUD_FRAMES,
  SKY_LIGHT_FRAMES,
  drawFrameAt,
  frameAnimations,
  placedFrame,
  warmRecoloredFrames,
} from '@/widgets/batting-stage/lib/spriteLoader'
import {
  CLOUD_WRAP_WIDTH,
  SKY_LIGHT_LAST_COLOR_INDEX,
  cloudScrollAt,
  isSkyLightModeShown,
  skyColorsOf,
  skyLightFrameAt,
  skyLightPaletteRowOf,
} from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { CAMERA, CLOUD_COUNT, FLAT_SKY_COLOR, FLAT_SKY_STADIUM, SKY_GRADIENT } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

/** 구장 8 의 하늘 — 화면 전체 (0, 0, W, H) 를 한 색으로 (0x78040~0x78088) */
export function drawFlatSky(context: CanvasRenderingContext2D): void {
  context.fillStyle = FLAT_SKY_COLOR
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
}

/**
 * 하늘 띠 — 표 0xd37a4 줄 · 칸의 두 색으로 위 단색 · 그라데이션 · 아래 단색. 띠는 구장+8 에서 잰다 — 카메라가 옮긴 dy 만큼
 * 같이 내려간다(가로 480 이라 화면을 늘 덮는다)
 */
export function drawSkyBands(context: CanvasRenderingContext2D, top: string, bottom: string, dy: number): void {
  const skyTop = SKY_GRADIENT.top + dy
  const skyBottom = SKY_GRADIENT.bottom + dy
  context.fillStyle = top
  context.fillRect(0, 0, STAGE_WIDTH, skyTop)
  const gradient = context.createLinearGradient(0, skyTop, 0, skyBottom)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, skyTop, STAGE_WIDTH, skyBottom - skyTop)
  context.fillStyle = bottom
  context.fillRect(0, skyBottom, STAGE_WIDTH, SKY_GRADIENT.end - SKY_GRADIENT.bottom)
}

/**
 * 하늘 0x77fe8 — 구장 +0x70 == 8 이면(78040~78088) 화면 전체 (0, 0, W, H) 를 RGB(0xc6, 0xd4, 0xd7) 한 색으로 칠하고 끝난다
 * (그라데이션 · 구름 없음). 그 밖은 표 0xd37a4 줄 · 칸의 두 색으로 위 단색 · 그라데이션 · 아래 단색.
 * 돌려주는 색 칸은 구름 · 하늘 조명이 쓴다(구장 8 은 둘 다 안 그린다).
 */
export function drawSky(context: CanvasRenderingContext2D, state: SceneryState, dy = 0): number {
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.skyColumn)
  if (state.stadium === FLAT_SKY_STADIUM) drawFlatSky(context)
  else drawSkyBands(context, top, bottom, dy)
  return colorIndex
}

/** 구름 (0x782d6~) — 그림은 0x76fd0 이 `.mpl` 줄 `v − 1` 로 실어 둔 것이다 (`cloudPaletteRowOf`) */
export function drawClouds(context: CanvasRenderingContext2D, cloudCalls: number, paletteRow: number | null): void {
  for (let index = 0; index < CLOUD_COUNT; index += 1) {
    const frame = placedFrame(CLOUD_FRAMES, index, paletteRow)
    if (frame === null) continue
    const x = CAMERA.x + cloudScrollAt(index, cloudCalls) + frame.offsetX
    const y = CAMERA.y + frame.offsetY
    context.drawImage(frame.image, x, y)
    context.drawImage(frame.image, x + CLOUD_WRAP_WIDTH, y)
  }
}

/**
 * **하늘 조명** `sky_effect_light` (구장+0x38) — 그리기 `0x78490(구장, y, 움직임)`, 바닥 **다음** 맨 위 겹.
 * ```
 * 78494: 구장+0x50(= 장면 상태, 0x3f07c) == 0x19(정산) → 안 그림
 * 784a2: 모드(0x1552d10) ∈ {5, 6, 7} → 안 그림
 * 784b2: +0x38 이 안 실렸거나(v > 7) · y 인자 ≠ 0 · 구장+0x70 == 8 → 안 그림
 * 784d6: v = 표0xd37a4[행][열] > 7 → 안 그림
 * 784ea: (x0, y0) = 프레임0.vt18() ; w = 프레임0[+0x12]
 * 78526: 애니 0 을 (화면폭 − x0 − w, 0) 에 그린다 (0x93c44)
 * 7853c: 움직임 인자면 0x93d90(한 칸) · 0x93cfc(애니, 1)(되풀이)  ; 0x40ff0: 움직임 = 장면 상태 ≠ 0x11
 * ```
 * 프레임 원점이 (163, 0) 폭 77 이라 `240 − 163 − 77 = 0` — **애니 기준점이 화면 (0, 0)** 이고 그림은 오른쪽
 * 위 구석(163~240)에 붙는다. vt18 을 "프레임 0 의 원점" 으로 읽은 것은 유력이다(원점 + 폭이 화면폭과 꼭 맞는다).
 *
 * **근사**: 원본은 투구 비행(상태 0x11) 동안 애니를 멈추지만 이 그리기는 장면 상태를 몰라 타석 틱으로 늘 돌린다.
 * 상태 0x19(정산)·y 인자 ≠ 0 은 타석 화면에서 일어나지 않아 뺐다.
 * ⚠️ 함께 실리는 `sky_effect_light1`(구장+0x3c) 은 **그리는 자리를 못 찾았다** — 구장 클래스(0x76a00~0x79000)와
 * 장면+0xf10 을 거쳐 +0x38/+0x3c 를 읽는 곳을 전수로 훑어도 0x78490 의 +0x38 뿐이다. 그래서 안 그린다.
 */
export function drawSkyLight(context: CanvasRenderingContext2D, state: SceneryState, colorIndex: number): void {
  if (!isSkyLightModeShown(state.gameMode)) return
  if (state.stadium === FLAT_SKY_STADIUM) return
  if (colorIndex > SKY_LIGHT_LAST_COLOR_INDEX) return
  const entries = frameAnimations(SKY_LIGHT_FRAMES)?.[0]
  if (entries === undefined) return
  const frameIndex = skyLightFrameAt(entries, state.tick)
  if (frameIndex === null) return
  const paletteRow = skyLightPaletteRowOf(colorIndex)
  // 애니 0 의 칸 전부를 미리 칠한다 — 넘어가는 칸마다 구운 벌이 한 박자 비치지 않게 (원본은 적재 때 팔레트를 갈아 끼운다)
  warmRecoloredFrames(`sky-light|${paletteRow}`, () =>
    [...new Set(entries.map((entry) => entry.frame))].map((frame) => ({ folder: SKY_LIGHT_FRAMES, frame, paletteIndex: paletteRow })),
  )
  const first = placedFrame(SKY_LIGHT_FRAMES, 0, paletteRow)
  if (first === null) return
  const originX = STAGE_WIDTH - first.offsetX - first.image.width
  // 애니 그리기 0x93c45(…, 효과 r3 = 0) → 프레임 0xc9f98 이 파트 효과 0x67 을 픽셀 효과 2(더하기 b = 200 ~ 100)로 그린다 —
  // 하늘 · 구름 · 펜스 · 바닥을 칠한 화면에 더한다(`drawFrameAt` → `layers.json`). 겹이 아직이면 구운 근사(알파 b/255)
  drawFrameAt(context, SKY_LIGHT_FRAMES, frameIndex, originX, 0, { paletteIndex: paletteRow })
}
