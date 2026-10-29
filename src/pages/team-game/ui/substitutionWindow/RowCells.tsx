import { ORIGINAL_COLORS } from '@/shared/config/design'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { FrameSprite } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { yearCellDrawingOf } from './otherSlices'
import { FIELDER_TYPE_COLORS, SUBSTITUTION_WINDOW } from '@/pages/team-game/lib/substitutionWindow'
import type { SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'
import { CellNumber, CenteredImgText, Rect } from './cellParts'
import { GAME_UI_FRAMES, pixel } from './substitutionAssets'

/** 방어율이 이 값보다 크면 ×10 해서 소수 셋 자리 (0x37b24) */
const ERA_SCALE_THRESHOLD = 100
/** 타율이 이 값보다 크면 소수 셋 자리 */
const AVERAGE_DECIMAL_THRESHOLD = 999

/** 방어율 / 타율 칸 숫자 — 투수는 100 보다 크면 ×10 해서 소수 셋 자리(0xb6ce9 · 0x37b24) */
function rateDrawingOf(rate: number | null, isPitcher: boolean) {
  if (rate === null) return null
  if (isPitcher) return yearCellDrawingOf({ value: rate > ERA_SCALE_THRESHOLD ? rate * 10 : rate, digits: 3, isDecimal: true })
  return yearCellDrawingOf({ value: rate, digits: rate > AVERAGE_DECIMAL_THRESHOLD ? 3 : 0, isDecimal: true })
}

/** 칸 넷 — 이름(game_ui 28) · 딱지 · 방어율/타율 · 탈삼진/홈런 (game_ui 35) */
export function RowCells({
  row,
  y,
  isPitcher,
  gameUi,
  imgText,
  testId,
}: {
  readonly row: SubstitutionRow
  readonly y: number
  readonly isPitcher: boolean
  readonly gameUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly testId: string
}) {
  const W = SUBSTITUTION_WINDOW
  const [nameX, badgeX, rateX, countX] = W.columnX
  // 0xba2e5(x − 1, y, 54, 15, 이름, 정렬 2(가로 가운데), dy 2) — 앱 글꼴 흰색
  const nameWidth = measurePixelTextWidth(row.name)
  const rate = rateDrawingOf(row.rate, isPitcher)
  const count = row.count === null ? null : yearCellDrawingOf({ value: row.count, digits: -1, isDecimal: false })
  return (
    <div data-testid={`교체 줄 ${testId}`} aria-label={row.name}>
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.nameCellFrame} origins={gameUi} x={nameX} y={y} />
      <PixelText style={{ ...pixel, left: nameX - 1 + ((W.columnWidth[0] - nameWidth) >> 1), top: y + 2, color: ORIGINAL_COLORS.text }}>
        {row.name}
      </PixelText>
      {row.stamina !== null && (
        <>
          {/* 0x571d8 투수 — 녹 (0x1c, 0x93, 0) 두 줄 위에 빨 (0xff, 0x3c, 0x14) 두 줄 */}
          <Rect x={nameX + 3} y={y + W.cellHeight - 2} width={row.stamina.length + 1} height={2} color="#1C9300" />
          <Rect x={nameX + 3} y={y + W.cellHeight - 2} width={row.stamina.current + 1} height={2} color="#FF3C14" />
        </>
      )}
      {row.fielderType !== null && FIELDER_TYPE_COLORS[row.fielderType] !== undefined && (
        // 0x571d8 타자 — (x + w − 4 · x + w − 3, y + 1)~(…, y + h − 2) 두 줄, 색은 +0xb & 3
        <Rect x={nameX + W.columnWidth[0] - 4} y={y + 1} width={2} height={W.cellHeight - 2} color={FIELDER_TYPE_COLORS[row.fielderType]} />
      )}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={badgeX} y={y} />
      {row.badge !== null && (
        <>
          <FrameSprite folder={GAME_UI_FRAMES} frame={row.badge.chipFrame} origins={gameUi} x={badgeX} y={y} />
          <CenteredImgText origins={imgText} frame={row.badge.label} x={badgeX} y={y} width={W.columnWidth[1]} />
        </>
      )}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={rateX} y={y} />
      {rate !== null && <CellNumber drawing={rate} x={rateX} y={y} />}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={countX} y={y} />
      {count !== null && <CellNumber drawing={count} x={countX} y={y} />}
    </div>
  )
}
