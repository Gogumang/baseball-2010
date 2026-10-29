import { titleDisplayNameOf, TITLE_ROWS_PER_PAGE } from '@/entities/career/model/titles'
import {
  TITLE_CURSOR_BOX,
  TITLE_LIST_BOXES,
  TITLE_LIST_COLORS,
  TITLE_LIST_FRAME,
  TITLE_NUMBER_HEIGHT,
  TITLE_ROW_STEP,
  centeredTopOf,
  titleNumberLeftOf,
  titleNumberWidthOf,
} from '@/widgets/management/lib/titleListLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/management/ui/TitleListWindow.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { MODE_UI, pad } from '@/widgets/management/ui/titleListWindow/titleListAssets'

const { number: numberBox, name: nameBox } = TITLE_LIST_BOXES

/** 줄 막대 아홉 — 프레임 64, 장착한 줄은 65 를 덧댄다 */
export function TitleRowBars({ page, equipped }: { readonly page: readonly string[]; readonly equipped: string | null }) {
  return Array.from({ length: TITLE_ROWS_PER_PAGE }, (_unused, row) => {
    const title = page[row]
    const isEquipped = title !== undefined && title === equipped
    const frames = isEquipped ? [TITLE_LIST_FRAME.row, TITLE_LIST_FRAME.equippedRow] : [TITLE_LIST_FRAME.row]
    return frames.map((frame) => (
      <img
        key={`${row}-${frame}`}
        className={styles.layer}
        alt=""
        data-testid={`칭호-막대-${row}-${frame}`}
        src={`${MODE_UI}/${pad(frame)}.png`}
        style={{ left: numberBox.x, top: numberBox.y + TITLE_ROW_STEP * row }}
      />
    ))
  })
}

/** 줄 번호 — num 숫자를 왼쪽부터 글자 폭만큼 */
function TitleNumber({ value, dy }: { readonly value: number; readonly dy: number }) {
  let digitLeft = titleNumberLeftOf(value)
  return [...String(value)].map((digit, digitIndex) => {
    const left = digitLeft
    digitLeft += titleNumberWidthOf(digit)
    return (
      <img
        key={digitIndex}
        className={styles.layer}
        alt=""
        src={assetUrl(`./sprites/num/${pad(Number(digit))}.png`)}
        style={{ left, top: centeredTopOf(numberBox, TITLE_NUMBER_HEIGHT) + dy }}
      />
    )
  })
}

/** 고른 줄 테두리 — 0xb9ed5 노랑. 0x6a978 이 폭·높이에 1 을 더해 플랫폼 0x14006d8 에 넘겨 (w + 1) × (h + 1) 칸을 덮는다(U-113 확정) */
function TitleCursor({ dy }: { readonly dy: number }) {
  return (
    <svg className={local.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges" data-testid="칭호-커서">
      <rect
        x={TITLE_CURSOR_BOX.x + 0.5}
        y={TITLE_CURSOR_BOX.y + dy + 0.5}
        width={TITLE_CURSOR_BOX.width}
        height={TITLE_CURSOR_BOX.height}
        fill="none"
        stroke={TITLE_LIST_COLORS.cursor}
        strokeWidth={1}
      />
    </svg>
  )
}

interface TitleRowProps {
  readonly title: string
  readonly index: number
  readonly row: number
  readonly isEquipped: boolean
  readonly isCursorShown: boolean
  readonly onPick: (index: number) => void
}

/** 한 줄 — 번호 · 이름(장착한 것만 다른 색) · 커서 */
export function TitleRow({ title, index, row, isEquipped, isCursorShown, onPick }: TitleRowProps) {
  const dy = TITLE_ROW_STEP * row
  return (
    <span>
      <TitleNumber value={index + 1} dy={dy} />
      <button
        type="button"
        aria-current={isEquipped ? 'true' : undefined}
        className={local.row}
        style={{
          left: nameBox.x,
          top: nameBox.y + dy,
          width: nameBox.width,
          height: nameBox.height,
          color: isEquipped ? TITLE_LIST_COLORS.equippedText : TITLE_LIST_COLORS.text,
        }}
        onClick={(event) => {
          event.stopPropagation()
          onPick(index)
        }}
      >
        {titleDisplayNameOf(title)}
      </button>
      {isCursorShown && <TitleCursor dy={dy} />}
    </span>
  )
}
