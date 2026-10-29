import { UI_COLORS } from '@/shared/config/design'
import { alignedNumberGlyphsOf } from '@/widgets/batting-stage/lib/renderHud/alignedNumberGlyphs'
import { numGlyphSizeOf, numGlyphUrl } from '@/widgets/batting-stage/lib/renderHud/hudNumbers'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud/hudState'
import { fillRound } from '@/widgets/batting-stage/lib/renderHud/roundFill'
import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'

const ROW_ROUND = 3

export const ROW_TOP = { x: 8, y: 21, width: 36, height: 14 }

export const ROW_BOTTOM = { x: 8, y: 38, width: 36, height: 14 }

const ROW_COLOR = UI_COLORS.hudRow

const OFFENSE_BAR_COLOR = UI_COLORS.hudOffense

const OFFENSE_BAR_WIDTH = 3

const LOGO_OFFSET = { x: 5, y: 2 }

const SCORE_DIGITS_START = 20

/**
 * 점수 숫자 0xba719 → 0xba51c (37552~3756c 위 · 37624~37640 아래, 직접 떴다): 박스 = 줄 상자에서 x 를 로고 앞 +3 (3751c · 375ee)
 * 옮긴 것, 자간 1 · ox −3 · oy 0. 정렬은 위 줄 0x24(오른쪽 + 세로 가운데) · 아래 줄 4(오른쪽만, 대신 박스 y + 3 — 37614).
 */
const SCORE_LETTER_SPACING = 1

const SCORE_BOX_SHIFT_X = 3

const SCORE_OFFSET_X = -3

export const SCORE_ALIGN_TOP = 0x24

export const SCORE_ALIGN_BOTTOM = 0x4

export const BOTTOM_ROW_SCORE_OFFSET_Y = 3

/** HUD 한 줄에 그릴 것 — 팀 로고 · 점수 · 공격 막대 */
export interface HudRow {
  readonly logoUrl: string
  readonly score: number
  readonly isBatting: boolean
}

const PLAYER_SIDE_LAST_BAT = 1

/** 위 줄 = 측 0(선공), 아래 줄 = 측 1(후공). 사람 팀이 어느 측인지는 `playerSide` 로 고른다 */
export function hudRowsOf(hud: HudState): { readonly top: HudRow; readonly bottom: HudRow } {
  const ours = { logoUrl: hud.ourLogoUrl, score: hud.ourScore }
  const theirs = { logoUrl: hud.opponentLogoUrl, score: hud.opponentScore }
  const isPlayerFirst = (hud.playerSide ?? PLAYER_SIDE_LAST_BAT) !== PLAYER_SIDE_LAST_BAT
  const isSide1Batting = hud.half === '말'
  return {
    top: { ...(isPlayerFirst ? ours : theirs), isBatting: !isSide1Batting },
    bottom: { ...(isPlayerFirst ? theirs : ours), isBatting: isSide1Batting },
  }
}

export function drawTeamRow(
  context: CanvasRenderingContext2D,
  row: { x: number; y: number; width: number; height: number },
  logoUrl: string,
  score: number,
  isBatting: boolean,
  scoreOffsetY: number,
  scoreAlign: number,
): void {
  // 팀 줄 #222854 둥글기 3 (374c6~374dc · 37598~375ae), 공격 막대 = 네모 칠 0x6a9f1(x + 1, y + 2, 3, h − 2) #FFE500 (374ea~37512)
  fillRound(context, row, ROW_ROUND, ROW_COLOR)
  if (isBatting) {
    context.fillStyle = OFFENSE_BAR_COLOR
    context.fillRect(row.x + 1, row.y + 2, OFFENSE_BAR_WIDTH, row.height - 2)
  }
  const logo = sprite(logoUrl)
  if (logo !== null) context.drawImage(logo, row.x + LOGO_OFFSET.x, row.y + LOGO_OFFSET.y)
  const box = { x: row.x + SCORE_BOX_SHIFT_X, y: row.y + scoreOffsetY, width: row.width, height: row.height }
  const glyphs = alignedNumberGlyphsOf(
    score,
    box,
    {
      spacing: SCORE_LETTER_SPACING,
      start: SCORE_DIGITS_START,
      align: scoreAlign,
      offsetX: SCORE_OFFSET_X,
      offsetY: 0,
    },
    numGlyphSizeOf,
  )
  if (glyphs === null) return
  for (const glyph of glyphs) {
    const image = sprite(numGlyphUrl(glyph.index))
    if (image !== null) context.drawImage(image, glyph.x, glyph.y)
  }
}
