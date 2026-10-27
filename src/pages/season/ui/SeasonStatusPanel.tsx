import type { CSSProperties } from 'react'
import { SpriteNumber, useImgTextPalettes } from '@/shared/ui'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { STATUS_BOXES, moneyGlyphsOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
import { StatusBoardBase } from '@/pages/management/ui/ManagementBoard'
import { MessageLine, StatusLabels, valueRightOf } from '@/pages/management/ui/StatusValues'
import { StatusIconRow } from '@/pages/management/ui/StatusIconRow'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { ATTENDANCE_LABEL_FRAME, seasonStatusPanelLayoutOf } from '@/pages/season/lib/seasonStatusPanel'
import type { PlacedImage } from '@/pages/season/lib/seasonStatusPanel'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const NUM = assetUrl('./sprites/num')
/** SR+2 소지금은 100만 원 단위 — 0x7db42 가 ×100 해서 만 원 단위 0x63331 에 넘긴다 */
const MONEY_TO_TEN_THOUSAND = 100
const DIGIT_HEIGHT = 10

const pad = (frame: number) => String(frame).padStart(3, '0')

function ImageText({ image, paletteStyle }: { readonly image: PlacedImage; readonly paletteStyle?: CSSProperties }) {
  return (
    <img className={styles.layer} src={`${IMG_TEXT}/${pad(image.frame)}.png`} alt="" data-frame={image.frame}
      style={{ left: image.left, top: image.top, ...paletteStyle }} />
  )
}

export interface SeasonStatusPanelProps {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 (0~100) — 사기 막대 */
  readonly teamMorale: number
  /** 경기장 띠의 시간대를 고르는 휴대폰 시각 (시즌 장면 0x4b50 → 0x7b934) */
  readonly hour?: number
  /**
   * 0x7d34c 둘째 인자 — 이벤트 대화창 0x8b5ac 만 [이벤트+0xb] 를 넘긴다(경기 뒤 평가 내장 이벤트 0x8a6fc 만 1).
   * 서면 메시지줄 경기 번호가 −1(막 치른 경기).
   */
  readonly isPreviousGame?: boolean
}

/**
 * 시즌모드 상태판 — 공용 상태판 0x7d34c 의 모드 2 갈래 (`lib/seasonStatusPanel` 머리 주석).
 * 화면 원점에 그리고 그 위에 다른 것(커맨드 줄·가운데 판·창)이 덮인다 — 부르는 쪽은 맨 먼저 둔다.
 */
export function SeasonStatusPanel({
  record, teamMorale, hour, isPreviousGame = false,
}: SeasonStatusPanelProps) {
  const layout = seasonStatusPanelLayoutOf(record, isPreviousGame)
  const { popularity, money, reputation, salary } = STATUS_BOXES
  const digit = layout.goalRankDigit
  const digitSource = `${NUM}/${pad(digit.frame)}.png`
  // 관중 뒤 "명" 344 는 img_text 팔레트 1(노랑) — 0x7dbf6 `0x913e5(img_text, 1)` → 0x7dc2a 0xb9e05 (시즌 갈래)
  const palettes = useImgTextPalettes()

  return (
    <div role="group" aria-label="상태판">
      {palettes.definition}
      <StatusBoardBase hour={hour} nameBandSplit={layout.nameBandSplit} morale={teamMorale}
        nameContent={(
          <>
            <ImageText image={layout.teamName} />
            <ImageText image={layout.goalText} />
            {/* 효과 0xb(단색) 흰색 — 그림을 마스크로 쓰고 흰색을 칠한다 */}
            <div className={styles.tintedGlyph} style={{
              left: digit.left, top: digit.top, width: digit.frame % 10 === 1 ? 4 : 6, height: DIGIT_HEIGHT,
              background: solidColorCss(ORIGINAL_COLORS.text), maskImage: spriteMaskImage(digitSource), WebkitMaskImage: spriteMaskImage(digitSource),
            }} />
          </>
        )} />
      <StatusLabels lastLabelFrame={ATTENDANCE_LABEL_FRAME} />
      <SpriteNumber glyphs={numberGlyphsOf(record.popularity)} right={valueRightOf(popularity)} boxTop={popularity.y} boxHeight={popularity.height} />
      <SpriteNumber glyphs={moneyGlyphsOf(record.money * MONEY_TO_TEN_THOUSAND)} right={valueRightOf(money)} boxTop={money.y} boxHeight={money.height} />
      <SpriteNumber glyphs={numberGlyphsOf(record.reputation)} right={valueRightOf(reputation)} boxTop={reputation.y} boxHeight={reputation.height} />
      <SpriteNumber glyphs={numberGlyphsOf(record.lastAttendance)} right={layout.attendanceRight} boxTop={salary.y} boxHeight={salary.height} />
      <ImageText image={layout.attendanceUnit} paletteStyle={palettes.styleOf(layout.attendanceUnit.frame, 1)} />
      <MessageLine year={layout.year} game={layout.game} />
      <StatusIconRow state={layout.icons} />
    </div>
  )
}
