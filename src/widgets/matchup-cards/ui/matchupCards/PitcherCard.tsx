import type { CSSProperties } from 'react'
import {
  LABEL,
  NUMBER_BASE,
  PITCHER_BOXES,
  PITCHER_CARD_FRAME,
  boxNumberGlyphsOf,
  earnedRunAverageGlyphsOf,
  staminaGaugeRectsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { ImgTextPaletteIndex } from '@/shared/ui'
import type { MatchupPitcherCard } from '@/widgets/matchup-cards/ui/matchupCards/matchupCardTypes'
import { CardBase, Fill, Glyphs, NameText } from '@/widgets/matchup-cards/ui/matchupCards/cardParts'
import { Chip, Label } from '@/widgets/matchup-cards/ui/matchupCards/cardLabels'

/** 보직 칸 · 글자 (0xb6704 보직 → game_ui 칸 · img_text 글자) */
export interface RoleBadge {
  readonly chip: number
  readonly label: number
}

/** 그 자리의 img_text 팔레트 (`useImgTextPalettes().styleOf`) */
export type PaletteStyleOf = (frame: number, palette: ImgTextPaletteIndex) => CSSProperties | undefined

interface PitcherCardProps {
  readonly pitcher: MatchupPitcherCard
  readonly origin: Placed
  /** PLAYER / COM 글자 */
  readonly teamLabel: number
  readonly roleBadge: RoleBadge | null
  readonly styleOf: PaletteStyleOf
}

/** 방어율 숫자 · 소수점 — 값을 모르면 안 그린다 */
function EarnedRunAverage({ value, origin }: { readonly value: number | undefined; readonly origin: Placed }) {
  if (value === undefined) return null
  const era = earnedRunAverageGlyphsOf(value, origin)
  return (
    <>
      <Glyphs glyphs={era.glyphs} testId="방어율" />
      <Fill rect={era.point} />
    </>
  )
}

/** 투수 판 (game_ui 프레임 1) */
export function PitcherCard({ pitcher, origin: p, teamLabel, roleBadge, styleOf }: PitcherCardProps) {
  return (
    <div data-testid="투수판" data-x={p.x} data-y={p.y}>
      <CardBase frame={PITCHER_CARD_FRAME} origin={p} />
      <Label frame={teamLabel} cardBox={PITCHER_BOXES[1]} anchor={0x11} origin={p} testId="투수팀" paletteStyle={styleOf(teamLabel, 4)} />
      {pitcher.name !== undefined && <NameText name={pitcher.name} cardBox={PITCHER_BOXES[3]} origin={p} />}
      {roleBadge !== null && (
        <>
          <Chip frame={roleBadge.chip} cardBox={PITCHER_BOXES[7]} origin={p} testId="보직칸" />
          <Label
            frame={roleBadge.label}
            cardBox={PITCHER_BOXES[7]}
            anchor={0x22}
            origin={p}
            testId="보직"
            paletteStyle={styleOf(roleBadge.label, 0)}
          />
        </>
      )}
      {pitcher.throwsLeft !== undefined && (
        <Label
          frame={pitcher.throwsLeft ? LABEL.leftPitcher : LABEL.rightPitcher}
          cardBox={PITCHER_BOXES[8]}
          anchor={0x22}
          origin={p}
          testId="투수손"
        />
      )}
      <Label frame={LABEL.earnedRun} cardBox={PITCHER_BOXES[4]} anchor={0x22} origin={p} testId="방어" />
      <EarnedRunAverage value={pitcher.earnedRunAverage} origin={p} />
      <Label frame={LABEL.strikeout} cardBox={PITCHER_BOXES[5]} anchor={0x22} origin={p} testId="삼진" />
      {pitcher.strikeouts !== undefined && (
        <Glyphs glyphs={boxNumberGlyphsOf(pitcher.strikeouts, PITCHER_BOXES[6], p, NUMBER_BASE.stat, 1, 0x24)} testId="탈삼진" />
      )}
      {pitcher.stamina !== undefined && staminaGaugeRectsOf(pitcher.stamina, p).map((rect, index) => <Fill key={`stamina-${index}`} rect={rect} />)}
    </div>
  )
}
