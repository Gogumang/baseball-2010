import { spriteImage } from '@/shared/lib/sprite/spriteCache'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DRAW_EFFECT, drawImagesWithEffect, type ImageEffectDraw } from '@/shared/lib/pixelEffect/pixelEffect'
import {
  INTRO_BAND,
  INTRO_BAND_RGB,
  INTRO_BAR_FRAME,
  INTRO_BAR_X,
  INTRO_BAR_Y,
  INTRO_STADIUM_LABEL_FRAME,
  INTRO_STADIUM_LABEL_X,
  INTRO_TEAM_NAME_X,
  INTRO_TEXT_Y,
} from '@/widgets/game-scene/lib/introLayout'
import { introBandAlphaOf, type IntroFade } from '@/widgets/game-scene/lib/introSchedule'
import {
  NAME_PLATE_COLOR,
  namePlateOpacityOf,
  roundPlateRectsOf,
  type ScoreboardSide,
  type SceneryOverlay,
} from '@/widgets/game-scene/ui/introCanvas/otherSlices'
import { framePlaced, GAME_UI_FRAMES, IMG_TEXT_FRAMES, type Placed } from '@/widgets/game-scene/ui/introCanvas/placed'
import { introScoreboardPlacedOf, NO_INTRO_SCOREBOARD, type IntroScoreboardPlaced } from '@/widgets/game-scene/ui/introCanvas/introScoreboard'

export interface IntroCanvasInput {
  readonly stadiumNameFrame: number
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  readonly fade: IntroFade
  /** 효과 1 의 인자 — null 이면 효과 0 (`introScoreboardEffectOf`) */
  readonly effectLevel: number | null
}

/**
 * **인트로 0x417ac 를 배경 캔버스에 이어 그리기** (Q-03 r301) — 띠 0x6a9f0 · 막대(game_ui 8) · 팀 이름 · "스타디움" · 점수판 틀 0x41440 을
 * 원본 차례로 배경(0x40ff0) 캔버스에 그려, 흐려지는 동안(`[+0x17e6] ≤ 14` → 효과 1 · 인자)의 반투명을 그 화면을 읽어 원본 식
 * (`drawImagesWithEffect` — 0x9a449 마스크 내림 · 565)으로 섞는다. DOM 겹으로는 배경 캔버스를 못 읽어 CSS 불투명도로 근사했다.
 * 그림 · 원점을 다 받기 전이거나 PLAYER/COM 글자가 다른 팔레트로 구워졌으면 null — 부르는 쪽은 DOM 근사로 둔다.
 *
 * 띠 · 이름 칸 칠은 플랫폼 그리기 속성(0x1400698 — 알파 윗바이트)이라 섞기 식이 바이너리에 없다 — 캔버스 알파 칠(DOM 과 같은 8비트 섞기)로
 * 그린다. 이름 칸 두 직사각형은 한 경로로 칠해 겹친 자리가 두 번 섞이지 않는다(`ScoreboardFrame` 과 같다).
 */
/** 막대 · 팀 이름 · "스타디움" — 원점이 없으면 null */
function introHeadOf(input: IntroCanvasInput, gameUiOrigins: FrameOrigins, textOrigins: FrameOrigins): readonly Placed[] | null {
  const bar = framePlaced(GAME_UI_FRAMES, INTRO_BAR_FRAME, gameUiOrigins, INTRO_BAR_X, INTRO_BAR_Y)
  const name = framePlaced(IMG_TEXT_FRAMES, input.stadiumNameFrame, textOrigins, INTRO_TEAM_NAME_X, INTRO_TEXT_Y)
  const label = framePlaced(IMG_TEXT_FRAMES, INTRO_STADIUM_LABEL_FRAME, textOrigins, INTRO_STADIUM_LABEL_X, INTRO_TEXT_Y)
  if (bar === null || name === null || label === null) return null
  return [bar, name, label]
}

/** 다 받은 그림 — 하나라도 아직이면 null */
function loadedImagesOf(placedList: readonly Placed[]): Map<string, HTMLImageElement> | null {
  const images = new Map<string, HTMLImageElement>()
  for (const placed of placedList) {
    const image = spriteImage(placed.src)
    if (image === null || image.naturalWidth === 0) return null
    images.set(placed.src, image)
  }
  return images
}

/** 이름 칸 칠 — 두 직사각형을 한 경로로 칠해 겹친 자리가 두 번 섞이지 않는다 */
function fillNamePlates(context: CanvasRenderingContext2D, plates: IntroScoreboardPlaced['plates'], opacity: number): void {
  context.fillStyle = NAME_PLATE_COLOR
  context.globalAlpha = opacity
  for (const plate of plates) {
    context.beginPath()
    for (const rect of roundPlateRectsOf(plate)) context.rect(rect.x, rect.y, rect.width, rect.height)
    context.fill()
  }
  context.globalAlpha = 1
}

/** 점수판을 안 그리는 인트로면 빈 판 */
function introBoardOf(
  sides: IntroCanvasInput['scoreboardSides'],
  gameUiOrigins: FrameOrigins,
  textOrigins: FrameOrigins,
): IntroScoreboardPlaced | null {
  return sides === undefined ? NO_INTRO_SCOREBOARD : introScoreboardPlacedOf(sides, gameUiOrigins, textOrigins)
}

export function introCanvasOverlayOf(
  input: IntroCanvasInput,
  gameUiOrigins: FrameOrigins | null,
  textOrigins: FrameOrigins | null,
): SceneryOverlay | null {
  if (gameUiOrigins === null || textOrigins === null) return null
  const effect = input.effectLevel === null ? DRAW_EFFECT.COPY : DRAW_EFFECT.TRANSLUCENT
  const argument = input.effectLevel ?? 0
  /** 띠 다음 — 막대 · 글씨 둘 */
  const head = introHeadOf(input, gameUiOrigins, textOrigins)
  if (head === null) return null
  const sides = input.scoreboardSides
  const board = introBoardOf(sides, gameUiOrigins, textOrigins)
  if (board === null) return null
  const images = loadedImagesOf([...head, ...board.before, ...board.after])
  if (images === null) return null
  const drawsOf = (list: readonly Placed[]): ImageEffectDraw[] =>
    list.map((placed) => ({ image: images.get(placed.src) as HTMLImageElement, x: placed.x, y: placed.y, effect, argument }))
  const { r, g, b } = INTRO_BAND_RGB
  const bandAlpha = introBandAlphaOf(input.fade) / 255
  const plateOpacity = namePlateOpacityOf(input.fade.alpha)
  const key = JSON.stringify([input, head, board.before, board.after, board.plates])
  return {
    key,
    draw: (context) => {
      // 417e8 띠 — 색 윗바이트 알파 max(1, +0x17e4 − 0x55)
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${bandAlpha})`
      context.fillRect(INTRO_BAND.x, INTRO_BAND.y, INTRO_BAND.width, INTRO_BAND.height)
      // 41862 막대 · 418b6 팀 이름 · 419b2 "스타디움" — 효과 · 인자는 점수판과 같다
      drawImagesWithEffect(context, drawsOf(head))
      if (sides === undefined) return
      // 419f4 → 0x41440 — 틀 · 측 글자 · 로고, 이름 칸 칠(인트로는 알파 +0x17e4), 팀 이름
      drawImagesWithEffect(context, drawsOf(board.before))
      fillNamePlates(context, board.plates, plateOpacity)
      drawImagesWithEffect(context, drawsOf(board.after))
    },
  }
}
