import { spriteImage } from '@/shared/lib/sprite/spriteCache'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DRAW_EFFECT, drawImagesWithEffect, type ImageEffectDraw } from '@/shared/lib/pixelEffect/pixelEffect'
import { bakedImgTextPaletteOf } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import {
  INTRO_BAND, INTRO_BAND_RGB, INTRO_BAR_FRAME, INTRO_BAR_X, INTRO_BAR_Y, INTRO_STADIUM_LABEL_FRAME, INTRO_STADIUM_LABEL_X,
  INTRO_TEAM_NAME_X, INTRO_TEXT_Y,
} from '@/widgets/game-scene/lib/introLayout'
import { introBandAlphaOf, type IntroFade } from '@/widgets/game-scene/lib/introSchedule'
import {
  NAME_PLATE_COLOR, SCOREBOARD_AT, SCOREBOARD_FRAME, namePlateOpacityOf, roundPlateRectsOf, scoreboardPlacementOf,
  type ScoreboardSide,
} from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { SceneryOverlay } from '@/widgets/batting-stage/ui/SceneryBackdrop'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const TEAM_LOGO = './sprites/team_logo'
const pad = (index: number) => String(index).padStart(3, '0')
/** PLAYER · COM 글자 팔레트 (0x913e5(img_text, 4)) — 구운 팔레트가 이것이어야 캔버스로 그린다 */
const SIDE_LABEL_PALETTE = 4

export interface IntroCanvasInput {
  readonly stadiumNameFrame: number
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  readonly fade: IntroFade
  /** 효과 1 의 인자 — null 이면 효과 0 (`introScoreboardEffectOf`) */
  readonly effectLevel: number | null
}

/** 그림 한 장 — 주소 · 왼쪽 위 */
interface Placed {
  readonly src: string
  readonly x: number
  readonly y: number
}

function framePlaced(folder: string, frame: number, origins: FrameOrigins, x: number, y: number): Placed | null {
  const origin = origins[pad(frame)]
  return origin === undefined ? null : { src: `${folder}/${pad(frame)}.png`, x: x + origin.x, y: y + origin.y }
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
export function introCanvasOverlayOf(
  input: IntroCanvasInput,
  gameUiOrigins: FrameOrigins | null,
  textOrigins: FrameOrigins | null,
): SceneryOverlay | null {
  if (gameUiOrigins === null || textOrigins === null) return null
  const effect = input.effectLevel === null ? DRAW_EFFECT.COPY : DRAW_EFFECT.TRANSLUCENT
  const argument = input.effectLevel ?? 0
  const bar = framePlaced(GAME_UI_FRAMES, INTRO_BAR_FRAME, gameUiOrigins, INTRO_BAR_X, INTRO_BAR_Y)
  const name = framePlaced(IMG_TEXT_FRAMES, input.stadiumNameFrame, textOrigins, INTRO_TEAM_NAME_X, INTRO_TEXT_Y)
  const label = framePlaced(IMG_TEXT_FRAMES, INTRO_STADIUM_LABEL_FRAME, textOrigins, INTRO_STADIUM_LABEL_X, INTRO_TEXT_Y)
  if (bar === null || name === null || label === null) return null
  /** 띠 다음 — 막대 · 글씨 둘 */
  const head: Placed[] = [bar, name, label]
  /** 점수판 — 틀 · 측 글자 · 로고 (칠 앞) / 팀 이름 (칠 뒤) */
  const boardBefore: Placed[] = []
  const boardAfter: Placed[] = []
  let plates: readonly { x: number; y: number; width: number; height: number }[] = []
  const sides = input.scoreboardSides
  if (sides !== undefined) {
    const placement = scoreboardPlacementOf(SCOREBOARD_AT.intro.x, SCOREBOARD_AT.intro.y, sides)
    const frame = framePlaced(GAME_UI_FRAMES, SCOREBOARD_FRAME, gameUiOrigins, placement.frame.x, placement.frame.y)
    if (frame === null) return null
    boardBefore.push(frame)
    for (const side of placement.labels) {
      if (bakedImgTextPaletteOf(side.frame) !== SIDE_LABEL_PALETTE) return null
      const placed = framePlaced(IMG_TEXT_FRAMES, side.frame, textOrigins, side.x, side.y)
      if (placed === null) return null
      boardBefore.push(placed)
    }
    for (const logo of placement.logos) boardBefore.push({ src: `${TEAM_LOGO}/${pad(logo.team)}.png`, x: logo.x, y: logo.y })
    plates = placement.plates
    for (const team of placement.names) {
      const placed = framePlaced(IMG_TEXT_FRAMES, team.frame, textOrigins, team.x, team.y)
      if (placed === null) return null
      boardAfter.push(placed)
    }
  }
  const images = new Map<string, HTMLImageElement>()
  for (const placed of [...head, ...boardBefore, ...boardAfter]) {
    const image = spriteImage(placed.src)
    if (image === null || image.naturalWidth === 0) return null
    images.set(placed.src, image)
  }
  const drawsOf = (list: readonly Placed[]): ImageEffectDraw[] =>
    list.map((placed) => ({ image: images.get(placed.src) as HTMLImageElement, x: placed.x, y: placed.y, effect, argument }))
  const { r, g, b } = INTRO_BAND_RGB
  const bandAlpha = introBandAlphaOf(input.fade) / 255
  const plateOpacity = namePlateOpacityOf(input.fade.alpha)
  const key = JSON.stringify([input, head, boardBefore, boardAfter, plates])
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
      drawImagesWithEffect(context, drawsOf(boardBefore))
      context.fillStyle = NAME_PLATE_COLOR
      context.globalAlpha = plateOpacity
      for (const plate of plates) {
        context.beginPath()
        for (const rect of roundPlateRectsOf(plate)) context.rect(rect.x, rect.y, rect.width, rect.height)
        context.fill()
      }
      context.globalAlpha = 1
      drawImagesWithEffect(context, drawsOf(boardAfter))
    },
  }
}
