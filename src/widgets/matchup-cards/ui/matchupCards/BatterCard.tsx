import {
  BATTER_BOXES,
  BATTER_CARD_FRAME,
  GAME_UI_FOLDER,
  GAME_UI_FRAMES,
  IMG_TEXT_FOLDER,
  IMG_TEXT_FRAMES,
  LABEL,
  NUMBER_BASE,
  batterPositionBadgeOf,
  battingAverageGlyphsOf,
  boxNumberGlyphsOf,
  recentResultChipsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/matchupCards/matchupCardTypes'
import type { PaletteStyleOf, RoleBadge } from '@/widgets/matchup-cards/ui/matchupCards/PitcherCard'
import { CardBase, Fill, FrameImage, Glyphs, NameText } from '@/widgets/matchup-cards/ui/matchupCards/cardParts'
import { Chip, Label } from '@/widgets/matchup-cards/ui/matchupCards/cardLabels'

/** 수비 번호 9 를 넘는 칸 — 앞 판의 칸(0x545e8 이 안 넣었으면 0x44b9c 의 0)과 이 판 박스 1 글자가 남는다 */
const LAST_POSITION = 9

/** 수비 칸 · 글자 — 9 보다 크면 앞 판 보직 칸이 남으므로 앞 판 보직을 모르면 못 그린다 */
function positionBadgeOf(position: number | undefined, roleBadge: RoleBadge | null, teamLabel: number): RoleBadge | null {
  if (position === undefined) return null
  if (position > LAST_POSITION && roleBadge === null) return null
  return batterPositionBadgeOf(position, roleBadge?.chip ?? 0, teamLabel)
}

interface PositionBadgeProps {
  readonly badge: RoleBadge
  readonly origin: Placed
  readonly styleOf: PaletteStyleOf
}

function PositionBadge({ badge, origin: b, styleOf }: PositionBadgeProps) {
  return (
    <>
      {badge.chip >= 0 && <Chip frame={badge.chip} cardBox={BATTER_BOXES[7]} origin={b} testId="수비칸" />}
      {/* 글자만 1px 아래 (0x452e8 `adds r2,#1`) */}
      {badge.label >= 0 && (
        <Label
          frame={badge.label}
          cardBox={BATTER_BOXES[7]}
          anchor={0x22}
          origin={{ x: b.x, y: b.y + 1 }}
          testId="수비"
          paletteStyle={styleOf(badge.label, 0)}
        />
      )}
    </>
  )
}

/** 타율 숫자 · 소수점 — 값을 모르면 안 그린다 */
function BattingAverage({ value, origin }: { readonly value: number | undefined; readonly origin: Placed }) {
  if (value === undefined) return null
  const average = battingAverageGlyphsOf(value, origin)
  return (
    <>
      <Glyphs glyphs={average.glyphs} testId="타율" />
      <Fill rect={average.point} />
    </>
  )
}

/** 오늘 타석 기록 칸 · 글자 */
function RecentResults({ results, origin }: { readonly results: readonly number[] | undefined; readonly origin: Placed }) {
  if (results === undefined) return null
  return recentResultChipsOf(results, origin).map((chip, index) => (
    <span key={index} data-testid="타석기록" data-label={chip.label}>
      <FrameImage folder={GAME_UI_FOLDER} frame={chip.frame} size={GAME_UI_FRAMES[chip.frame]} at={chip} testId="기록칸" />
      <FrameImage
        folder={IMG_TEXT_FOLDER}
        frame={chip.label}
        size={IMG_TEXT_FRAMES[chip.label]}
        at={{ x: chip.labelX, y: chip.labelY }}
        testId="기록글자"
      />
    </span>
  ))
}

/** 판 숫자 칸 하나 — 값을 모르면 안 그린다 */
function BoxNumber({
  value,
  box,
  origin,
  testId,
}: {
  readonly value: number | undefined
  readonly box: number
  readonly origin: Placed
  readonly testId: string
}) {
  if (value === undefined) return null
  return <Glyphs glyphs={boxNumberGlyphsOf(value, BATTER_BOXES[box], origin, NUMBER_BASE.stat, 1, 0x24)} testId={testId} />
}

interface BatterCardProps {
  readonly batter: MatchupBatterCard
  readonly origin: Placed
  /** 0xb63c0(지금 타자) — 0 이 아니면 좌타 */
  readonly batterHand: number
  /** PLAYER / COM 글자 */
  readonly teamLabel: number
  /** 앞 판(투수) 보직 칸 — 수비 번호가 9 를 넘으면 남는다 */
  readonly roleBadge: RoleBadge | null
  readonly styleOf: PaletteStyleOf
}

/** 타자 판 (game_ui 프레임 2) */
export function BatterCard({ batter, origin: b, batterHand, teamLabel, roleBadge, styleOf }: BatterCardProps) {
  const positionBadge = positionBadgeOf(batter.position, roleBadge, teamLabel)
  return (
    <div data-testid="타자판" data-x={b.x} data-y={b.y}>
      <CardBase frame={BATTER_CARD_FRAME} origin={b} />
      <Label frame={teamLabel} cardBox={BATTER_BOXES[1]} anchor={0x11} origin={b} testId="타자팀" paletteStyle={styleOf(teamLabel, 4)} />
      {batter.name !== undefined && <NameText name={batter.name} cardBox={BATTER_BOXES[3]} origin={b} />}
      {positionBadge !== null && <PositionBadge badge={positionBadge} origin={b} styleOf={styleOf} />}
      <Label frame={batterHand !== 0 ? LABEL.leftBatter : LABEL.rightBatter} cardBox={BATTER_BOXES[8]} anchor={0x22} origin={b} testId="타자손" />
      <Label frame={LABEL.average} cardBox={BATTER_BOXES[4]} anchor={0x22} origin={b} testId="타율칸" />
      <BattingAverage value={batter.battingAverage} origin={b} />
      <Label frame={LABEL.homeRun} cardBox={BATTER_BOXES[5]} anchor={0x22} origin={b} testId="홈런칸" />
      <BoxNumber value={batter.homeRuns} box={6} origin={b} testId="홈런" />
      <Label frame={LABEL.runsBattedIn} cardBox={BATTER_BOXES[10]} anchor={0x22} origin={b} testId="타점칸" />
      <BoxNumber value={batter.runsBattedIn} box={9} origin={b} testId="타점" />
      {batter.battingOrder !== undefined && (
        <Glyphs glyphs={boxNumberGlyphsOf(batter.battingOrder + 1, BATTER_BOXES[2], b, NUMBER_BASE.order, 1, 0x2)} testId="타순" />
      )}
      <RecentResults results={batter.recentResults} origin={b} />
    </div>
  )
}
