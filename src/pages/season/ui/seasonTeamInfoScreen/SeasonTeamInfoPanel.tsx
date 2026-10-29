import { useImgTextPalettes } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEAM_INFO_LEFT_ROWS } from '@/pages/season/lib/seasonTeamInfo'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import { INFO_BOARD, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP, managementStyles as styles } from './otherSlices'
import { BOARD_WIDTH, COLUMNS, IMG_TEXT, LABEL_PALETTE, VALUE_IMAGE_PALETTE, frameSrc, type PaletteStyleOf } from './infoAssets'
import { NumberValue } from './NumberValue'
import { StadiumTicker } from './StadiumTicker'

type FrameSize = { readonly width: number; readonly height: number }

/** 글 · 그림 값 — 숫자는 `NumberValue`(num 그림)가 그린다 */
function valueOf(row: TeamInfoRow, styleOf: PaletteStyleOf) {
  const { value } = row
  if (value.kind === '그림') {
    return (
      <img
        alt=""
        data-frame={value.frame}
        src={frameSrc(value.frame)}
        style={{ verticalAlign: 'middle', ...styleOf(value.frame, VALUE_IMAGE_PALETTE) }}
      />
    )
  }
  return value.kind === '숫자' ? null : value.text
}

interface InfoValueProps {
  readonly row: TeamInfoRow
  readonly testId: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number }
  readonly styleOf: PaletteStyleOf
  readonly sizeOf: (frame: number) => FrameSize | undefined
}

/** 값 칸 — 흐르는 글(구장 줄) · 숫자(num 그림) · 글 · 그림 */
function InfoValue({ row, testId, box, styleOf, sizeOf }: InfoValueProps) {
  const { value } = row
  if (value.kind === '흐르는글') {
    return <StadiumTicker text={value.text} testId={testId} box={{ x: box.x, y: box.y + 2, width: box.width, height: INFO_ROW_HEIGHT }} />
  }
  if (value.kind === '숫자') {
    return (
      <div data-testid={testId} data-value={value.value}>
        <NumberValue
          value={value.value}
          suffixFrame={value.suffixFrame}
          styleOf={styleOf}
          sizeOf={sizeOf}
          box={{ x: box.x, y: box.y, width: box.width, height: INFO_ROW_HEIGHT }}
        />
      </div>
    )
  }
  return (
    <div
      className={styles.infoValue}
      data-testid={testId}
      style={{ left: box.x, top: box.y, width: box.width, height: INFO_ROW_HEIGHT, color: ORIGINAL_COLORS.text }}
    >
      {valueOf(row, styleOf)}
    </div>
  )
}

/** 줄 i 의 칸 — 왼쪽 열 넷 · 오른쪽 열 셋, 구장 줄은 값 칸 너비가 w × 2 − 14 (0x7c9b2) */
function rowPlaceOf(row: TeamInfoRow, index: number) {
  const isLeft = index < TEAM_INFO_LEFT_ROWS
  const column = COLUMNS[isLeft ? 0 : 1]
  const top = INFO_TOP + (isLeft ? index : index - TEAM_INFO_LEFT_ROWS) * INFO_ROW_STEP
  const width = row.value.kind === '흐르는글' ? column.value.width * 2 - 14 : column.value.width
  return { column, top, width }
}

/**
 * **정보 칸 0x7c450 시즌 갈래**의 판과 일곱 줄 — 구단정보 0xd5 · 이름 입력 0xc8(그림 0xba28 의 ba5a) 이 같이 쓴다.
 * 이름 입력은 창+0x28 = 1 이라 줄 0 단장 값(0x7c6f4~0x7c724 `ldrb [gfx+0x28]` ≠ 0 → 건너뜀)을 안 쓴다 — 부르는 쪽이 빈 글로 넘긴다.
 */
export function SeasonTeamInfoPanel({ rows, testIdPrefix = '구단정보' }: { readonly rows: readonly TeamInfoRow[]; readonly testIdPrefix?: string }) {
  // 이름표 47 "순위" 는 팔레트 3 으로 구워 둔 프레임이라 팔레트 0 자리에서 흰 글자로 되돌린다
  const palettes = useImgTextPalettes()
  const origins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => origins?.[String(frame).padStart(3, '0')]
  return (
    <>
      {palettes.definition}
      <div
        className={styles.layer}
        style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: BOARD_WIDTH, height: INFO_BOARD.height, background: INFO_BOARD.color }}
      />
      {rows.map((row, index) => {
        const { column, top, width } = rowPlaceOf(row, index)
        return (
          <div key={row.labelFrame} data-testid={`${testIdPrefix}-줄-${index}`}>
            <img
              className={styles.layer}
              alt=""
              data-frame={row.labelFrame}
              src={frameSrc(row.labelFrame)}
              style={{
                left: column.label.x + column.label.width,
                top: top + 3,
                transform: 'translateX(-100%)',
                ...palettes.styleOf(row.labelFrame, LABEL_PALETTE),
              }}
            />
            <InfoValue
              row={row}
              testId={`${testIdPrefix}-값-${index}`}
              box={{ x: column.value.x, y: top, width }}
              styleOf={palettes.styleOf}
              sizeOf={sizeOf}
            />
          </div>
        )
      })}
    </>
  )
}
