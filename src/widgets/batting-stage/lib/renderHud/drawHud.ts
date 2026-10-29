import { ORIGINAL_COLORS } from '@/shared/config/design'
import { drawLamps } from '@/widgets/batting-stage/lib/renderHud/hudLamps'
import { inningGlyphsOf, numGlyphSizeOf, numGlyphUrl } from '@/widgets/batting-stage/lib/renderHud/hudNumbers'
import { HUD_FRAMES, HUD_ORIGIN, hudPartUrl } from '@/widgets/batting-stage/lib/renderHud/hudParts'
import {
  BOTTOM_ROW_SCORE_OFFSET_Y,
  ROW_BOTTOM,
  ROW_TOP,
  SCORE_ALIGN_BOTTOM,
  SCORE_ALIGN_TOP,
  drawTeamRow,
  hudRowsOf,
} from '@/widgets/batting-stage/lib/renderHud/hudRows'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud/hudState'
import { fillRound } from '@/widgets/batting-stage/lib/renderHud/roundFill'
import { placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'

const BOARD = { x: 5, y: 5, width: 82, height: 50 }
const BOARD_ROUND = 5

const BASE_LIT_PART = 6
const BASES = { first: { x: 68, y: 14 }, second: { x: 59, y: 9 }, third: { x: 50, y: 14 } } as const

/** `tick` = 타석이 열린 뒤 흐른 틱. 새 램프 확대 연출이 이걸로 z 를 센다 */
export function drawHud(context: CanvasRenderingContext2D, hud: HudState, tick: number): void {
  drawBoard(context)
  drawTeamRows(context, hud)
  const frame = placedFrame(HUD_FRAMES, 0)
  if (frame !== null) context.drawImage(frame.image, HUD_ORIGIN.x + frame.offsetX, HUD_ORIGIN.y + frame.offsetY)
  drawLitBases(context, hud.bases)
  drawLamps(context, hud, tick)
  drawInning(context, hud.inning)
}

/** 판: 박스 1 + (6,6) = (5,5,82,50) 검정 둥글기 5 → (+1,+1,−2,−2) #335FCD 둥글기 5 (37444~37488, 둥근 칠 0xba0bd → 0x6b7d4) */
function drawBoard(context: CanvasRenderingContext2D): void {
  fillRound(context, BOARD, BOARD_ROUND, ORIGINAL_COLORS.black)
  fillRound(context, { x: BOARD.x + 1, y: BOARD.y + 1, width: BOARD.width - 2, height: BOARD.height - 2 }, BOARD_ROUND, ORIGINAL_COLORS.boardFill)
}

/** 위 줄 = 측 0(선공, 초 공격), 아래 줄 = 측 1(후공, 말 공격). 공격 막대는 st[9] == 0 이면 위, == 1 이면 아래 (0x374e0 · 0x375b2) */
function drawTeamRows(context: CanvasRenderingContext2D, hud: HudState): void {
  const rows = hudRowsOf(hud)
  drawTeamRow(context, ROW_TOP, rows.top.logoUrl, rows.top.score, rows.top.isBatting, 0, SCORE_ALIGN_TOP)
  drawTeamRow(context, ROW_BOTTOM, rows.bottom.logoUrl, rows.bottom.score, rows.bottom.isBatting, BOTTOM_ROW_SCORE_OFFSET_Y, SCORE_ALIGN_BOTTOM)
}

/** 주자가 있는 베이스에 파트 6 (빈 베이스 파트 5 는 프레임에 있다) */
function drawLitBases(context: CanvasRenderingContext2D, bases: HudState['bases']): void {
  for (const base of ['first', 'second', 'third'] as const) {
    if (!bases[base]) continue
    const image = sprite(hudPartUrl(BASE_LIT_PART))
    if (image !== null) context.drawImage(image, BASES[base].x, BASES[base].y)
  }
}

/** 이닝 숫자 — `inningGlyphsOf` 자리에 num 글자 */
function drawInning(context: CanvasRenderingContext2D, inning: number): void {
  const innings = inningGlyphsOf(inning, numGlyphSizeOf)
  for (const glyph of innings ?? []) {
    const image = sprite(numGlyphUrl(glyph.index))
    if (image !== null) context.drawImage(image, glyph.x, glyph.y)
  }
}
