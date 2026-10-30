import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { bakedImgTextPaletteOf } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import { SCOREBOARD_AT, SCOREBOARD_FRAME, scoreboardPlacementOf, type ScoreboardSide } from '@/widgets/game-scene/ui/introCanvas/otherSlices'
import { framePlaced, GAME_UI_FRAMES, IMG_TEXT_FRAMES, pad, TEAM_LOGO, type Placed } from '@/widgets/game-scene/ui/introCanvas/placed'

/** PLAYER · COM 글자 팔레트 (0x913e5(img_text, 4)) — 구운 팔레트가 이것이어야 캔버스로 그린다 */
const SIDE_LABEL_PALETTE = 4

/** 점수판 — 틀 · 측 글자 · 로고 (칠 앞) / 팀 이름 (칠 뒤) · 이름 칸 */
export interface IntroScoreboardPlaced {
  readonly before: readonly Placed[]
  readonly after: readonly Placed[]
  readonly plates: readonly { x: number; y: number; width: number; height: number }[]
}

export const NO_INTRO_SCOREBOARD: IntroScoreboardPlaced = { before: [], after: [], plates: [] }

/** 측 글자 — PLAYER/COM 이 다른 팔레트로 구워졌거나 원점이 없으면 null */
function sideLabelsPlaced(labels: readonly { frame: number; x: number; y: number }[], textOrigins: FrameOrigins): Placed[] | null {
  const placed: Placed[] = []
  for (const side of labels) {
    if (bakedImgTextPaletteOf(side.frame) !== SIDE_LABEL_PALETTE) return null
    const label = framePlaced(IMG_TEXT_FRAMES, side.frame, textOrigins, side.x, side.y)
    if (label === null) return null
    placed.push(label)
  }
  return placed
}

/** 팀 이름 — 원점이 하나라도 없으면 null */
function teamNamesPlaced(names: readonly { frame: number; x: number; y: number }[], textOrigins: FrameOrigins): Placed[] | null {
  const placed = names.map((team) => framePlaced(IMG_TEXT_FRAMES, team.frame, textOrigins, team.x, team.y))
  return placed.every((item) => item !== null) ? (placed as Placed[]) : null
}

/** 0x41440 — 인트로 자리 점수판의 그림들. 그림 · 원점을 다 받기 전이면 null */
export function introScoreboardPlacedOf(
  sides: readonly [ScoreboardSide, ScoreboardSide],
  gameUiOrigins: FrameOrigins,
  textOrigins: FrameOrigins,
): IntroScoreboardPlaced | null {
  const placement = scoreboardPlacementOf(SCOREBOARD_AT.intro.x, SCOREBOARD_AT.intro.y, sides)
  const frame = framePlaced(GAME_UI_FRAMES, SCOREBOARD_FRAME, gameUiOrigins, placement.frame.x, placement.frame.y)
  if (frame === null) return null
  const labels = sideLabelsPlaced(placement.labels, textOrigins)
  if (labels === null) return null
  const logos = placement.logos.map((logo) => ({ src: `${TEAM_LOGO}/${pad(logo.team)}.png`, x: logo.x, y: logo.y }))
  const after = teamNamesPlaced(placement.names, textOrigins)
  if (after === null) return null
  return { before: [frame, ...labels, ...logos], after, plates: placement.plates }
}
